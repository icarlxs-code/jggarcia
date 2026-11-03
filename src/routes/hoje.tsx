import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, FileText, Search } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { useSession } from "@/lib/session";
import { destinoDaSaida, isPavTransfer, lugarDaSaida } from "@/lib/catalog";
import { statusLabel, statusOf, tipoMovimentacaoOf } from "@/lib/movement";
import { MovementDetail } from "@/components/inventory/movement-detail";
import { formatDateBR, formatNumber, todayISO } from "@/lib/format";
import { PeriodFilter, periodRange, type PeriodKey } from "@/components/inventory/period-filter";
import { notify } from "@/lib/notify";
import { exportDiaCompletoPdf } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fold, cn } from "@/lib/utils";
import { PageStage } from "@/components/motion/page-stage";
import { KpiMark, type KpiKind } from "@/components/motion/kpi-mark";
import { Spark } from "@/components/motion/live-gears";
import { countsByHour } from "@/lib/dashboard-stats";
import { MOTION } from "@/lib/motion";
import { Badge } from "@/components/ui/badge";
import { ProductIcon } from "@/components/inventory/product-icon";
import { ViewSwitch, useChartView } from "@/components/analytics/view-switch";
import { ScreenCharts } from "@/components/analytics/screen-charts";
import { CountUp } from "@/components/motion/count-up";
import { useRowUpdates } from "@/lib/use-row-updates";

import { useAnimatedList } from "@/lib/use-animated-list";

export const Route = createFileRoute("/hoje")({ component: Hoje });

function Hoje() {
  const listaRef = useAnimatedList();
  const live = useDb();
  const { perfil, isAdmin } = useSession();
  const hoje = todayISO();
  const [period, setPeriod] = useState<PeriodKey>("hoje");
  const [day, setDay] = useState(hoje);
  const [span, setSpan] = useState({ from: hoje, to: hoje });
  const range = periodRange(period, day, span);
  const pavilhoes = live.listPavilhoes();
  const movs = live.listSaidas({ from: range.from, to: range.to });
  const changed = useRowUpdates(live.listSaidas());
  const entradas = movs.filter((s) => (s.tipo ?? "saida") === "entrada");
  const saidas = movs.filter((s) => (s.tipo ?? "saida") === "saida");

  const [qMov, setQMov] = useState("");
  const [view, setView] = useState<(typeof movs)[number] | null>(null);
  const { vista } = useChartView("hoje");
  const transito = saidas.filter((s) => statusOf(s) === "em_transito").length;
  const produtosMov = new Set(movs.map((s) => s.mercadoria_id)).size;
  const semCatalogo = live.listMercadorias(true).length === 0;
  const contagens = live.listContagens().filter((c) => c.data >= range.from && c.data <= range.to);
  const contagensHoje = contagens.length;
  const shownMovs = useMemo(() => {
    const term = fold(qMov.trim());
    if (!term) return movs;
    return movs.filter((s) => fold(`${s.mercadoria?.nome ?? ""} ${s.mercadoria?.codigo ?? ""}`).includes(term));
  }, [movs, qMov]);

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

  const umDia = range.from === range.to;
  const eHoje = umDia && range.from === hoje;
  const periodoTxt = umDia ? formatDateBR(range.from) : `${formatDateBR(range.from)} a ${formatDateBR(range.to)}`;
  const hour = new Date().getHours();
  const saudacao = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const nome = perfil?.nome?.split(" ")[0] || "Administrador";

  return (
    <PageStage className="space-y-6">
      <div className="page-hero hoje-banner">
        <div className="hoje-banner-copy">
          <h1 className="page-title">
            {saudacao}, {nome}
          </h1>
          <p className="page-desc hoje-date">{eHoje ? `Operação de hoje · ${periodoTxt}` : periodoTxt}</p>
        </div>
        <div className="hoje-banner-tools page-actions" role="group" aria-label="Ações da página">
          {isAdmin ? <><Button asChild variant="outline"><Link to="/entradas">Registrar entrada</Link></Button><Button asChild><Link to="/nova-saida">Nova saída</Link></Button></> : null}
          {umDia ? (
            <ActionMenu label="Exportar"><DropdownMenuItem onSelect={() => exportDiaCompletoPdf(range.from)}><FileText />PDF do dia</DropdownMenuItem></ActionMenu>
          ) : null}
        </div>
      </div>

      <PeriodFilter
        allowRange
        value={period}
        day={day}
        span={span}
        onChange={(key, nextDay, nextSpan) => {
          setPeriod(key);
          setDay(nextDay);
          if (nextSpan) setSpan(nextSpan);
        }}
      />

      <section className="hoje-kpis grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Indicadores do período">
        <Kpi kind="in" label={eHoje ? "Entradas hoje" : "Entradas"} value={entradas.length} hint="lançamentos" series={countsByHour(entradas.map((s) => s.hora_saida || s.created_at))} />
        <Kpi kind="out" label={eHoje ? "Saídas hoje" : "Saídas"} value={saidas.length} hint="lançamentos" series={countsByHour(saidas.map((s) => s.hora_saida || s.created_at))} />
        <Kpi
          kind="go"
          label="Em trânsito"
          value={transito}
          hint="lançamentos"
          series={countsByHour(saidas.filter((s) => statusOf(s) === "em_transito").map((s) => s.hora_saida || s.created_at))}
        />
        <Kpi kind="move" label="Produtos movimentados" value={produtosMov} hint="produtos" series={countsByHour(firstProductHour(movs))} />
        <Kpi kind="count" label="Contagens" value={contagensHoje} hint="realizadas" series={countsByHour(contagens.map((c) => c.created_at))} />
      </section>

      {transito > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/30 bg-gold/10 p-4" role="status">
          <KpiMark kind="go" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {transito} {transito === 1 ? "lançamento" : "lançamentos"} em trânsito
            </p>
            <p className="text-xs text-muted-foreground">Saídas deste período que ainda não registraram chegada.</p>
          </div>
          <Button asChild variant="outline" className="sm:ml-auto"><Link to="/movimentacoes" search={{ periodo: eHoje ? "hoje" : "tudo", tipo: "transferencia" }}>Conferir chegadas</Link></Button>
        </div>
      ) : null}

      {movs.length === 0 ? (
        semCatalogo ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-4 sm:flex-row sm:items-center">
            <KpiMark kind="in" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Nenhum produto cadastrado</p>
              <p className="mt-0.5 text-sm text-muted-foreground">O catálogo precisa existir antes da primeira entrada.</p>
            </div>
            {isAdmin ? (
              <Button asChild className="sm:ml-auto">
                <Link to="/mercadorias">Cadastrar produto</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="hoje-empty flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-4 sm:flex-row sm:items-center">
            <KpiMark kind="in" className="is-intro" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Nenhuma movimentação em {periodoTxt}. Escolha outro dia ou registre a primeira entrada.</p>
            </div>
            {isAdmin ? (
              <Button asChild className="sm:ml-auto">
                <Link to="/entradas">Registrar entrada</Link>
              </Button>
            ) : null}
          </div>
        )
      ) : null}

      <div className="flex justify-end">
        <ViewSwitch page="hoje" />
      </div>

      {vista !== "graficos" ? (
      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{eHoje ? "Movimentações de hoje" : `Movimentações · ${periodoTxt}`}</h2>
            <p className="text-xs text-muted-foreground">
              {qMov.trim()
                ? `${shownMovs.length} de ${movs.length}`
                : `${movs.length} ${movs.length === 1 ? "lançamento" : "lançamentos"}`}
              {" · mais recente primeiro"}
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={qMov}
                onChange={(e) => setQMov(e.target.value)}
                placeholder="Buscar produto movimentado"
                className="h-9 pl-8"
                aria-label="Buscar produto nas movimentações de hoje"
              />
            </div>
            {qMov.trim() ? (
              <Button type="button" variant="ghost" className="h-9 shrink-0" onClick={() => setQMov("")}>
                Limpar busca
              </Button>
            ) : null}
          </div>
        </div>
        {movs.length > 0 && shownMovs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum resultado para “{qMov.trim()}”.
            <button type="button" className="ml-1 font-medium text-foreground underline-offset-2 hover:underline" onClick={() => setQMov("")}>
              Limpar busca
            </button>
          </p>
        ) : shownMovs.length > 0 ? (
          <ul ref={listaRef} className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {shownMovs.map((s) => {
              const tipo = tipoMovimentacaoOf(s);
              const accent = tipo === "entrada" ? "bg-primary" : tipo === "transferencia" ? "bg-foreground/25" : "bg-gold";
              return (
                <li key={s.id} className={cn("min-w-0 rounded-xl", changed.has(s.id) && "row-updated")}>
                  <article className="flex h-full overflow-hidden rounded-xl border border-border bg-card">
                    <div className={`w-1 shrink-0 ${accent}`} />
                    <button
                      type="button"
                      data-ctx={tipo === "entrada" ? "entrada" : "saida"}
                      data-id={s.id}
                      data-produto={s.mercadoria_id}
                      data-nome={s.mercadoria?.nome ?? ""}
                      data-codigo={s.mercadoria?.codigo ?? ""}
                      className="hoje-mov min-w-0 flex-1 rounded-none p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setView(s)}
                    >
                      <div className="flex items-start gap-2">
                        <ProductIcon nome={s.mercadoria?.nome ?? "Produto"} codigo={s.mercadoria?.codigo} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {s.hora_saida || s.created_at.slice(11, 16)} · {tipo === "entrada" ? "Entrada" : tipo === "transferencia" ? "Transferência" : "Saída"}
                            {s.mercadoria?.codigo ? ` · ${s.mercadoria.codigo}` : ""}
                          </p>
                          <p className="truncate text-sm font-medium leading-tight">{s.mercadoria?.nome ?? "Produto"}</p>
                          <p className="mt-1 text-base font-semibold tabular-nums">{formatNumber(s.quantidade)} <span className="text-xs font-normal text-muted-foreground">{s.unidade}</span></p>
                          <p className="truncate text-xs text-muted-foreground">
                            {tipo === "entrada" ? lugarDaSaida(pavilhoes, s) : `${lugarDaSaida(pavilhoes, s)} → ${destinoDaSaida(pavilhoes, s)}`}
                            {s.operador_nome ? ` · ${s.operador_nome}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {tipo === "entrada" ? <Badge variant="success">Entrada</Badge> : tipo === "transferencia" ? <Badge variant="muted">Transferência</Badge> : <Badge variant="gold">Saída</Badge>}
                        {s.desconta_estoque === false ? <Badge variant="gold">Somente registro</Badge> : null}
                        {tipo !== "entrada" ? <Badge variant="muted">{statusLabel(statusOf(s))}</Badge> : null}
                      </div>
                    </button>
                    <Button variant="ghost" size="icon" className="mt-1 mr-1 h-10 w-10 shrink-0" aria-label="Salvar atalho" onClick={() => pinFromMov(s)}>
                      <Bookmark className="h-3.5 w-3.5" />
                    </Button>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
      ) : null}

      {vista !== "lista" ? <section className="space-y-3"><h2 className="text-lg font-semibold">Análise do período</h2><ScreenCharts screen="hoje" movs={movs} contagens={contagens} produtos={live.listMercadorias(true)} pavilhoes={pavilhoes} periodLabel={periodoTxt} /></section> : null}

      <MovementDetail view={view} onClose={() => setView(null)} />
    </PageStage>
  );
}

function firstProductHour(movs: { mercadoria_id: string; hora_saida?: string | null; created_at: string }[]) {
  const seen = new Set<string>();
  const stamps: string[] = [];
  const ordered = [...movs].sort((a, b) => (a.hora_saida || a.created_at).localeCompare(b.hora_saida || b.created_at));
  for (const s of ordered) {
    if (seen.has(s.mercadoria_id)) continue;
    seen.add(s.mercadoria_id);
    stamps.push(s.hora_saida || s.created_at);
  }
  return stamps;
}

function Kpi({ kind, label, value, hint, series }: { kind: KpiKind; label: string; value: number; hint: string; series: number[] }) {
  const live = value > 0;
  const [fresh, setFresh] = useState(false);
  const prev = useRef(value);
  const tone = kind === "in" ? "in" : kind === "out" ? "out" : kind === "go" ? "go" : kind === "count" ? "count" : "move";

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setFresh(true);
    const timer = window.setTimeout(() => setFresh(false), MOTION.duration.icon);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <Card className={cn("hoje-kpi", `is-${kind}`, live && "is-live", fresh && "is-fresh")}>
      <CardContent className="flex h-full flex-col p-5">
        <p className="text-[0.8125rem] font-medium leading-tight text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="kpi-figure leading-none">
            <CountUp value={value} />
          </p>
          <Spark values={series} tone={tone} label={`${label}: o traço reparte ${value.toLocaleString("pt-BR")} ${hint} pelas horas do dia`} />
        </div>
        <div className="mt-auto pt-2">
            <p className="text-xs text-muted-foreground">{hint}</p>
            {kind === "go" ? (
              <Link to="/movimentacoes" search={{ periodo: "hoje", tipo: "transferencia" }} className="mt-1 inline-block text-xs font-medium underline-offset-2 hover:underline">
                Ver registros
              </Link>
            ) : (
              <Link to={kind === "in" ? "/entradas" : kind === "out" ? "/historico" : kind === "count" ? "/contagem" : "/movimentacoes"} search={kind === "move" ? { periodo: "hoje" } : undefined} className="mt-1 inline-block text-xs font-medium underline-offset-2 hover:underline">
                Ver registros
              </Link>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
