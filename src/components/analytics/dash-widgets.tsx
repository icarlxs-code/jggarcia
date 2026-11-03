import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CalendarClock, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { loteStatus, stockAlert } from "@/lib/store";
import { formatNumber, isoDaysAgo, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductIcon } from "@/components/inventory/product-icon";
import type { Lote, Mercadoria, Saida } from "@/lib/types";
import { Orb3D } from "@/components/three/lazy";

/** Windows tried, shortest first, to measure each product's outflow pace. */
const PACE_WINDOWS = [14, 30, 90];

const isSaida = (m: Saida) => (m.tipo ?? "saida") === "saida" && m.desconta_estoque !== false;

export type Coverage = { p: Mercadoria; dias: number; ritmo: number };

/** How long each product lasts at its outflow pace over `janela` days, soonest first. */
export function coverageOf(produtos: Mercadoria[], movs: Saida[], janela: number): Coverage[] {
  const desde = isoDaysAgo(janela - 1);
  const saiu = new Map<string, number>();
  for (const m of movs) {
    if (m.data < desde || !isSaida(m)) continue;
    saiu.set(m.mercadoria_id, (saiu.get(m.mercadoria_id) || 0) + (Number(m.quantidade) || 0));
  }
  const rows: Coverage[] = [];
  for (const p of produtos) {
    if (!p.status) continue;
    const ritmo = (saiu.get(p.id) || 0) / janela;
    if (ritmo <= 0) continue;
    rows.push({ p, ritmo, dias: Math.max(0, p.estoque) / ritmo });
  }
  return rows.sort((a, b) => a.dias - b.dias);
}

function diasLabel(dias: number) {
  if (dias < 1) return dias <= 0 ? "Esgotado" : "Acaba hoje";
  const d = Math.floor(dias);
  return d === 1 ? "~1 dia" : `~${d} dias`;
}

/** A small rendered sphere that stands in for the operation's "brain". */
export function RadarOrb({ className }: { className?: string }) {
  return (
    <div className={cn("radar-orb", className)} aria-hidden="true">
      <span className="radar-orb-ring" />
      <span className="radar-orb-core" />
      <span className="radar-orb-shine" />
      <span className="radar-orb-shadow" />
    </div>
  );
}

export function OperationRadar({ produtos, movs, lotes }: { produtos: Mercadoria[]; movs: Saida[]; lotes: Lote[] }) {
  const info = useMemo(() => {
    let janela = PACE_WINDOWS[0];
    let cobertura: Coverage[] = [];
    for (const w of PACE_WINDOWS) {
      janela = w;
      cobertura = coverageOf(produtos, movs, w);
      if (cobertura.length) break;
    }
    const criticos = produtos.filter((p) => p.status && stockAlert(p) === "critico").length;
    const acabando = cobertura.filter((c) => c.dias > 0 && c.dias <= 3);
    const esgotados = cobertura.filter((c) => c.dias <= 0).length;
    const hoje = todayISO();
    const saidasHoje = movs.filter((m) => m.data === hoje && isSaida(m)).length;
    let semana = 0;
    for (let i = 1; i <= 7; i++) {
      const d = isoDaysAgo(i);
      semana += movs.filter((m) => m.data === d && isSaida(m)).length;
    }
    const media = semana / 7;
    const vencendo = lotes.filter((l) => loteStatus(l.validade) !== "ok").length;
    const giro = new Map<string, number>();
    const desde = isoDaysAgo(6);
    for (const m of movs) if (m.data >= desde && isSaida(m)) giro.set(m.mercadoria_id, (giro.get(m.mercadoria_id) || 0) + 1);
    const topId = [...giro.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const top = topId ? produtos.find((p) => p.id === topId) : undefined;
    return { janela, criticos, cobertura: cobertura.slice(0, 4), acabando: acabando.length, esgotados, saidasHoje, media, vencendo, top, topN: topId ? giro.get(topId)! : 0 };
  }, [produtos, movs, lotes]);

  const ritmo = info.media > 0 ? Math.round(((info.saidasHoje - info.media) / info.media) * 100) : null;
  const insights: { icon: typeof Flame; tone: "warn" | "good" | "info"; text: string }[] = [];
  if (info.esgotados > 0) insights.push({ icon: AlertTriangle, tone: "warn", text: `${info.esgotados} ${info.esgotados === 1 ? "produto com saída recente está esgotado" : "produtos com saída recente estão esgotados"}.` });
  if (info.acabando > 0) insights.push({ icon: AlertTriangle, tone: "warn", text: `${info.acabando} ${info.acabando === 1 ? "produto acaba" : "produtos acabam"} em até 3 dias no ritmo atual.` });
  if (info.criticos > 0) insights.push({ icon: AlertTriangle, tone: "warn", text: `${info.criticos} ${info.criticos === 1 ? "produto está" : "produtos estão"} no nível crítico. Hora de repor.` });
  if (info.vencendo > 0) insights.push({ icon: CalendarClock, tone: "warn", text: `${info.vencendo} ${info.vencendo === 1 ? "lote vence" : "lotes vencem"} em breve. Priorize a saída deles.` });
  if (ritmo !== null) insights.push({ icon: ritmo >= 0 ? TrendingUp : TrendingDown, tone: "info", text: ritmo === 0 ? "Saídas de hoje no ritmo da média da semana." : `Saídas de hoje ${Math.abs(ritmo)}% ${ritmo > 0 ? "acima" : "abaixo"} da média da semana.` });
  if (info.top) insights.push({ icon: Flame, tone: "good", text: `${info.top.nome} é o que mais saiu na semana (${info.topN} ${info.topN === 1 ? "saída" : "saídas"}).` });
  if (!insights.length) insights.push({ icon: TrendingUp, tone: "good", text: "Sem alertas. Registre saídas para o radar medir o ritmo de cada produto." });

  return (
    <Card className="radar-card overflow-hidden" data-ctx="kpi" data-id="radar" data-nome="Radar da operação">
      <div className="grid gap-6 p-5 md:grid-cols-2 md:p-6 xl:grid-cols-1">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-4">
            <div className="radar-orb-3d">
              <Orb3D fallback={<RadarOrb />} />
            </div>
            <div className="min-w-0">
              <h2 className="radar-title">Radar da operação</h2>
              <p className="text-sm text-muted-foreground">Leitura automática do estoque e do ritmo de saída.</p>
            </div>
          </div>
          <ul className="mt-5 space-y-2.5">
            {insights.slice(0, 3).map((it, i) => (
              <li key={i} className={cn("radar-insight", `is-${it.tone}`)} style={{ ["--i" as string]: i }}>
                <it.icon className="h-4 w-4 shrink-0" />
                <span>{it.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Acabam primeiro</h3>
            <span className="text-xs text-muted-foreground">ritmo dos últimos {info.janela} dias</span>
          </div>
          {info.cobertura.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Ainda não há saídas recentes para prever a duração do estoque.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {info.cobertura.map(({ p, dias, ritmo }) => {
                const pct = Math.max(4, Math.min(100, (dias / 14) * 100));
                const tone = dias <= 3 ? "is-warn" : dias <= 7 ? "is-mid" : "is-good";
                return (
                  <li key={p.id}>
                    <Link to="/produto/$id" params={{ id: p.id }} className="radar-row group">
                      <ProductIcon nome={p.nome} codigo={p.codigo} size="sm" className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium group-hover:underline">{p.nome}</span>
                          <span className={cn("radar-days", tone)}>{diasLabel(dias)}</span>
                        </div>
                        <div className="radar-track mt-1.5">
                          <span className={cn("radar-fill", tone)} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-[0.6875rem] text-muted-foreground tabular-nums">
                          {formatNumber(Math.max(0, p.estoque))} em estoque · sai ~{formatNumber(Math.round(ritmo * 10) / 10)}/dia
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

const GAUGE_SEGMENTS = 34;

export function StockHealthGauge({ produtos }: { produtos: Mercadoria[] }) {
  const counts = useMemo(() => {
    const ativos = produtos.filter((p) => p.status);
    const c = { ok: 0, atencao: 0, critico: 0 };
    for (const p of ativos) {
      const a = stockAlert(p);
      if (a === "ok") c.ok++;
      else if (a === "critico") c.critico++;
      else c.atencao++;
    }
    return { ...c, total: ativos.length };
  }, [produtos]);
  const pct = counts.total ? Math.round((counts.ok / counts.total) * 100) : 0;
  const filled = Math.round((pct / 100) * GAUGE_SEGMENTS);
  const cx = 110;
  const cy = 108;
  const r1 = 80;
  const r2 = 100;

  return (
    <Card className="gauge-card" data-ctx="kpi" data-id="saude" data-nome="Saúde do estoque">
      <CardHeader className="pb-0">
        <CardTitle>Saúde do estoque</CardTitle>
        <p className="text-sm text-muted-foreground">Produtos acima do mínimo</p>
      </CardHeader>
      <CardContent className="flex flex-col items-center pt-2">
        <div className="relative w-full max-w-[16rem]">
          <svg viewBox="0 0 220 120" className="w-full" role="img" aria-label={`${pct}% dos produtos com estoque saudável`}>
            {Array.from({ length: GAUGE_SEGMENTS }, (_, i) => {
              const t = Math.PI - (i + 0.5) * (Math.PI / GAUGE_SEGMENTS);
              const cos = Math.cos(t);
              const sin = Math.sin(t);
              return (
                <line
                  key={i}
                  x1={cx + r1 * cos}
                  y1={cy - r1 * sin}
                  x2={cx + r2 * cos}
                  y2={cy - r2 * sin}
                  className={cn("gauge-seg", i < filled ? "is-on" : "is-off")}
                  style={{ ["--i" as string]: i }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
            <span className="kpi-figure text-4xl leading-none">{pct}%</span>
            <span className="mt-1 text-xs text-muted-foreground">saudável</span>
          </div>
        </div>
        <dl className="mt-5 grid w-full grid-cols-3 gap-2 text-center">
          {[
            { k: "OK", v: counts.ok, cls: "bg-primary" },
            { k: "Atenção", v: counts.atencao, cls: "bg-gold" },
            { k: "Crítico", v: counts.critico, cls: "bg-destructive" },
          ].map((row) => (
            <div key={row.k} className="rounded-xl bg-muted/60 px-2 py-2">
              <dt className="flex items-center justify-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", row.cls)} />
                {row.k}
              </dt>
              <dd className="kpi-sub mt-0.5 text-base font-semibold">{formatNumber(row.v)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

type FlowRow = { name: string; entradas: number; saidas: number };

function FlowTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value ?? 0;
  return (
    <div className="flow-tip">
      <p className="text-[0.6875rem] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-sm bg-primary" />{get("entradas")} entradas</p>
      <p className="flex items-center gap-2 text-sm"><span className="flow-tip-hatch h-2 w-2 rounded-sm" />{get("saidas")} saídas</p>
    </div>
  );
}

export function FlowChart({ data, lite }: { data: FlowRow[]; lite: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const dim = (i: number) => (active === null || active === i ? 1 : 0.32);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        barGap={6}
        barCategoryGap="26%"
        onMouseMove={(s) => setActive(typeof s?.activeTooltipIndex === "number" ? s.activeTooltipIndex : null)}
        onMouseLeave={() => setActive(null)}
        className="flow-chart"
      >
        <defs>
          <linearGradient id="flowIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.7} />
          </linearGradient>
          <pattern id="flowHatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="var(--color-gold)" fillOpacity={0.22} />
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--color-gold)" strokeWidth="3.5" />
          </pattern>
        </defs>
        <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} width={32} axisLine={false} tickLine={false} />
        <ChartTooltip cursor={{ fill: "var(--color-muted)", fillOpacity: 0.45, radius: 10 } as object} content={<FlowTooltip />} />
        <Bar dataKey="entradas" name="Entradas" fill="url(#flowIn)" radius={[8, 8, 3, 3]} maxBarSize={30} isAnimationActive={!lite} animationDuration={520} animationEasing="ease-out">
          {data.map((_, i) => <Cell key={i} fillOpacity={dim(i)} className="flow-bar" />)}
        </Bar>
        <Bar dataKey="saidas" name="Saídas" fill="url(#flowHatch)" stroke="var(--color-gold)" strokeWidth={1} radius={[8, 8, 3, 3]} maxBarSize={30} isAnimationActive={!lite} animationDuration={520} animationBegin={90} animationEasing="ease-out">
          {data.map((_, i) => <Cell key={i} fillOpacity={dim(i)} strokeOpacity={dim(i)} className="flow-bar" />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
