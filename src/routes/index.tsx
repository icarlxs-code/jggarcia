import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  ClipboardCheck,
  PackagePlus,
  Warehouse,
} from "lucide-react";
import { loteStatus, stockAlert } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { formatNumber, formatTime, isoDaysAgo, pad2, todayISO } from "@/lib/format";
import { useSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionMenu } from "@/components/ui/action-menu";
import { DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { ViewSwitch, useChartView } from "@/components/analytics/view-switch";
import { ScreenCharts } from "@/components/analytics/screen-charts";
import { OperationRadar, StockHealthGauge } from "@/components/analytics/dash-widgets";
import {
  BubbleShare,
  DeltaPill,
  FlowBars,
  NovaKpi,
  NvCard,
  PERIODOS,
  PeriodTabs,
  Sparkline,
  TopBars,
  destinoMix,
  greeting,
  longDate,
  pctChange,
  periodRange,
  periodoComDados,
  topSaidas,
  useBuckets,
  type Periodo,
} from "@/components/analytics/nova-dash";
import { NameMark } from "@/components/brand/name-mark";
import { Warehouse3D, type PavilionStack } from "@/components/three/lazy";
import { usePrefersReducedMotion } from "@/lib/motion";
import { CountUp } from "@/components/motion/count-up";
import { ModuleTile } from "@/components/brand/module-tile";
import type { ModuleId } from "@/lib/modules";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { ProductIcon, ProductLabel } from "@/components/inventory/product-icon";
import { StockBadge } from "@/components/inventory/stock-badge";
import { destinoDaSaida, lugarDaSaida } from "@/lib/catalog";
import { tipoMovimentacaoOf } from "@/lib/movement";
import { MovementDetail } from "@/components/inventory/movement-detail";
import type { Saida } from "@/lib/types";

import { useAnimatedList } from "@/lib/use-animated-list";

export const Route = createFileRoute("/")({ component: Dashboard });

/** Which module each headline number belongs to. */
const KPI_MODULE: Record<string, ModuleId> = { estoque: "estoque", skus: "produtos", entradas: "entradas", saidas: "saidas", critico: "estoque" };

function unitShort(unidade: string) {
  const n = (unidade || "").trim().toLowerCase();
  if (n === "kg" || n.startsWith("quilo")) return "kg";
  if (n.startsWith("caixa")) return "cx";
  if (n.startsWith("bandeja")) return "bdj";
  if (n.startsWith("unidade") || n === "un") return "un";
  if (n.startsWith("saco")) return "sc";
  if (n.startsWith("pacote")) return "pct";
  if (n.startsWith("litro") || n === "l") return "L";
  if (n.startsWith("dúzia") || n.startsWith("duzia")) return "dz";
  if (n.startsWith("maço") || n.startsWith("maco")) return "maço";
  return unidade || "un";
}

function mixByUnit(rows: { unidade?: string; quantidade?: number; estoque?: number }[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const q = Number(row.quantidade ?? row.estoque ?? 0);
    if (!q) continue;
    const key = row.unidade?.trim() || "Unidade";
    map.set(key, (map.get(key) || 0) + q);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
}

function Dashboard() {
  const baixosRef = useAnimatedList();
  const listaRef = useAnimatedList<HTMLTableSectionElement>();
  const db = useDb();
  const { perfil } = useSession();
  const lite = usePrefersReducedMotion();
  const { vista } = useChartView("inicio");
  const [view, setView] = useState<Saida | null>(null);
  const produtos = db.listMercadorias();
  const lotes = db.listLotes();
  const movs = db.listSaidas();
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoComDados(movs));
  const pavilhoes = db.listPavilhoes();
  const empty = produtos.length === 0 && movs.length === 0;

  const stats = useMemo(() => {
    const hoje = todayISO();
    const entradasHoje = movs.filter((m) => m.data === hoje && m.tipo === "entrada");
    const saidasHoje = movs.filter((m) => m.data === hoje && (m.tipo ?? "saida") === "saida");
    const ontem = isoDaysAgo(1);
    const entradasOntem = movs.filter((m) => m.data === ontem && m.tipo === "entrada").length;
    const saidasOntem = movs.filter((m) => m.data === ontem && (m.tipo ?? "saida") === "saida").length;
    const aVencer = lotes.filter((l) => loteStatus(l.validade) !== "ok").length;
    const comEstoque = produtos.filter((p) => p.estoque > 0);
    const semana = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      return {
        name: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`,
        entradas: movs.filter((m) => m.data === iso && m.tipo === "entrada").length,
        saidas: movs.filter((m) => m.data === iso && (m.tipo ?? "saida") === "saida").length,
      };
    });
    const baixos = produtos
      .map((p) => ({ p, alert: stockAlert(p) }))
      .filter((x) => x.alert !== "ok")
      .sort((a, b) => a.p.estoque - b.p.estoque)
      .slice(0, 5);
    const criticos = produtos.filter((p) => stockAlert(p) === "critico").length;
    const zerados = produtos.filter((p) => p.estoque <= 0).length;
    return {
      entradasN: entradasHoje.length,
      entradasOntem,
      saidasOntem,
      saidasN: saidasHoje.length,
      aVencer,
      estoqueMix: mixByUnit(comEstoque),
      inMix: mixByUnit(entradasHoje),
      outMix: mixByUnit(saidasHoje),
      semana,
      baixos,
      criticos,
      zerados,
    };
  }, [produtos, lotes, movs]);

  const buckets = useBuckets(movs, periodo);
  const painel = useMemo(() => {
    const r = periodRange(periodo);
    const cur = movs.filter((m) => m.data >= r.from && m.data <= r.to);
    const ent = cur.filter((m) => tipoMovimentacaoOf(m) === "entrada");
    const sai = cur.filter((m) => tipoMovimentacaoOf(m) !== "entrada");
    const before = movs.filter((m) => m.data >= r.prevFrom && m.data <= r.prevTo);
    const biggest = (rows: Saida[]) => [...mixByUnit(rows)].sort((a, b) => b[1] - a[1])[0] ?? null;
    return {
      ...r,
      entradas: ent.length,
      saidas: sai.length,
      entradasAntes: before.filter((m) => tipoMovimentacaoOf(m) === "entrada").length,
      saidasAntes: before.filter((m) => tipoMovimentacaoOf(m) !== "entrada").length,
      inVol: biggest(ent),
      outVol: biggest(sai),
    };
  }, [movs, periodo]);
  const destinos = useMemo(() => destinoMix(movs, painel.from, painel.to), [movs, painel.from, painel.to]);
  const top = useMemo(() => topSaidas(movs, produtos, painel.from, painel.to), [movs, produtos, painel.from, painel.to]);

  const pavStacks = useMemo<PavilionStack[]>(() => {
    const rows = new Map<string, PavilionStack>();
    for (const pav of pavilhoes) rows.set(pav.id, { id: pav.id, nome: pav.nome, total: 0, produtos: 0, top: [] });
    for (const p of produtos) {
      if (!p.status || p.estoque <= 0) continue;
      for (const pos of db.stockPositions(p.id)) {
        const row = rows.get(pos.id);
        if (!row || pos.quantidade <= 0) continue;
        row.total += pos.quantidade;
        row.produtos += 1;
        row.top.push({ nome: p.nome, quantidade: pos.quantidade, cor: p.cor || "#3d9a68" });
      }
    }
    return [...rows.values()].map((r) => ({ ...r, top: r.top.sort((a, b) => b.quantidade - a.quantidade).slice(0, 6) }));
  }, [db, produtos, pavilhoes]);

  const primeiroNome = (perfil?.nome || "").trim().split(/\s+/)[0] || "equipe";
  const periodoInfo = PERIODOS.find((p) => p.id === periodo)!;
  const versus = periodo === "365" ? "vs 12 meses anteriores" : `vs ${periodo} dias anteriores`;
  const ultimo = movs.reduce((a, m) => (m.data > a ? m.data : a), "");

  return (
    <PageStage className="nv-page space-y-5" data-vista={vista}>
      <section className="nv-hero">
        <div className="min-w-0">
          <p className="nv-hero-date">
            <span className="nv-live"><i /> Ao vivo</span>
            {longDate()}
          </p>
          <h1 className="nv-hero-title">
            {greeting()}, <span className="nv-hero-name">{primeiroNome}</span>
          </h1>
          <p className="nv-hero-sub">
            Visão geral da operação · {periodoInfo.longo}
            {ultimo && ultimo !== todayISO() ? ` · último lançamento em ${ultimo.slice(8, 10)}/${ultimo.slice(5, 7)}` : ""}
          </p>
        </div>
        <div className="nv-hero-actions">
          <PeriodTabs value={periodo} onChange={setPeriodo} />
          <ViewSwitch page="inicio" />
          <ActionMenu>
            <DropdownMenuLabel>Operação</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link to="/contagem"><ClipboardCheck />Contagem</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/entradas"><ArrowDownToLine />Registrar entrada</Link></DropdownMenuItem>
          </ActionMenu>
          <Button asChild className="nv-cta">
            <Link to="/nova-saida">
              <ArrowUpFromLine /> Nova saída
            </Link>
          </Button>
        </div>
      </section>

      {empty ? (
        <div className="grid gap-3 md:grid-cols-3">
          <StartCard step="1" title="Cadastre produtos" body="O catálogo é a base do estoque e das movimentações." to="/mercadorias" cta="Abrir produtos" icon={PackagePlus} />
          <StartCard step="2" title="Registre uma entrada" body="Chegada do Ceasa gera lote, validade e posição de estoque." to="/entradas" cta="Nova entrada" icon={ArrowDownToLine} />
          <StartCard step="3" title="Expeça uma saída" body="A expedição baixa estoque e fica no log de alterações." to="/nova-saida" cta="Nova saída" icon={ArrowUpFromLine} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <NovaKpi
          label="Entradas"
          module="entradas"
          value={painel.entradas}
          unit={painel.entradas === 1 ? "lançamento" : "lançamentos"}
          delta={pctChange(painel.entradas, painel.entradasAntes)}
          extra={painel.inVol ? `${formatNumber(painel.inVol[1])} ${unitShort(painel.inVol[0])} recebidos` : "Nada recebido no período"}
          spark={<Sparkline key={periodo} values={buckets.cur.map((b) => b.entradas)} label="Entradas no período" />}
          foot={versus}
          to="/entradas"
        />
        <NovaKpi
          label="Saídas"
          module="saidas"
          value={painel.saidas}
          unit={painel.saidas === 1 ? "lançamento" : "lançamentos"}
          delta={pctChange(painel.saidas, painel.saidasAntes)}
          extra={painel.outVol ? `${formatNumber(painel.outVol[1])} ${unitShort(painel.outVol[0])} expedidos` : "Nada expedido no período"}
          spark={<Sparkline key={periodo} values={buckets.cur.map((b) => b.saidas)} tone="warm" label="Saídas no período" />}
          tone="warm"
          foot={versus}
          to="/historico"
        />
        <NovaKpi
          label="Estoque total"
          module="estoque"
          value={stats.estoqueMix[0]?.[1] ?? 0}
          decimals={Number.isInteger(stats.estoqueMix[0]?.[1] ?? 0) ? 0 : 3}
          unit={stats.estoqueMix[0] ? unitShort(stats.estoqueMix[0][0]) : undefined}
          extra={
            stats.estoqueMix.length > 1
              ? stats.estoqueMix.slice(1).map(([u, q]) => `${formatNumber(q)} ${unitShort(u)}`).join(" · ")
              : `${produtos.filter((p) => p.status).length} produtos ativos`
          }
          spark={<UnitBar mix={stats.estoqueMix} />}
          foot={`${produtos.filter((p) => p.status && p.estoque > 0).length} produtos com saldo agora`}
          to="/estoque"
        />
        <NovaKpi
          label="Em alerta"
          module="estoque"
          value={stats.criticos + stats.zerados}
          unit={stats.criticos + stats.zerados === 1 ? "produto" : "produtos"}
          warn={stats.criticos + stats.zerados + stats.aVencer > 0}
          extra={`${stats.criticos} crítico${stats.criticos === 1 ? "" : "s"} · ${stats.zerados} zerado${stats.zerados === 1 ? "" : "s"}`}
          spark={<AlertDots criticos={stats.criticos} zerados={stats.zerados} lotes={stats.aVencer} />}
          tone="danger"
          foot={`${stats.aVencer} ${stats.aVencer === 1 ? "lote vence" : "lotes vencem"} em breve`}
          to="/estoque"
        />
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <NvCard
          className="xl:col-span-2"
          data-ctx="kpi"
          data-id="grafico"
          data-nome="Fluxo de lançamentos"
          title="Fluxo de lançamentos"
          sub={
            <>
              <strong className="nv-big-inline"><CountUp value={painel.entradas + painel.saidas} /></strong> movimentos nos {periodoInfo.longo}
              <DeltaPill pct={pctChange(painel.entradas + painel.saidas, painel.entradasAntes + painel.saidasAntes)} />
            </>
          }
          action={
            <div className="nv-legend-inline">
              <span><i className="nv-dot is-a" /> Entradas</span>
              <span><i className="nv-dot is-hatch" /> Saídas</span>
            </div>
          }
        >
          {movs.length === 0 ? (
            <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">Sem movimentação ainda.</p>
          ) : (
            <FlowBars key={periodo} data={buckets.cur} />
          )}
        </NvCard>

        <NvCard title="Para onde foram as saídas" sub={`Por tipo de destino · ${periodoInfo.longo}`} data-ctx="kpi" data-id="destinos" data-nome="Destino das saídas">
          {destinos.total === 0 ? (
            <p className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">Nenhuma saída no período.</p>
          ) : (
            <BubbleShare
              key={periodo}
              total={destinos.total}
              items={[
                { label: "Clientes", value: destinos.clientes, tone: "a" },
                { label: "Transferências", value: destinos.transf, tone: "b" },
                { label: "Sem destino", value: destinos.semDestino, tone: "c" },
              ]}
            />
          )}
        </NvCard>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <NvCard
          className="xl:col-span-2"
          title="Últimas movimentações"
          sub="Os 8 lançamentos mais recentes · clique para ver o detalhe"
          action={<Link to="/movimentacoes" className="nv-link">Ver todas</Link>}
        >
          {movs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma entrada ou saída registrada.</p>
          ) : (
            <div className="nv-table-wrap">
              <table className="nv-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Tipo</th>
                    <th className="max-md:hidden">Rota</th>
                    <th className="text-right">Qtd.</th>
                    <th className="max-lg:hidden">Responsável</th>
                    <th className="text-right">Quando</th>
                  </tr>
                </thead>
                <tbody ref={listaRef}>
                  {movs.slice(0, 8).map((s) => {
                    const tipo = tipoMovimentacaoOf(s);
                    const quem = s.usuario?.nome || s.operador_nome || "";
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setView(s)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setView(s);
                        }}
                      >
                        <td>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <ProductIcon nome={s.mercadoria?.nome || "?"} codigo={s.mercadoria?.codigo} size="sm" className="shrink-0" />
                            <span className="truncate font-medium">{s.mercadoria?.nome}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`nv-pill is-${tipo}`}>
                            {tipo === "entrada" ? "Entrada" : tipo === "transferencia" ? "Transferência" : "Saída"}
                          </span>
                          {s.desconta_estoque === false ? <span className="nv-pill is-note ml-1">Só registro</span> : null}
                        </td>
                        <td className="max-md:hidden">
                          <span className="block max-w-[14rem] truncate text-muted-foreground">
                            {tipo === "entrada" ? lugarDaSaida(pavilhoes, s) : `${lugarDaSaida(pavilhoes, s)} → ${destinoDaSaida(pavilhoes, s)}`}
                          </span>
                        </td>
                        <td className="text-right font-semibold tabular-nums">
                          {formatNumber(s.quantidade)} <span className="text-xs font-normal text-muted-foreground">{unitShort(s.unidade)}</span>
                        </td>
                        <td className="max-lg:hidden">
                          {quem ? (
                            <span className="flex min-w-0 items-center gap-2">
                              <NameMark nome={quem} shape="round" size="sm" />
                              <span className="truncate text-muted-foreground">{quem}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
                          {s.data.slice(8, 10)}/{s.data.slice(5, 7)} {formatTime(s.hora_saida)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </NvCard>

        <StockHealthGauge produtos={produtos} />
      </div>

      {empty ? null : (
        <div className="grid items-stretch gap-4 xl:grid-cols-3">
          <Card className="warehouse-card relative overflow-hidden xl:col-span-2" data-ctx="kpi" data-id="armazem" data-nome="Armazém 3D">
            <div className="warehouse-head">
              <div>
                <h2 className="radar-title text-white">Armazém ao vivo</h2>
                <p className="text-sm text-white/70">Cada pavilhão com as caixas do estoque real. Arraste para girar, passe o mouse para ver.</p>
              </div>
              <Link to="/pavilhoes" className="warehouse-link">Pavilhões</Link>
            </div>
            <div className="warehouse-canvas">
              <Warehouse3D pavilions={pavStacks} fallback={<div className="warehouse-fallback" />} />
            </div>
          </Card>
          <OperationRadar produtos={produtos} movs={movs} lotes={lotes} />
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <NvCard title="O que mais saiu" sub={`Produtos com mais saídas · ${periodoInfo.longo}`} action={<Link to="/historico" className="nv-link">Ver saídas</Link>}>
          {top.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma saída no período.</p>
          ) : (
            <TopBars key={periodo} rows={top} unitShort={unitShort} />
          )}
        </NvCard>
        <NvCard title="Estoque baixo" sub="Abaixo do mínimo, do menor saldo para o maior" action={<Link to="/estoque" className="nv-link">Ver estoque</Link>}>
          {stats.baixos.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum alerta de estoque.</p>
          ) : (
            <ul ref={baixosRef} className="space-y-3">
              {stats.baixos.map(({ p, alert }) => (
                <li key={p.id} className="flex items-center gap-3">
                  <ProductLabel nome={p.nome} codigo={p.codigo} extra={`${formatNumber(p.estoque)} ${unitShort(p.unidade)}`} className="flex-1" />
                  <StockBadge alert={alert} />
                </li>
              ))}
            </ul>
          )}
        </NvCard>
      </div>

      {vista !== "lista" ? (
        <ScreenCharts
          screen="inicio"
          movs={movs.filter((m) => m.data >= isoDaysAgo(6))}
          produtos={produtos.filter((p) => p.status)}
          pavilhoes={pavilhoes}
          periodLabel="Últimos 7 dias para o movimento · posição atual do estoque"
        />
      ) : null}
      <MovementDetail view={view} onClose={() => setView(null)} />
    </PageStage>
  );
}

/** Share of the current stock by unit, as one segmented bar. */
function UnitBar({ mix }: { mix: [string, number][] }) {
  const total = mix.reduce((a, [, q]) => a + q, 0);
  if (!total) return null;
  return (
    <div className="nv-unitbar" aria-hidden="true">
      {mix.map(([u, q], i) => (
        <span key={u} style={{ flexGrow: q, ["--i" as string]: i }} title={`${formatNumber(q)} ${unitShort(u)}`} />
      ))}
    </div>
  );
}

/** One dot per item in alert (capped): critical, zeroed, then expiring lots. */
function AlertDots({ criticos, zerados, lotes }: { criticos: number; zerados: number; lotes: number }) {
  const cap = 18;
  const dots = [
    ...Array.from({ length: Math.min(criticos, cap) }, () => "is-crit"),
    ...Array.from({ length: Math.min(zerados, Math.max(0, cap - criticos)) }, () => "is-zero"),
    ...Array.from({ length: Math.min(lotes, Math.max(0, cap - criticos - zerados)) }, () => "is-lote"),
  ];
  if (!dots.length) return <span className="nv-allgood">Tudo em dia</span>;
  return (
    <div className="nv-alertdots" aria-hidden="true">
      {dots.map((c, i) => (
        <i key={i} className={c} style={{ ["--i" as string]: i }} />
      ))}
    </div>
  );
}

function StartCard({
  step,
  title,
  body,
  to,
  cta,
  icon: Icon,
}: {
  step: string;
  title: string;
  body: string;
  to: "/mercadorias" | "/entradas" | "/nova-saida";
  cta: string;
  icon: typeof PackagePlus;
}) {
  return (
    <SpotlightCard>
      <div className="p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-primary">{step}</span>
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="mt-3 text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to={to}>{cta}</Link>
        </Button>
      </div>
    </SpotlightCard>
  );
}
