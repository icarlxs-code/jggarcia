import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardCheck, Pencil, Search } from "lucide-react";
import { useDb } from "@/lib/use-db";
import { db } from "@/lib/store";
import { buildTimeline, movementSearchBlob, qtyLine, statusLabel, tipoMovLabel, type TimelineItem } from "@/lib/movement";
import { calcTransportTime, completeTime, formatDateBR, formatNumber, isoDaysAgo, isValidTime, nowHHMM, todayISO } from "@/lib/format";
import { cn, fold } from "@/lib/utils";
import { notify } from "@/lib/notify";
import type { Saida } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { EmptyState } from "@/components/empty-state";
import { ProductLabel } from "@/components/inventory/product-icon";
import { MovementDetail } from "@/components/inventory/movement-detail";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TimeField } from "@/components/ui/time-field";
import { NameRecall } from "@/components/inventory/name-recall";
import { ProductPicker } from "@/components/inventory/product-picker";

export const Route = createFileRoute("/movimentacoes")({ component: Movimentacoes });

type KindFilter = "tudo" | "entrada" | "saida" | "transferencia" | "contagem";
type Period = "hoje" | "ontem" | "7d" | "tudo" | "periodo";

function Movimentacoes() {
  const live = useDb();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("tudo");
  const [period, setPeriod] = useState<Period>("hoje");
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(todayISO());
  const [view, setView] = useState<Saida | null>(null);
  const [arrive, setArrive] = useState<Saida | null>(null);
  const [horaChegada, setHoraChegada] = useState(nowHHMM);
  const [edit, setEdit] = useState<Saida | null>(null);
  const [qtd, setQtd] = useState("");
  const [horaSaida, setHoraSaida] = useState("");
  const [horaEditChegada, setHoraEditChegada] = useState("");
  const [desconta, setDesconta] = useState(true);
  const [operador, setOperador] = useState("");
  const [obs, setObs] = useState("");
  const [mercadoriaId, setMercadoriaId] = useState("");
  const saidas = live.listSaidas();
  const contagens = live.listContagens();
  const pavilhoes = live.listPavilhoes(true);
  const mercadorias = live.listMercadorias();
  const timeline = useMemo(() => buildTimeline(saidas, contagens, pavilhoes, mercadorias), [saidas, contagens, pavilhoes, mercadorias]);

  const filtered = useMemo(() => {
    const hoje = todayISO();
    const ontem = isoDaysAgo(1);
    const week = isoDaysAgo(7);
    return timeline.filter((item) => {
      if (kind !== "tudo" && item.tipo !== kind) return false;
      if (period === "hoje" && item.data !== hoje) return false;
      if (period === "ontem" && item.data !== ontem) return false;
      if (period === "7d" && item.data < week) return false;
      if (period === "periodo" && (item.data < from || item.data > to)) return false;
      const term = fold(q);
      if (!term) return true;
      return fold(movementSearchBlob(item)).includes(term);
    });
  }, [timeline, kind, period, q, from, to]);

  function openEdit(s: Saida) {
    setView(null);
    setEdit(s);
    setQtd(String(s.quantidade));
    setHoraSaida((s.hora_saida || "").slice(0, 5));
    setHoraEditChegada((s.hora_chegada || "").slice(0, 5));
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
    const hs = horaSaida.trim() ? completeTime(horaSaida) : "";
    const hc = horaEditChegada.trim() ? completeTime(horaEditChegada) : "";
    if (hs && !isValidTime(hs)) {
      notify.error("Hora de saída inválida.");
      return;
    }
    if (hc && !isValidTime(hc)) {
      notify.error("Hora de chegada inválida.");
      return;
    }
    const merc = mercadorias.find((m) => m.id === mercadoriaId);
    db.updateSaida(edit.id, {
      mercadoria_id: mercadoriaId,
      unidade: merc?.unidade || edit.unidade,
      quantidade: n,
      hora_saida: hs || null,
      hora_chegada: hc || null,
      tempo_transporte: hs && hc ? calcTransportTime(hs, hc) : null,
      desconta_estoque: desconta,
      operador_nome: operador.trim() || "",
      observacao: obs.trim() || "",
    });
    setEdit(null);
    notify.success("Movimentação atualizada.");
  }

  function openItem(item: TimelineItem) {
    if (item.saida) setView(item.saida);
  }

  return (
    <PageStage className="space-y-4">
      <PageHeader
        icon="log"
        title="Movimentações"
        description="Entradas, saídas, transferências e contagens em uma linha do tempo."
      />
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-10"
          placeholder="Buscar produto, código, cliente, pavilhão ou movimentação..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {(["tudo", "entrada", "saida", "transferencia", "contagem"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "h-9 rounded-full border px-3 text-xs font-semibold",
              kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
            )}
          >
            {k === "tudo" ? "Tudo" : tipoMovLabel(k)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {([
          ["hoje", "Hoje"],
          ["ontem", "Ontem"],
          ["7d", "Últimos 7 dias"],
          ["periodo", "Período"],
          ["tudo", "Período todo"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPeriod(id)}
            className={cn(
              "h-9 rounded-full border px-3 text-xs font-medium",
              period === id ? "border-gold bg-gold/15 text-gold-ink" : "border-border bg-card text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {period === "periodo" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-40" />
          </div>
        </div>
      ) : null}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="Nada neste filtro"
              description="Registre uma entrada ou uma saída para aparecer aqui."
            >
              <Button asChild>
                <Link to="/nova-saida">Nova saída</Link>
              </Button>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((item) => (
                <li key={item.id}>
                  <button type="button" className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40" onClick={() => openItem(item)}>
                    <KindMark tipo={item.tipo} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {formatDateBR(item.data)} · {item.hora} · {tipoMovLabel(item.tipo)}
                      </p>
                      <ProductLabel nome={item.titulo} extra={qtyLine(item.quantidade, item.unidade)} />
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {item.detalhe}
                        {item.empilhador ? ` · ${item.empilhador}` : ""}
                        {item.usuario ? ` · ${item.usuario}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.status ? <Badge variant={item.status === "em_transito" ? "gold" : "muted"}>{statusLabel(item.status)}</Badge> : null}
                        {item.desconta === false && item.tipo !== "entrada" && item.tipo !== "contagem" ? <Badge variant="gold">Somente registro</Badge> : null}
                      </div>
                    </div>
                    {item.quantidade != null ? (
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatNumber(item.quantidade)} {item.unidade}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <MovementDetail
        view={view}
        onClose={() => setView(null)}
        onEdit={openEdit}
        onArrive={(s) => {
          setView(null);
          setArrive(s);
          setHoraChegada(nowHHMM());
        }}
      />
      <Dialog open={!!arrive} onOpenChange={(o) => !o && setArrive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar chegada</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Hora de chegada</Label>
            <TimeField value={horaChegada} onChange={setHoraChegada} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArrive(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!arrive) return;
                try {
                  db.markChegada(arrive.id, horaChegada);
                  notify.success("Chegada registrada. Status: entregue.");
                  setArrive(null);
                } catch (err) {
                  notify.error(err instanceof Error ? err.message : "Não foi possível marcar a chegada.");
                }
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[min(92dvh,48rem)]">
          <DialogHeader>
            <DialogTitle>Editar movimentação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="mov-prod">Produto</Label>
              <ProductPicker
                inputId="mov-prod"
                listId="mov-prod-lista"
                inline
                items={mercadorias}
                value={mercadoriaId}
                onChange={(id) => setMercadoriaId(id)}
                placeholder="Busque o produto certo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mq">Quantidade</Label>
              <Input id="mq" type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Saiu às</Label>
                <TimeField value={horaSaida} onChange={setHoraSaida} />
              </div>
              <div className="space-y-2">
                <Label>Chegou às</Label>
                <TimeField value={horaEditChegada} onChange={setHoraEditChegada} />
              </div>
            </div>
            <NameRecall
              id="mov-op"
              label="Empilhador"
              value={operador}
              onChange={setOperador}
              names={live.listOperadores()}
              placeholder="Quem moveu"
            />
            <div className="space-y-2">
              <Label htmlFor="mov-obs">Observação</Label>
              <textarea
                id="mov-obs"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
                className="min-h-20 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {(edit?.tipo ?? "saida") !== "entrada" ? (
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
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>
              <Pencil className="h-4 w-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageStage>
  );
}

function KindMark({ tipo }: { tipo: TimelineItem["tipo"] }) {
  const cls = "mt-0.5 h-4 w-4 text-muted-foreground";
  if (tipo === "entrada") return <ArrowDownToLine className={cls} />;
  if (tipo === "transferencia") return <ArrowLeftRight className={cls} />;
  if (tipo === "contagem") return <ClipboardCheck className={cls} />;
  return <ArrowUpFromLine className={cls} />;
}
