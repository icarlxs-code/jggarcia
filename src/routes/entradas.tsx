import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/store";
import { useSession } from "@/lib/session";
import { pavTitle, lugarDaSaida } from "@/lib/catalog";
import { formatDateBR, formatNumber, formatTime, todayISO } from "@/lib/format";
import { useDb } from "@/lib/use-db";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ActionButton } from "@/components/motion/action-button";
import { ProductIcon, ProductLabel } from "@/components/inventory/product-icon";
import { StockSplit } from "@/components/inventory/stock-split";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { StockRiseOverlay, type StockRise } from "@/components/motion/stock-rise-overlay";
import { hydrateFromCloud } from "@/lib/store";
import { enterNext, focusFlow } from "@/lib/field-flow";
import { fold } from "@/lib/utils";
import { readUiPrefs } from "@/lib/ui-prefs";
import { rowEl, tossAway } from "@/lib/toss";
import type { Saida } from "@/lib/types";
import { PeriodFilter, periodRange, type PeriodKey } from "@/components/inventory/period-filter";
import { ViewSwitch, useChartView } from "@/components/analytics/view-switch";
import { ScreenCharts } from "@/components/analytics/screen-charts";

export const Route = createFileRoute("/entradas")({
  validateSearch: (s: Record<string, unknown>): { produto?: string; pav?: string } => ({
    produto: typeof s.produto === "string" ? s.produto : undefined,
    pav: typeof s.pav === "string" ? s.pav : undefined,
  }),
  component: Entradas,
});

function Entradas() {
  const { produto: produtoParam, pav: pavParam } = Route.useSearch();
  const { perfil } = useSession();
  const live = useDb();
  const [tick, setTick] = useState(0);
  const { vista } = useChartView("entradas");
  const mercadorias = useMemo(() => live.listMercadorias(true), [live, tick]);
  const pavilhoes = useMemo(() => live.listPavilhoes(), [live, tick]);
  const [busca, setBusca] = useState("");
  const [mercadoriaId, setMercadoriaId] = useState("");
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pavilhao, setPavilhao] = useState(() => readUiPrefs(db.getSessionUser()?.id).pavilhaoPadraoId);
  const [edit, setEdit] = useState<Saida | null>(null);
  const [qtd, setQtd] = useState("");
  const [editObs, setEditObs] = useState("");
  const [pending, setPending] = useState<Saida | null>(null);
  const [rise, setRise] = useState<StockRise | null>(null);
  const [period, setPeriod] = useState<PeriodKey>(() => readUiPrefs(db.getSessionUser()?.id).periodoPadrao);
  const [day, setDay] = useState(todayISO());
  const [span, setSpan] = useState({ from: todayISO(), to: todayISO() });

  const hoje = todayISO();
  const range = periodRange(period, day, span);
  const registros = useMemo(
    () => live.listSaidas({ tipo: "entrada", from: range.from, to: range.to }),
    [live, tick, range.from, range.to],
  );

  const filtradas = mercadorias
    .filter((m) => {
      const term = fold(busca.trim());
      if (!term) return true;
      const codigo = fold(m.codigo);
      return fold(m.nome).includes(term) || codigo.includes(term) || codigo.replace(/^0+/, "").includes(term.replace(/^0+/, ""));
    })
    .slice(0, 24);

  const merc = mercadorias.find((m) => m.id === mercadoriaId);

  function escolher(m: (typeof mercadorias)[number]) {
    setMercadoriaId(m.id);
    setBusca(`${m.codigo} · ${m.nome}`);
    setAberto(false);
  }

  useEffect(() => {
    if (!produtoParam) return;
    const m = mercadorias.find((x) => x.id === produtoParam || x.codigo === produtoParam);
    if (m) escolher(m);
  }, [produtoParam, mercadorias]);

  useEffect(() => {
    if (!pavParam) return;
    if (pavilhoes.some((p) => p.id === pavParam)) setPavilhao(pavParam);
  }, [pavParam, pavilhoes]);

  function limpar() {
    setQuantidade("");
    setObservacao("");
    setMercadoriaId("");
    setBusca("");
  }

  async function lancarEntrada() {
    if (!merc || !perfil) {
      toast.error("Selecione o produto.");
      return false;
    }
    if (!pavilhao) {
      toast.error("Escolha o pavilhão onde o produto vai entrar.");
      return false;
    }
    const n = Number(quantidade);
    if (!n || n <= 0) {
      toast.error("Informe a quantidade.");
      return false;
    }
    await hydrateFromCloud();
    const from = Number(merc.estoque || 0);
    const pav = pavilhoes.find((p) => p.id === pavilhao);
    db.createEntrada({
      data: todayISO(),
      origem: pav ? pavTitle(pav) : pavilhao,
      mercadoria_id: merc.id,
      quantidade: n,
      unidade: merc.unidade,
      destino_id: db.listDestinos()[0]?.id ?? "d1",
      hora_saida: new Date().toTimeString().slice(0, 5),
      hora_chegada: new Date().toTimeString().slice(0, 5),
      tempo_transporte: null,
      usuario_id: perfil.id,
      tipo: "entrada",
      pavilhao,
      pavilhao_id: pavilhao,
      observacao: observacao.trim() || undefined,
    });
    setRise({
      nome: merc.nome,
      unidade: merc.unidade,
      from,
      added: n,
      to: from + n,
    });
    limpar();
    setTick((t) => t + 1);
    return true;
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4" data-vista={vista}>
      <PageHeader clip="/lottie/caixa.json" title="Entrada do Ceasa" description="Produto, quantidade e o pavilhão ou galpão onde entra.">
        <ViewSwitch page="entradas" />
      </PageHeader>
      {mercadorias.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            clip="/lottie/caixa.json"
            title="Cadastre um produto primeiro"
            description="A entrada precisa de um item do catálogo."
          >
            <Button asChild>
              <Link to="/mercadorias">Ir para produtos</Link>
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nova entrada</CardTitle>
            <CardDescription>O estoque sobe na hora e o lançamento fica no histórico automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4" data-flow="entrada">
            <div className="space-y-2">
              <Label htmlFor="busca-prod">Produto</Label>
              <div className="relative">
                <Input
                  id="busca-prod"
                  value={busca}
                  onChange={(e) => {
                    const next = e.target.value;
                    setBusca(next);
                    setAberto(true);
                    setDestaque(0);
                    if (mercadoriaId) {
                      const atual = mercadorias.find((m) => m.id === mercadoriaId);
                      if (atual && next !== `${atual.codigo} · ${atual.nome}`) setMercadoriaId("");
                    }
                  }}
                  onFocus={() => setAberto(true)}
                  onBlur={() => window.setTimeout(() => setAberto(false), 140)}
                  data-step={1}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" && aberto && filtradas.length > 0) {
                      e.preventDefault();
                      setDestaque((n) => Math.min(n + 1, filtradas.length - 1));
                      return;
                    }
                    if (e.key === "ArrowUp" && aberto && filtradas.length > 0) {
                      e.preventDefault();
                      setDestaque((n) => Math.max(n - 1, 0));
                      return;
                    }
                    if (e.key === "Escape") {
                      setAberto(false);
                      return;
                    }
                    if (e.key !== "Enter" || e.shiftKey) return;
                    if (aberto && filtradas.length > 0) {
                      e.preventDefault();
                      escolher(filtradas[destaque] ?? filtradas[0]);
                    }
                    enterNext(e);
                  }}
                  placeholder="Digite o nome ou o código"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={aberto}
                  aria-controls="lista-produtos"
                />
                {aberto ? (
                  <ul
                    id="lista-produtos"
                    role="listbox"
                    className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-card"
                  >
                    {filtradas.length === 0 ? (
                      <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum produto com esse nome ou código.</li>
                    ) : (
                      filtradas.map((m, i) => (
                        <li key={m.id} role="option" aria-selected={m.id === mercadoriaId}>
                          <button
                            type="button"
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${i === destaque || m.id === mercadoriaId ? "bg-mint text-foreground" : "hover:bg-muted"}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setDestaque(i)}
                            onClick={() => escolher(m)}
                          >
                            <ProductLabel
                              nome={m.nome}
                              codigo={m.codigo}
                              extra={`${formatNumber(m.estoque)} ${m.unidade}`}
                              className="flex-1"
                            />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
              {merc ? <StockSplit mercadoriaId={merc.id} highlightId={pavilhao || undefined} delta={pavilhao ? Number(quantidade) || 0 : 0} /> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="qtd">Quantidade</Label>
                <Input id="qtd" data-step={2} type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} onKeyDown={(e) => enterNext(e)} />
              </div>
              <div className="space-y-2">
                <Label>Entra em</Label>
                <Select
                  value={pavilhao}
                  onValueChange={(id) => {
                    setPavilhao(id);
                    window.setTimeout(() => focusFlow(document.getElementById("qtd"), 4), 0);
                  }}
                >
                  <SelectTrigger id="entra-em" data-step={3} data-open-select="1">
                    <SelectValue placeholder="Pavilhão ou galpão" />
                  </SelectTrigger>
                  <SelectContent>
                    {pavilhoes.filter((p) => p.ativo).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {pavTitle(p)}
                        {merc ? ` · ${formatNumber(live.stockAt(merc.id, p.id))} ${merc.unidade}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs-entrada">Observação</Label>
              <textarea
                id="obs-entrada"
                data-step={4}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                onKeyDown={(e) => enterNext(e)}
                rows={3}
                placeholder="Anota o que precisar: palete, avaria, recado da expedição…"
                className="min-h-20 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!pavilhao) {
                    notify.error("Escolha o pavilhão para salvar o atalho.");
                    return;
                  }
                  try {
                    const row = db.createAtalho({
                      kind: "entrada",
                      origem_pavilhao_id: pavilhao,
                      mercadoria_id: mercadoriaId || undefined,
                    });
                    notify.success(`Atalho “${row.nome}” na lista de Hoje.`);
                  } catch (err) {
                    notify.error(err instanceof Error ? err.message : "Não foi possível salvar o atalho.");
                  }
                }}
              >
                Salvar atalho
              </Button>
              <ActionButton
                id="registrar-entrada"
                data-step={5}
                idleLabel="Registrar entrada"
                pendingLabel="Registrando"
                doneLabel="Entrada lançada"
                onAction={() => lancarEntrada()}
              />
            </div>
          </CardContent>
        </Card>

      {vista !== "lista" ? (
        <ScreenCharts screen="entradas" movs={registros} pavilhoes={pavilhoes} periodLabel={`${range.from.split("-").reverse().join("/")} a ${range.to.split("-").reverse().join("/")}`} />
      ) : null}

      <Card className="jg-lista lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100dvh-5.5rem)] lg:flex-col">
        <CardHeader>
          <CardTitle>Histórico de entradas</CardTitle>
          <CardDescription>Altere a quantidade, diminua ou desfaça um lançamento errado. O estoque se ajusta na hora.</CardDescription>
          <PeriodFilter allowRange value={period} day={day} span={span} onChange={(k, d, s) => { setPeriod(k); setDay(d); if (s) setSpan(s); }} />
        </CardHeader>
        <CardContent className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {registros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma entrada neste período.</p>
          ) : (
            <ul className="divide-y divide-border">
              {registros.map((s) => (
                <li
                  key={s.id}
                  data-toss-id={s.id}
                  data-ctx="entrada"
                  data-id={s.id}
                  data-produto={s.mercadoria_id}
                  data-nome={s.mercadoria?.nome ?? ""}
                  data-codigo={s.mercadoria?.codigo ?? ""}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <ProductIcon nome={s.mercadoria?.nome ?? ""} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] font-bold tabular-nums">{s.mercadoria?.codigo}</p>
                    <p className="truncate text-sm font-normal">{s.mercadoria?.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.data === hoje ? "Hoje" : formatDateBR(s.data)} · {formatTime(s.hora_chegada) || formatTime(s.hora_saida)} · entrou no {lugarDaSaida(pavilhoes, s)}
                    </p>
                    {s.observacao ? <p className="truncate text-[11px] text-muted-foreground">{s.observacao}</p> : null}
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatNumber(s.quantidade)} {s.unidade}
                  </p>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Alterar quantidade"
                      onClick={() => {
                        setEdit(s);
                        setQtd(String(s.quantidade));
                        setEditObs(s.observacao || "");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Desfazer entrada" onClick={() => setPending(s)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar entrada</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="eq-ent">{edit?.mercadoria?.nome}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQtd((v) => String(Math.max(0.01, (Number(v) || 0) - 1)))}
              >
                −
              </Button>
              <Input id="eq-ent" type="number" min={0.01} step="any" value={qtd} onChange={(e) => setQtd(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => setQtd((v) => String((Number(v) || 0) + 1))}>
                +
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Aumenta ou diminui as caixas. O estoque acompanha na hora.</p>
            <div className="space-y-2 pt-2">
              <Label htmlFor="eq-obs">Observação</Label>
              <textarea
                id="eq-obs"
                value={editObs}
                onChange={(e) => setEditObs(e.target.value)}
                rows={3}
                placeholder="Anota o que precisar: palete, avaria, recado da expedição…"
                className="min-h-20 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!edit) return;
                const n = Number(qtd);
                if (!n || n <= 0) {
                  notify.error("Quantidade inválida.");
                  return;
                }
                db.updateSaida(edit.id, { quantidade: n, observacao: editObs.trim() });
                setEdit(null);
                setTick((t) => t + 1);
                notify.success("Entrada atualizada.");
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending ? `Desfazer entrada de “${pending.mercadoria?.nome ?? "produto"}”?` : "Desfazer entrada"}
        description="A quantidade sai do estoque. Se foi engano, dá para recolocar no aviso."
        confirmLabel="Desfazer"
        productName={pending?.mercadoria?.nome}
        mark="product"
        onConfirm={() => {
          if (!pending) return;
          tossAway(rowEl(pending.id));
          const snap = db.deleteSaida(pending.id);
          setTick((t) => t + 1);
          notify.success("Entrada desfeita.", {
            action: snap
              ? {
                  label: "Recolocar",
                  onClick: () => {
                    db.restoreSaida(snap);
                    setTick((n) => n + 1);
                  },
                }
              : undefined,
          });
        }}
      />
      <StockRiseOverlay rise={rise} onDone={() => setRise(null)} />
    </div>
  );
}
