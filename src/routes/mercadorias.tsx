import { useMemo, useState, Fragment } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/store";
import { useSession } from "@/lib/session";
import { UNIDADES, unidadeLabel, unidadeValue } from "@/lib/constants";
import { pavilhaoNome, pavTitle, pavIdsOf } from "@/lib/catalog";
import { useDb } from "@/lib/use-db";
import { notify } from "@/lib/notify";
import type { Mercadoria } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { PageStage } from "@/components/motion/page-stage";
import { ActionButton } from "@/components/motion/action-button";
import { ProductIcon, ProductLabel } from "@/components/inventory/product-icon";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { MOTION } from "@/lib/motion";
import { playCeremony, ceremonyDock } from "@/lib/ceremony";
import { rowEl, tossAway } from "@/lib/toss";
import { cn, fold } from "@/lib/utils";

export const Route = createFileRoute("/mercadorias")({ component: Mercadorias });

function Mercadorias() {
  const { isAdmin } = useSession();
  const live = useDb();
  const [tick, setTick] = useState(0);
  const list = useMemo(() => live.listMercadorias(), [tick, live]);
  const pavilhoes = useMemo(() => live.listPavilhoes(), [tick, live]);
  const pavilhoesAll = useMemo(() => live.listPavilhoes(true), [tick, live]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("Cx");
  const [pavilhaoIds, setPavilhaoIds] = useState<string[]>(["p13"]);
  const [bornId, setBornId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [pending, setPending] = useState<Mercadoria | null>(null);
  const [edit, setEdit] = useState<Mercadoria | null>(null);
  const [eNome, setENome] = useState("");
  const [eCodigo, setECodigo] = useState("");
  const [eUnidade, setEUnidade] = useState("Cx");
  const [ePavilhoes, setEPavilhoes] = useState<string[]>(["p13"]);
  const [eMinimo, setEMinimo] = useState("");

  const filtered = list.filter((m) => {
    const term = fold(q.trim());
    if (!term) return true;
    const code = fold(m.codigo);
    const codeShort = code.replace(/^0+/, "");
    const termShort = term.replace(/^0+/, "");
    return fold(m.nome).includes(term) || code.includes(term) || (termShort.length > 0 && codeShort.includes(termShort));
  });
  const groups = filtered.reduce<Record<string, Mercadoria[]>>((acc, m) => {
    const ids = pavIdsOf(m);
    if (!ids.length) {
      (acc["Outros"] ??= []).push(m);
      return acc;
    }
    for (const id of ids) {
      const pav = pavilhoesAll.find((p) => p.id === id);
      const key = pav ? pavTitle(pav) : pavilhaoNome(id);
      (acc[key] ??= []).push(m);
    }
    return acc;
  }, {});
  const groupList = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([cat, items]) => [cat, items.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))] as const);

  if (!isAdmin) return <Navigate to="/" />;

  function openEdit(m: Mercadoria) {
    setEdit(m);
    setENome(m.nome);
    setECodigo(m.codigo);
    setEUnidade(unidadeValue(m.unidade));
    setEPavilhoes(pavIdsOf(m).length ? pavIdsOf(m) : ["p13"]);
    setEMinimo(String(m.minimo));
  }

  function saveEdit() {
    if (!edit) return;
    if (!eNome.trim() || !eCodigo.trim()) {
      notify.error("Código e nome são obrigatórios.");
      return;
    }
    db.updateMercadoria(edit.id, {
      nome: eNome,
      codigo: eCodigo,
      unidade: eUnidade,
      minimo: Number(eMinimo) || edit.minimo,
      pavilhao_ids: ePavilhoes.length ? ePavilhoes : ["p13"],
    });
    setTick((n) => n + 1);
    setEdit(null);
    notify.success("Produto atualizado.");
  }

  return (
    <PageStage className="space-y-4">
      <PageHeader icon="package" title="Produtos" description={`${list.length} itens do relatório, com código e ícone. Busque por nome ou código.`}>
        <Button onClick={() => setOpen(true)}>
          <Plus /> Novo produto
        </Button>
      </PageHeader>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar por nome ou código (ex: 0201 ou Maçã)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Catálogo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Pavilhão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      icon={Plus}
                      title="Nenhum produto"
                      description="Cadastre o primeiro item para habilitar estoque e entradas."
                    >
                      <Button onClick={() => setOpen(true)}>Novo produto</Button>
                    </EmptyState>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState icon={Search} title="Nenhum produto encontrado" description="Tente outro termo ou limpe a busca.">
                      <Button variant="outline" onClick={() => setQ("")}>
                        Limpar busca
                      </Button>
                    </EmptyState>
                  </TableCell>
                </TableRow>
              ) : (
                groupList.map(([categoria, items]) => (
                  <Fragment key={categoria}>
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/60 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {categoria} · {items.length}
                      </TableCell>
                    </TableRow>
                    {items.map((m) => (
                      <TableRow
                        key={m.id}
                        data-toss-id={m.id}
                        className={m.id === bornId ? "row-born" : m.id === leavingId ? "row-leave" : undefined}
                      >
                        <TableCell>
                          <Link to="/produto/$id" params={{ id: m.id }} className="block">
                            <ProductLabel nome={m.nome} codigo={m.codigo} />
                          </Link>
                        </TableCell>
                        <TableCell>{unidadeLabel(m.unidade)}</TableCell>
                        <TableCell>
                          {pavIdsOf(m)
                            .map((id) => {
                              const pav = pavilhoesAll.find((p) => p.id === id);
                              return pav ? pavTitle(pav) : pavilhaoNome(id);
                            })
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.status ? "success" : "muted"}>{m.status ? "Ativo" : "Inativo"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" aria-label="Editar produto" onClick={() => openEdit(m)}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              db.updateMercadoria(m.id, { status: !m.status });
                              setTick((n) => n + 1);
                              notify.success(m.status ? "Produto desativado." : "Produto ativado.");
                            }}
                          >
                            {m.status ? "Desativar" : "Ativar"}
                          </Button>
                          <Button variant="ghost" size="icon" className="ml-1" aria-label="Excluir produto" onClick={() => setPending(m)}>
                            <Trash2 className="text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova mercadoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mc">Código</Label>
              <Input id="mc" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mn">Nome</Label>
              <Input id="mn" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                  {UNIDADES.every((u) => u.value !== eUnidade) && eUnidade ? (
                    <SelectItem value={eUnidade}>{unidadeLabel(eUnidade)}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pavilhões</Label>
              <p className="text-xs text-muted-foreground">Pode marcar mais de um se o produto não fica só em um lugar.</p>
              <div className="flex flex-wrap gap-1.5">
                {pavilhoes.map((p) => {
                  const on = pavilhaoIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setPavilhaoIds((prev) => (on ? prev.filter((x) => x !== p.id) : [...prev, p.id]))
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                      )}
                    >
                      {pavTitle(p)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <ActionButton
              idleLabel="Salvar"
              pendingLabel="Salvando"
              doneLabel="Produto criado"
              onAction={async () => {
                if (!codigo.trim() || !nome.trim()) {
                  notify.error("Código e nome são obrigatórios.");
                  return false;
                }
                const createdName = nome.trim();
                const row = db.createMercadoria({ codigo, nome, unidade, pavilhao_ids: pavilhaoIds.length ? pavilhaoIds : ["p13"] });
                setBornId(row.id);
                setCodigo("");
                setNome("");
                setPavilhaoIds(["p13"]);
                setTick((n) => n + 1);
                window.setTimeout(() => {
                  setOpen(false);
                  playCeremony({
                    kind: "create",
                    title: createdName,
                    subtitle: "Entrou no catálogo",
                    productName: createdName,
                    mark: "product",
                    dock: ceremonyDock("/mercadorias"),
                  });
                  notify.success("Produto no catálogo.");
                }, 520);
                window.setTimeout(() => setBornId(null), 1400);
                return true;
              }}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <SheetContent side="right" className="p-6">
          <SheetTitle>Editar produto</SheetTitle>
          {edit ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <ProductIcon nome={eNome || edit.nome} codigo={eCodigo || edit.codigo} size="lg" />
                <p className="text-sm text-muted-foreground">Alterações entram na lista sem recarregar.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ec">Código</Label>
                <Input id="ec" value={eCodigo} onChange={(e) => setECodigo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="en">Nome</Label>
                <Input id="en" value={eNome} onChange={(e) => setENome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select value={eUnidade} onValueChange={setEUnidade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                    {UNIDADES.every((u) => u.value !== eUnidade) && eUnidade ? (
                      <SelectItem value={eUnidade}>{unidadeLabel(eUnidade)}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pavilhões</Label>
                <p className="text-xs text-muted-foreground">Marque todos os lugares em que este produto circula.</p>
                <div className="flex flex-wrap gap-1.5">
                  {pavilhoes.map((p) => {
                    const on = ePavilhoes.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setEPavilhoes((prev) => (on ? prev.filter((x) => x !== p.id) : [...prev, p.id]))
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                        )}
                      >
                        {pavTitle(p)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em">Estoque mínimo</Label>
                <Input id="em" type="number" min={0} value={eMinimo} onChange={(e) => setEMinimo(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEdit(null)}>
                  Cancelar
                </Button>
                <Button onClick={saveEdit}>Salvar</Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending ? `Excluir “${pending.nome}”?` : "Excluir produto"}
        description="O produto sai do catálogo. Você pode desfazer pelo aviso que aparece em seguida."
        productName={pending?.nome}
        mark="product"
        onConfirm={() => {
          if (!pending) return;
          const target = pending;
          tossAway(rowEl(target.id));
          setLeavingId(target.id);
          window.setTimeout(() => {
            const snap = db.deleteMercadoria(target.id);
            setLeavingId(null);
            setTick((n) => n + 1);
            notify.success("Produto removido.", {
              action: snap
                ? {
                    label: "Desfazer",
                    onClick: () => {
                      db.restoreMercadoria(snap);
                      setTick((n) => n + 1);
                    },
                  }
                : undefined,
            });
          }, MOTION.duration.normal);
        }}
      />
    </PageStage>
  );
}
