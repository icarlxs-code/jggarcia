import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Bookmark, BookmarkPlus, FileText, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { useSession } from "@/lib/session";
import { destinoDaSaida, isPavTransfer, lugarDaSaida } from "@/lib/catalog";
import { statusLabel, statusOf, tipoMovimentacaoOf } from "@/lib/movement";
import { MovementDetail } from "@/components/inventory/movement-detail";
import { formatDateBR, formatNumber, todayISO } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { Atalho, AtalhoKind } from "@/lib/types";
import { exportDiaCompletoPdf } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { ProductLabel } from "@/components/inventory/product-icon";
import { PavPicker } from "@/components/inventory/pav-mark";
import { ProductPicker } from "@/components/inventory/product-picker";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { HojeCharts } from "@/components/hoje/hoje-charts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hoje")({ component: Hoje });

function Hoje() {
  const live = useDb();
  const { perfil } = useSession();
  const navigate = useNavigate();
  const hoje = todayISO();
  const pavilhoes = live.listPavilhoes();
  const destinos = live.listDestinos(true);
  const mercadorias = live.listMercadorias(true);
  const atalhos = live.listAtalhos();
  const movs = live.listSaidas({ from: hoje, to: hoje });
  const entradas = movs.filter((s) => (s.tipo ?? "saida") === "entrada");
  const saidas = movs.filter((s) => (s.tipo ?? "saida") === "saida");

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AtalhoKind>("transferencia");
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState("");
  const [destPav, setDestPav] = useState("");
  const [destId, setDestId] = useState("");
  const [mercId, setMercId] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState<Atalho | null>(null);
  const [view, setView] = useState<(typeof movs)[number] | null>(null);
  const transito = saidas.filter((s) => statusOf(s) === "em_transito").length;
  const produtosMov = new Set(movs.map((s) => s.mercadoria_id)).size;
  const contagensHoje = live.listContagens().filter((c) => c.data === hoje).length;

  function resetForm() {
    setKind("transferencia");
    setNome("");
    setOrigem("");
    setDestPav("");
    setDestId("");
    setMercId("");
    setFormError("");
  }

  function saveAtalho() {
    try {
      setFormError("");
      const row = db.createAtalho({
        kind,
        nome,
        origem_pavilhao_id: origem,
        destino_pavilhao_id: kind === "transferencia" ? destPav : undefined,
        destino_id: kind === "saida" ? destId : undefined,
        mercadoria_id: mercId || undefined,
      });
      setOpen(false);
      resetForm();
      notify.success(`Atalho “${row.nome}” na lista.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível criar o atalho.";
      setFormError(msg);
      notify.error(msg);
    }
  }

  function runAtalho(a: Atalho) {
    db.touchAtalho(a.id);
    if (a.kind === "entrada") {
      void navigate({ to: "/entradas", search: { pav: a.origem_pavilhao_id, produto: a.mercadoria_id } });
      return;
    }
    void navigate({
      to: "/nova-saida",
      search: {
        pav: a.origem_pavilhao_id,
        dest: a.kind === "saida" ? a.destino_id : undefined,
        destPav: a.kind === "transferencia" ? a.destino_pavilhao_id : undefined,
        produto: a.mercadoria_id,
      },
    });
  }

  function pinFromMov(s: (typeof movs)[number]) {
    try {
      const tipo = s.tipo ?? "saida";
      if (tipo === "entrada") {
        const row = db.createAtalho({
          kind: "entrada",
          origem_pavilhao_id: s.pavilhao_id,
          mercadoria_id: s.mercadoria_id,
        });
        notify.success(`Atalho “${row.nome}” na lista.`);
        return;
      }
      const row = db.createAtalho({
        kind: isPavTransfer(s) ? "transferencia" : "saida",
        origem_pavilhao_id: s.pavilhao_id,
        destino_pavilhao_id: s.destino_pavilhao_id,
        destino_id: s.destino_id || undefined,
        mercadoria_id: s.mercadoria_id,
      });
      notify.success(`Atalho “${row.nome}” na lista.`);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível criar o atalho.");
    }
  }

  const weekday = new Date().toLocaleDateString("pt-BR", { weekday: "long" });

  return (
    <PageStage className="space-y-5">
      <PageHeader
        icon="today"
        title="Hoje"
        description={`${weekday} · ${formatDateBR(hoje)}. Atalhos da operação e o que já saiu ou entrou nesta tarde.`}
      >
        <Button variant="outline" onClick={() => exportDiaCompletoPdf(hoje)}>
          <FileText /> PDF do dia
        </Button>
        <Button onClick={() => setOpen(true)}>
          <Plus /> Novo atalho
        </Button>
      </PageHeader>

      <section className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Atalhos</h2>
            <p className="text-xs text-muted-foreground">Galpão a galpão, pavilhão a pavilhão, entrada e saída de cliente. Toque para lançar já preenchido.</p>
          </div>
        </div>
        {atalhos.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={BookmarkPlus}
                title="Nenhum atalho ainda"
                description="Crie o caminho que a equipe usa todo dia. Ele entra na lista na hora."
              >
                <Button onClick={() => setOpen(true)}>Criar atalho</Button>
              </EmptyState>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {atalhos.map((a) => (
              <div key={a.id} className="flex items-stretch overflow-hidden rounded-2xl border border-border bg-card">
                <button type="button" className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-muted/50" onClick={() => runAtalho(a)}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{kindLabel(a.kind)}</p>
                  <p className="mt-0.5 text-sm font-semibold leading-snug">{a.nome}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{a.usos} {a.usos === 1 ? "uso" : "usos"}</p>
                </button>
                <button
                  type="button"
                  className="flex min-w-12 shrink-0 items-center justify-center border-l border-border px-3 text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label="Excluir atalho"
                  onClick={() => setPending(a)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Entradas hoje" value={entradas.length} />
        <Kpi label="Saídas hoje" value={saidas.length} />
        <Kpi label="Em trânsito" value={transito} />
        <Kpi label="Produtos movimentados" value={produtosMov} />
        <Kpi label="Contagens" value={contagensHoje} />
      </section>

      <HojeCharts />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Movimentações de hoje</h2>
        <Card>
          <CardContent className="p-0">
            {movs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Ainda não lançaram nada hoje. {perfil?.nome ? `${perfil.nome.split(" ")[0]}, ` : ""}comece por um atalho ou por uma{" "}
                <Link to="/entradas" className="font-medium text-foreground underline-offset-2 hover:underline">
                  entrada
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {movs.map((s) => {
                  const tipo = tipoMovimentacaoOf(s);
                  return (
                    <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                      <button type="button" className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => setView(s)}>
                      <div className="mt-0.5 text-muted-foreground">
                        {tipo === "entrada" ? <ArrowDownToLine className="h-4 w-4" /> : tipo === "transferencia" ? <ArrowLeftRight className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {s.hora_saida || s.created_at.slice(11, 16)} — {tipo === "entrada" ? "ENTRADA" : tipo === "transferencia" ? "TRANSFERÊNCIA" : "SAÍDA"}
                        </p>
                        <ProductLabel
                          nome={s.mercadoria?.nome ?? "Produto"}
                          codigo={s.mercadoria?.codigo}
                          extra={`${formatNumber(s.quantidade)} ${s.unidade}`}
                        />
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {tipo === "entrada" ? `→ ${lugarDaSaida(pavilhoes, s)}` : `${lugarDaSaida(pavilhoes, s)} → ${destinoDaSaida(pavilhoes, s)}`}
                          {s.operador_nome ? ` · Empilhador: ${s.operador_nome}` : ""}
                          {s.usuario?.nome ? ` · ${s.usuario.nome}` : ""}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tipo === "entrada" ? <Badge variant="success">Entrada</Badge> : tipo === "transferencia" ? <Badge variant="muted">Transferência</Badge> : <Badge variant="gold">Saída</Badge>}
                          {s.desconta_estoque === false ? <Badge variant="gold">Somente registro</Badge> : null}
                          {tipo !== "entrada" ? <Badge variant="muted">{statusLabel(statusOf(s))}</Badge> : null}
                        </div>
                      </div>
                      </button>
                      <Button variant="ghost" size="icon" aria-label="Salvar atalho" onClick={() => pinFromMov(s)}>
                        <Bookmark className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo atalho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {([
                ["transferencia", "Pavilhão"],
                ["saida", "Cliente"],
                ["entrada", "Entrada"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKind(id)}
                  className={cn(
                    "min-h-12 rounded-xl border px-2 text-sm font-medium",
                    kind === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="at-nome">Nome na lista</Label>
              <Input id="at-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Se vazio, o sistema escreve a rota" />
            </div>
            <div className="space-y-1.5">
              <Label>{kind === "entrada" ? "Entra em" : "Sai de"}</Label>
              <PavPicker items={pavilhoes} value={origem} onChange={setOrigem} />
            </div>
            {kind === "transferencia" ? (
              <div className="space-y-1.5">
                <Label>Chega em</Label>
                <PavPicker items={pavilhoes} value={destPav} onChange={setDestPav} excludeId={origem || undefined} />
              </div>
            ) : null}
            {kind === "saida" ? (
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                {destinos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Cadastre um cliente em Clientes antes de criar este atalho.</p>
                ) : (
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {destinos.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDestId(d.id)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left text-sm",
                          destId === d.id ? "border-primary bg-mint font-medium" : "border-border hover:bg-muted",
                        )}
                      >
                        {d.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Produto (opcional)</Label>
              <ProductPicker items={mercadorias} value={mercId} onChange={(id) => setMercId(id)} placeholder="Qualquer produto — busque se quiser fixar um" />
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveAtalho}>Criar atalho</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending ? `Tirar “${pending.nome}” da lista?` : "Excluir atalho"}
        description="O atalho sai da lista. Os lançamentos que já foram feitos ficam no histórico."
        onConfirm={() => {
          const row = pending;
          if (!row) return;
          db.deleteAtalho(row.id);
          setPending(null);
          notify.success("Atalho removido.");
        }}
      />
      <MovementDetail view={view} onClose={() => setView(null)} />
    </PageStage>
  );
}

function kindLabel(kind: AtalhoKind) {
  if (kind === "entrada") return "Entrada";
  if (kind === "transferencia") return "Pavilhão → pavilhão";
  return "Saída cliente";
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold leading-tight">{value}</p>
        {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
