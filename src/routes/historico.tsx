import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/store";
import { calcTransportTime, completeTime, formatDateBR, formatMinutes, formatNumber, formatTime, isValidTime, todayISO } from "@/lib/format";
import { useDb } from "@/lib/use-db";
import { notify } from "@/lib/notify";
import { destinoDaSaida, isPavTransfer, lugarDaSaida } from "@/lib/catalog";
import { estoqueLabel, statusLabel, statusOf } from "@/lib/movement";
import { MovementDetail } from "@/components/inventory/movement-detail";
import { exportDiaCompletoPdf, exportSaidasClientesPdf } from "@/lib/reports";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { PageStage } from "@/components/motion/page-stage";
import type { Saida } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TimeField } from "@/components/ui/time-field";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProductLabel } from "@/components/inventory/product-icon";
import { useViewport } from "@/lib/use-viewport";
import { rowEl, tossAway } from "@/lib/toss";
import { cn } from "@/lib/utils";
import { NameRecall } from "@/components/inventory/name-recall";
import { ProductPicker } from "@/components/inventory/product-picker";
import { PeriodFilter, periodRange, type PeriodKey } from "@/components/inventory/period-filter";

export const Route = createFileRoute("/historico")({ component: Historico });

function Historico() {
  const live = useDb();
  const phone = useViewport() === "phone";
  const [tick, setTick] = useState(0);
  const saidas = useMemo(() => live.listSaidas().filter((s) => (s.tipo ?? "saida") === "saida"), [tick, live]);
  const pavilhoes = live.listPavilhoes(true);
  const mercadorias = live.listMercadorias();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("hoje");
  const [day, setDay] = useState(todayISO());
  const [obs, setObs] = useState("");
  const [view, setView] = useState<Saida | null>(null);
  const [edit, setEdit] = useState<Saida | null>(null);
  const [qtd, setQtd] = useState("");
  const [horaSaida, setHoraSaida] = useState("");
  const [horaChegada, setHoraChegada] = useState("");
  const [desconta, setDesconta] = useState(true);
  const [operador, setOperador] = useState("");
  const [mercadoriaId, setMercadoriaId] = useState("");
  const [pending, setPending] = useState<Saida | null>(null);

  const range = periodRange(period, day);
  const filtered = saidas.filter((s) => {
    if (s.data < range.from || s.data > range.to) return false;
    const term = q.trim().toLowerCase();
    if (!term) return true;
    const blob = [
      s.codigo,
      s.mercadoria?.nome,
      s.destino?.nome,
      destinoDaSaida(pavilhoes, s),
      s.origem,
      lugarDaSaida(pavilhoes, s),
      s.hora_saida,
      s.hora_chegada,
      s.operador_nome,
      s.empilhadeira,
      s.usuario?.nome,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return blob.includes(term);
  });

  function openEdit(s: Saida) {
    setView(null);
    setEdit(s);
    setQtd(String(s.quantidade));
    setHoraSaida((s.hora_saida || "").slice(0, 5));
    setHoraChegada((s.hora_chegada || "").slice(0, 5));
    setDesconta(s.desconta_estoque !== false);
    setOperador(s.operador_nome || "");
    setObs(s.observacao || "");
    setMercadoriaId(s.mercadoria_id);
  }

  function saveEdit() {
    if (!edit) return;
    const n = Number(qtd);
    if (!n || n <= 0) {
      notify.error("Quantidade inválida.");
      return;
    }
    if (!mercadoriaId) {
      notify.error("Escolha o produto.");
      return;
    }
    const hs = completeTime(horaSaida);
    const hc = horaChegada.trim() ? completeTime(horaChegada) : "";
    if (!isValidTime(hs) || (hc && !isValidTime(hc))) {
      notify.error("Informe a hora de saída com 4 dígitos. Chegada pode ficar em branco.");
      return;
    }
    const merc = mercadorias.find((m) => m.id === mercadoriaId);
    db.updateSaida(edit.id, {
      mercadoria_id: mercadoriaId,
      unidade: merc?.unidade || edit.unidade,
      quantidade: n,
      hora_saida: hs,
      hora_chegada: hc || null,
      tempo_transporte: hc ? calcTransportTime(hs, hc) : null,
      desconta_estoque: desconta,
      operador_nome: operador.trim() || "",
      observacao: obs.trim() || "",
    });
    setEdit(null);
    setTick((t) => t + 1);
    notify.success("Saída atualizada.");
  }

  return (
    <PageStage className="space-y-4">
      <PageHeader icon="out" title="Saídas / Expedição" description={`${filtered.length} lançamentos · toque no registro para ver horário, origem e se baixou estoque`}>
        <Button variant="outline" onClick={() => exportDiaCompletoPdf(range.from === range.to ? range.from : todayISO())}>
          <FileText /> PDF completo do dia
        </Button>
        <Button variant="outline" onClick={() => exportSaidasClientesPdf({ from: range.from, to: range.to })}>
          PDF das saídas
        </Button>
        <Button asChild>
          <Link to="/nova-saida">
            <Plus /> Nova saída
          </Link>
        </Button>
      </PageHeader>
      <PeriodFilter value={period} day={day} onChange={(k, d) => { setPeriod(k); setDay(d); }} />
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar produto, destino, pavilhão ou hora" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {phone ? (
            filtered.length === 0 ? (
              <EmptyState
                icon={Plus}
                title={q ? "Nada neste filtro" : "Nenhuma saída ainda"}
                description={q ? "Tente outro termo de busca." : "Registre a primeira expedição para começar o histórico."}
              >
                {!q ? (
                  <Button asChild>
                    <Link to="/nova-saida">Nova saída</Link>
                  </Button>
                ) : null}
              </EmptyState>
            ) : (
              <ul className="-mx-6 divide-y divide-border">
                {filtered.map((s) => (
                  <li key={s.id} data-toss-id={s.id} className="flex items-start gap-3 px-4 py-3">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setView(s)}>
                      <ProductLabel nome={s.mercadoria?.nome ?? "—"} codigo={s.mercadoria?.codigo} extra={`${formatDateBR(s.data)} · ${formatTime(s.hora_saida)} → ${formatTime(s.hora_chegada)}`} />
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        Saiu do {lugarDaSaida(pavilhoes, s)} → {destinoDaSaida(pavilhoes, s)}
                        {s.operador_nome ? ` · ${s.operador_nome}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                      {s.desconta_estoque === false ? (
                        <Badge variant="gold">
                          Sem baixa
                        </Badge>
                      ) : (
                        <Badge variant="muted">Baixa realizada</Badge>
                      )}
                      {isPavTransfer(s) ? <Badge variant="muted">Transferência</Badge> : null}
                      <Badge variant={statusOf(s) === "em_transito" ? "gold" : "muted"}>{statusLabel(statusOf(s))}</Badge>
                      </div>
                    </button>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatNumber(s.quantidade)} {s.unidade}
                      </p>
                      <div className="mt-1 flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Excluir saída" onClick={() => setPending(s)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Origem → Destino</TableHead>
                <TableHead>Saiu</TableHead>
                <TableHead>Chegou</TableHead>
                <TableHead>Empilhador</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-0">
                    <EmptyState
                      icon={Plus}
                      title={q ? "Nada neste filtro" : "Nenhuma saída ainda"}
                      description={q ? "Tente outro termo de busca." : "Registre a primeira expedição para começar o histórico."}
                    >
                      {!q ? (
                        <Button asChild>
                          <Link to="/nova-saida">Nova saída</Link>
                        </Button>
                      ) : null}
                    </EmptyState>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                <TableRow key={s.id} data-toss-id={s.id} className="cursor-pointer" onClick={() => setView(s)}>
                  <TableCell>
                    <div className="font-medium">{formatDateBR(s.data)}</div>
                    <div className="text-xs text-muted-foreground">{formatMinutes(s.tempo_transporte)}</div>
                  </TableCell>
                  <TableCell>
                    <ProductLabel nome={s.mercadoria?.nome ?? "—"} codigo={s.mercadoria?.codigo} />
                  </TableCell>
                  <TableCell>
                    {formatNumber(s.quantidade)} {s.unidade}
                  </TableCell>
                  <TableCell className="text-xs">
                    {lugarDaSaida(pavilhoes, s)} → {destinoDaSaida(pavilhoes, s)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">{formatTime(s.hora_saida)}</TableCell>
                  <TableCell className="text-xs tabular-nums">{formatTime(s.hora_chegada)}</TableCell>
                  <TableCell className="text-xs">{s.operador_nome || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {s.desconta_estoque === false ? (
                      <Badge variant="gold">Sem baixa</Badge>
                    ) : (
                      <Badge variant="muted">{estoqueLabel(s)}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusOf(s) === "em_transito" ? "gold" : "muted"}>{statusLabel(statusOf(s))}</Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Excluir saída" onClick={() => setPending(s)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <MovementDetail view={view} onClose={() => setView(null)} onEdit={openEdit} />

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[min(92dvh,48rem)]">
          <DialogHeader>
            <DialogTitle>Editar saída</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="eh-prod">Produto</Label>
              <ProductPicker
                inputId="eh-prod"
                listId="eh-prod-lista"
                inline
                items={mercadorias}
                value={mercadoriaId}
                onChange={(id) => setMercadoriaId(id)}
                placeholder="Busque o produto certo"
              />
              {edit ? (
                <p className="text-xs text-muted-foreground">
                  {lugarDaSaida(pavilhoes, edit)} → {destinoDaSaida(pavilhoes, edit)}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq">Quantidade</Label>
              <Input id="eq" type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} />
              {mercadorias.find((m) => m.id === mercadoriaId)?.unidade ? (
                <p className="text-xs text-muted-foreground">{mercadorias.find((m) => m.id === mercadoriaId)?.unidade}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="eh-s">Saiu às</Label>
                <TimeField id="eh-s" value={horaSaida} onChange={setHoraSaida} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eh-c">Chegou às</Label>
                <TimeField id="eh-c" value={horaChegada} onChange={setHoraChegada} />
              </div>
            </div>
            <NameRecall
              id="eh-op"
              label="Empilhador"
              value={operador}
              onChange={setOperador}
              names={live.listOperadores()}
              placeholder="Quem moveu"
            />
            <div className="space-y-2">
              <Label htmlFor="eh-obs">Observação</Label>
              <textarea
                id="eh-obs"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
                className="min-h-20 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label>Estoque</Label>
              <div className={cn("stock-mode-tabs", !desconta && "is-off")}>
                <span className="stock-mode-pill" aria-hidden />
                <button type="button" className={cn(desconta && "is-on")} onClick={() => setDesconta(true)}>
                  Descontar
                </button>
                <button type="button" className={cn(!desconta && "is-on")} onClick={() => setDesconta(false)}>
                  Não descontar
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending ? `Excluir saída de “${pending.mercadoria?.nome ?? "produto"}”?` : "Excluir saída"}
        description={
          pending?.desconta_estoque === false
            ? "Só o registro sai do histórico. O estoque não muda, porque esta saída não baixou quantidade."
            : isPavTransfer(pending)
              ? "O saldo volta ao pavilhão de origem e sai do destino. O total da empresa não muda."
              : "O estoque e o lote voltam ao saldo anterior. Você pode desfazer pelo aviso."
        }
        productName={pending?.mercadoria?.nome}
        mark="product"
        onConfirm={() => {
          if (!pending) return;
          tossAway(rowEl(pending.id));
          const snap = db.deleteSaida(pending.id);
          setTick((t) => t + 1);
          notify.success("Saída removida.", {
            action: snap
              ? {
                  label: "Desfazer",
                  onClick: () => {
                    db.restoreSaida(snap);
                    setTick((n) => n + 1);
                  },
                }
              : undefined,
          });
        }}
      />
    </PageStage>
  );
}
