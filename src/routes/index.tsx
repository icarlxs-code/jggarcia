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
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { loteStatus, stockAlert } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { formatNumber, formatTime, isoDaysAgo, pad2, todayISO } from "@/lib/format";
import { useSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { ViewSwitch, useChartView } from "@/components/analytics/view-switch";
import { ScreenCharts } from "@/components/analytics/screen-charts";
import { usePrefersReducedMotion } from "@/lib/motion";
import { CountUp } from "@/components/motion/count-up";
import { LottieClip } from "@/components/motion/lottie-clip";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { ProductLabel } from "@/components/inventory/product-icon";
import { StockBadge } from "@/components/inventory/stock-badge";
import { destinoDaSaida, lugarDaSaida } from "@/lib/catalog";
import { tipoMovimentacaoOf } from "@/lib/movement";
import { MovementDetail } from "@/components/inventory/movement-detail";
import type { Saida } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Dashboard });

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
  const db = useDb();
  const { isAdmin } = useSession();
  const lite = usePrefersReducedMotion();
  const { vista } = useChartView("inicio");
  const [view, setView] = useState<Saida | null>(null);
  const produtos = db.listMercadorias();
  const lotes = db.listLotes();
  const movs = db.listSaidas();
  const pavilhoes = db.listPavilhoes();
  const empty = produtos.length === 0 && movs.length === 0;

  const stats = useMemo(() => {
    const hoje = todayISO();
    const entradasHoje = movs.filter((m) => m.data === hoje && m.tipo === "entrada");
    const saidasHoje = movs.filter((m) => m.data === hoje && (m.tipo ?? "saida") === "saida");
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

  return (
    <PageStage className="space-y-6" data-vista={vista}>
      <PageHeader
          clip="/lottie/galpao.json"
          clipClassName="lottie-clip h-14 w-24 shrink-0"
          title="Visão geral"
          description="Posição atual do estoque, alertas e tendências da operação."
        >
        <ViewSwitch page="inicio" />
        <Button asChild variant="outline">
          <Link to="/contagem">
            <ClipboardCheck /> Contagem
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/entradas">
            <ArrowDownToLine /> Entrada
          </Link>
        </Button>
        <Button asChild>
          <Link to="/nova-saida">
            <ArrowUpFromLine /> Nova saída
          </Link>
        </Button>
      </PageHeader>

      {empty ? (
        <div className="grid gap-3 md:grid-cols-3">
          <StartCard
            step="1"
            title="Cadastre produtos"
            body="O catálogo é a base do estoque e das movimentações."
            to="/mercadorias"
            cta="Abrir produtos"
            icon={PackagePlus}
          />
          <StartCard
            step="2"
            title="Registre uma entrada"
            body="Chegada do Ceasa gera lote, validade e posição de estoque."
            to="/entradas"
            cta="Nova entrada"
            icon={ArrowDownToLine}
          />
          <StartCard
            step="3"
            title="Expeça uma saída"
            body="A expedição baixa estoque e fica no log de alterações."
            to="/nova-saida"
            cta="Nova saída"
            icon={ArrowUpFromLine}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi ctx="estoque" label="Estoque total" mix={stats.estoqueMix} hint="Somado por caixa, saco, unidade, kg…" icon={Warehouse} />
        <Kpi ctx="skus" label="Produtos ativos" value={produtos.filter((p) => p.status).length} hint="Produtos cadastrados" icon={Boxes} />
        <Kpi ctx="entradas" label="Entradas hoje" mix={stats.inMix} hint={`${stats.entradasN} lançamentos`} icon={ArrowDownToLine} />
        <Kpi ctx="saidas" label="Saídas hoje" mix={stats.outMix} hint={`${stats.saidasN} lançamentos`} icon={ArrowUpFromLine} />
        <Kpi ctx="critico" label="Crítico / zerado" value={stats.criticos + stats.zerados} hint={`${stats.aVencer} lotes em risco`} icon={AlertTriangle} warn={stats.criticos + stats.zerados + stats.aVencer > 0} />
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

      <div className="jg-lista grid items-start gap-4 xl:grid-cols-3">
        <Card data-ctx="kpi" data-id="grafico" data-nome="Movimentação · 7 dias" className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between px-4 py-3">
            <CardTitle>Lançamentos · últimos 7 dias</CardTitle>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" /> Entradas</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-gold" /> Saídas</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="h-52">
              {movs.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem movimentação ainda.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.semana} barGap={6} barCategoryGap="28%">
                    <defs>
                      <linearGradient id="dashIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={1} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.55} />
                      </linearGradient>
                      <linearGradient id="dashOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={1} />
                        <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} width={36} axisLine={false} tickLine={false} />
                    <ChartTooltip
                      cursor={{ fill: "var(--color-muted)", fillOpacity: 0.35 }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-card)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="entradas" name="Entradas" fill="url(#dashIn)" radius={[8, 8, 2, 2]} maxBarSize={28} isAnimationActive={!lite} />
                    <Bar dataKey="saidas" name="Saídas" fill="url(#dashOut)" radius={[8, 8, 2, 2]} maxBarSize={28} isAnimationActive={!lite} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Estoque baixo</CardTitle>
            <Link to="/estoque" className="text-xs font-medium text-primary hover:underline">
              Ver estoque
            </Link>
          </CardHeader>
          <CardContent>
            {stats.baixos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum alerta de estoque.</p>
            ) : (
              <ul className="space-y-3">
                {stats.baixos.map(({ p, alert }) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <ProductLabel nome={p.nome} codigo={p.codigo} extra={`${formatNumber(p.estoque)} ${unitShort(p.unidade)}`} className="flex-1" />
                    <StockBadge alert={alert} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Últimas movimentações</CardTitle>
          <Link to="/movimentacoes" className="text-xs font-medium text-primary hover:underline">
            Ver todas
          </Link>
        </CardHeader>
        <CardContent>
          {movs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma entrada ou saída registrada.</p>
          ) : (
            <ul className="divide-y divide-border">
              {movs.slice(0, 10).map((s) => {
                const tipo = tipoMovimentacaoOf(s);
                return (
                  <li key={s.id}>
                    <button type="button" className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/40" onClick={() => setView(s)}>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {tipo === "entrada" ? <ArrowDownToLine className="h-4 w-4" /> : tipo === "transferencia" ? <ArrowLeftRight className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.mercadoria?.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {tipo === "entrada" ? `↓ ${lugarDaSaida(pavilhoes, s)}` : `${lugarDaSaida(pavilhoes, s)} → ${destinoDaSaida(pavilhoes, s)}`}
                          {s.usuario?.nome ? ` · ${s.usuario.nome}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatNumber(s.quantidade)} {unitShort(s.unidade)}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.data.slice(8, 10)}/{s.data.slice(5, 7)} {formatTime(s.hora_saida)}</p>
                      </div>
                      <Badge variant={tipo === "entrada" ? "success" : tipo === "transferencia" ? "muted" : "gold"}>
                        {tipo === "entrada" ? "↓ Entrada" : tipo === "transferencia" ? "⇄ Transferência" : "↑ Saída"}
                      </Badge>
                      {s.desconta_estoque === false ? <Badge variant="gold">Somente registro</Badge> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <MovementDetail view={view} onClose={() => setView(null)} />
    </PageStage>
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

function Kpi({
  ctx,
  label,
  value,
  suffix = "",
  mix,
  hint,
  icon: Icon,
  warn,
}: {
  ctx: string;
  label: string;
  value?: number;
  suffix?: string;
  mix?: [string, number][];
  hint: string;
  icon: typeof Boxes;
  warn?: boolean;
}) {
  return (
    <SpotlightCard data-ctx="kpi" data-id={ctx} data-nome={label} className="p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className={warn ? "h-4 w-4 text-destructive" : "h-4 w-4 text-muted-foreground"} />
          {label}
        </span>
        {ctx === "critico" ? null : (
          <LottieClip
            src={
              ctx === "saidas"
                ? "/lottie/caminhao.json"
                : ctx === "entradas"
                  ? "/lottie/caixa.json"
                  : ctx === "estoque"
                    ? "/lottie/galpao.json"
                    : "/lottie/caixa.json"
            }
            className="lottie-clip h-10 w-14 shrink-0"
          />
        )}
      </div>
      {mix ? (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-3xl font-semibold leading-snug tracking-tight">{mix.length ? mix.map(([unit, amount]) => <CountUp key={unit} value={amount} decimals={Number.isInteger(amount) ? 0 : 3} suffix={unitShort(unit)} />) : "—"}</div>
      ) : (
        <div className="mt-3 tabular text-4xl font-semibold tracking-tight">
          <CountUp value={value ?? 0} suffix={suffix} />
        </div>
      )}
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </SpotlightCard>
  );
}
