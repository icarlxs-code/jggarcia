import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { formatNumber, isoDaysAgo, pad2, todayISO } from "@/lib/format";
import { tipoMovimentacaoOf } from "@/lib/movement";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/motion/count-up";
import { ModuleTile } from "@/components/brand/module-tile";
import type { ModuleId } from "@/lib/modules";
import type { Mercadoria, Saida } from "@/lib/types";

/* ── Period ──────────────────────────────────────────────────────────── */

export type Periodo = "7" | "30" | "90" | "365";

export const PERIODOS: { id: Periodo; label: string; longo: string }[] = [
  { id: "7", label: "7D", longo: "últimos 7 dias" },
  { id: "30", label: "30D", longo: "últimos 30 dias" },
  { id: "90", label: "90D", longo: "últimos 90 dias" },
  { id: "365", label: "12M", longo: "últimos 12 meses" },
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export type Bucket = { key: string; label: string; titulo: string; from: string; to: string; entradas: number; saidas: number };

const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const isEntrada = (m: Saida) => tipoMovimentacaoOf(m) === "entrada";

/** Empty buckets for the period (days for 7/30, months for 12M), oldest first. */
function emptyBuckets(p: Periodo, offset = 0): Bucket[] {
  if (p === "365") {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const first = new Date(now.getFullYear(), now.getMonth() - 11 + i - offset * 12, 1);
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
      return {
        key: iso(first),
        label: MESES[first.getMonth()],
        titulo: `${MESES[first.getMonth()]} ${first.getFullYear()}`,
        from: iso(first),
        to: iso(last),
        entradas: 0,
        saidas: 0,
      };
    });
  }
  if (p === "90") {
    // 13 weekly bars ending today.
    return Array.from({ length: 13 }, (_, i) => {
      const end = new Date();
      end.setDate(end.getDate() - (12 - i) * 7 - offset * 91);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return {
        key: iso(start),
        label: `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)}`,
        titulo: `semana de ${pad2(start.getDate())}/${pad2(start.getMonth() + 1)} a ${pad2(end.getDate())}/${pad2(end.getMonth() + 1)}`,
        from: iso(start),
        to: iso(end),
        entradas: 0,
        saidas: 0,
      };
    });
  }
  const n = Number(p);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i) - offset * n);
    const day = iso(d);
    return {
      key: day,
      label: n <= 7 ? DIAS[d.getDay()] : pad2(d.getDate()),
      titulo: `${DIAS[d.getDay()]}, ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`,
      from: day,
      to: day,
      entradas: 0,
      saidas: 0,
    };
  });
}

export function bucketize(movs: Saida[], p: Periodo, offset = 0): Bucket[] {
  const rows = emptyBuckets(p, offset);
  if (!rows.length) return rows;
  const from = rows[0].from;
  const to = rows[rows.length - 1].to;
  for (const m of movs) {
    if (m.data < from || m.data > to) continue;
    const row = p === "365" || p === "90" ? rows.find((b) => m.data >= b.from && m.data <= b.to) : rows.find((b) => b.key === m.data);
    if (!row) continue;
    if (isEntrada(m)) row.entradas++;
    else row.saidas++;
  }
  return rows;
}

/** Range [from, to] covered by the period, and the one right before it. */
export function periodRange(p: Periodo) {
  const cur = emptyBuckets(p, 0);
  const prev = emptyBuckets(p, 1);
  return { from: cur[0].from, to: cur[cur.length - 1].to, prevFrom: prev[0].from, prevTo: prev[prev.length - 1].to };
}

/** Shortest period that still shows movement, so the panel never opens empty. */
export function periodoComDados(movs: Saida[]): Periodo {
  const last = movs.reduce((a, m) => (m.data > a ? m.data : a), "");
  if (!last) return "7";
  for (const p of ["7", "30", "90"] as Periodo[]) if (last >= periodRange(p).from) return p;
  return "365";
}

export function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? null : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function longDate(date = new Date()) {
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

export { todayISO, isoDaysAgo };

/* ── Small pieces ────────────────────────────────────────────────────── */

export function PeriodTabs({ value, onChange }: { value: Periodo; onChange: (p: Periodo) => void }) {
  return (
    <div className="nv-tabs" role="tablist" aria-label="Período">
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={value === p.id}
          className="nv-tab"
          data-on={value === p.id || undefined}
          onClick={() => onChange(p.id)}
          title={p.longo}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function DeltaPill({ pct, invert, suffix = "" }: { pct: number | null; invert?: boolean; suffix?: string }) {
  if (pct === null) return <span className="nv-delta is-new">novo{suffix}</span>;
  const good = invert ? pct < 0 : pct > 0;
  const bad = invert ? pct > 0 : pct < 0;
  return (
    <span className={cn("nv-delta", good && "is-up", bad && "is-down")}>
      <svg viewBox="0 0 10 10" aria-hidden="true" className="nv-delta-arrow" data-dir={pct > 0 ? "up" : pct < 0 ? "down" : "flat"}>
        <path d={pct === 0 ? "M2 5h6" : "M5 8V2M2.5 4.5 5 2l2.5 2.5"} />
      </svg>
      {pct === 0 ? "0%" : `${Math.abs(pct)}%`}
      {suffix}
    </span>
  );
}

export function Sparkline({ values, tone = "primary", label }: { values: number[]; tone?: "primary" | "warm" | "danger"; label?: string }) {
  const id = useId().replace(/:/g, "");
  const w = 120;
  const h = 40;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, h - 4 - (v / max) * (h - 8)] as const);
  if (!pts.length) return null;
  const line = pts.map(([x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `C${cx},${py} ${cx},${y} ${x},${y}`;
  }).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("nv-spark", `is-${tone}`)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp${id})`} className="nv-spark-area" />
      <path d={line} pathLength={1} className="nv-spark-line" />
      <circle cx={lx} cy={ly} r={3} className="nv-spark-halo" />
      <circle cx={lx} cy={ly} r={3} className="nv-spark-dot" />
    </svg>
  );
}

export function NovaKpi({
  label,
  module,
  value,
  decimals = 0,
  unit,
  extra,
  delta,
  invert,
  foot,
  spark,
  tone,
  warn,
  to,
}: {
  label: string;
  module: ModuleId;
  value: number;
  decimals?: number;
  unit?: string;
  extra?: ReactNode;
  delta?: number | null;
  invert?: boolean;
  foot: ReactNode;
  spark?: ReactNode;
  tone?: "primary" | "warm" | "danger";
  warn?: boolean;
  to?: "/entradas" | "/historico" | "/estoque";
}) {
  const body = (
    <>
      <div className="nv-kpi-head">
        <ModuleTile id={module} size="sm" live state={warn ? "warning" : undefined} />
        <span className="nv-kpi-label">{label}</span>
        {delta !== undefined ? <DeltaPill pct={delta} invert={invert} /> : null}
      </div>
      <div className="nv-kpi-body">
        <div className="min-w-0">
          <div className={cn("nv-kpi-figure", warn && "is-warn")}>
            <CountUp value={value} decimals={decimals} />
            {unit ? <span className="nv-kpi-unit">{unit}</span> : null}
          </div>
          {extra ? <div className="nv-kpi-extra">{extra}</div> : null}
        </div>
        {spark ? <div className={cn("nv-kpi-spark", tone && `is-${tone}`)}>{spark}</div> : null}
      </div>
      <p className="nv-kpi-foot">{foot}</p>
    </>
  );
  return to ? (
    <Link to={to} className="nv-card nv-kpi glyph-host" data-warn={warn || undefined}>
      {body}
    </Link>
  ) : (
    <div className="nv-card nv-kpi glyph-host" data-warn={warn || undefined}>
      {body}
    </div>
  );
}

/* ── Flow bars ───────────────────────────────────────────────────────── */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

export function FlowBars({ data, height = 260 }: { data: Bucket[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const id = useId().replace(/:/g, "");
  const padL = 34;
  const padB = 26;
  const padT = 12;
  const innerW = Math.max(0, width - padL);
  const innerH = height - padB - padT;
  const max = niceMax(Math.max(0, ...data.map((d) => Math.max(d.entradas, d.saidas))));
  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.max(3, Math.min(26, slot * 0.3));
  const gap = Math.max(2, Math.min(6, slot * 0.06));
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const labelEvery = data.length > 14 ? Math.ceil(data.length / 10) : 1;
  const h = hover !== null ? data[hover] : null;
  const hx = hover !== null ? padL + slot * hover + slot / 2 : 0;
  const tipTop = h ? Math.max(0, y(Math.max(h.entradas, h.saidas)) - 12) : 0;

  return (
    <div ref={ref} className="nv-flow" style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 ? (
        <svg width={width} height={height} className="nv-flow-svg" role="img" aria-label="Entradas e saídas por período">
          <defs>
            <linearGradient id={`in${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="color-mix(in srgb, var(--color-primary) 72%, white)" />
            </linearGradient>
            <pattern id={`hatch${id}`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="color-mix(in srgb, var(--color-primary) 16%, transparent)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="color-mix(in srgb, var(--color-primary) 62%, transparent)" strokeWidth="2.4" />
            </pattern>
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={width} y1={y(t)} y2={y(t)} className="nv-grid" />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="nv-axis">{formatNumber(t)}</text>
            </g>
          ))}
          {h ? <line x1={hx} x2={hx} y1={padT} y2={padT + innerH} className="nv-guide" /> : null}
          {data.map((d, i) => {
            const cx = padL + slot * i + slot / 2;
            const dim = hover !== null && hover !== i;
            const hIn = innerH - (y(d.entradas) - padT);
            const hOut = innerH - (y(d.saidas) - padT);
            return (
              <g key={d.key} className="nv-bar-group" data-dim={dim || undefined} style={{ ["--i" as string]: i }}>
                <rect x={padL + slot * i} y={padT} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
                <rect x={cx - barW - gap / 2} y={y(d.entradas)} width={barW} height={Math.max(d.entradas ? 2 : 0, hIn)} rx={Math.min(6, barW / 2)} fill={`url(#in${id})`} className="nv-bar" />
                <rect x={cx + gap / 2} y={y(d.saidas)} width={barW} height={Math.max(d.saidas ? 2 : 0, hOut)} rx={Math.min(6, barW / 2)} fill={`url(#hatch${id})`} className="nv-bar is-out" />
                {i % labelEvery === 0 || i === data.length - 1 ? (
                  <text x={cx} y={height - 6} textAnchor="middle" className={cn("nv-axis", hover === i && "is-on")}>{d.label}</text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
      {h ? (
        <div className="nv-tip" style={{ left: Math.min(Math.max(hx, 80), width - 80), top: tipTop }}>
          <p className="nv-tip-title">{h.titulo}</p>
          <p className="nv-tip-row"><i className="is-in" /> {formatNumber(h.entradas)} {h.entradas === 1 ? "entrada" : "entradas"}</p>
          <p className="nv-tip-row"><i className="is-out" /> {formatNumber(h.saidas)} {h.saidas === 1 ? "saída" : "saídas"}</p>
        </div>
      ) : null}
    </div>
  );
}

/* ── Bubbles: where the exits went ───────────────────────────────────── */

export function destinoMix(movs: Saida[], from: string, to: string) {
  let clientes = 0;
  let transf = 0;
  let semDestino = 0;
  for (const m of movs) {
    if (m.data < from || m.data > to || isEntrada(m)) continue;
    const t = tipoMovimentacaoOf(m);
    if (t === "transferencia") transf++;
    else if (m.somente_saida || !m.destino_id) semDestino++;
    else clientes++;
  }
  return { clientes, transf, semDestino, total: clientes + transf + semDestino };
}

export function BubbleShare({ items, total }: { items: { label: string; value: number; tone: "a" | "b" | "c" }[]; total: number }) {
  const sorted = [...items].filter((it) => it.value > 0).sort((a, b) => b.value - a.value);
  const maxV = Math.max(1, sorted[0]?.value ?? 1);
  // Biggest circle on the right; the others tucked against its left edge, overlapping a little.
  const placed: { it: (typeof items)[number]; r: number; x: number; y: number }[] = [];
  sorted.forEach((it, i) => {
    const r = Math.max(14, Math.sqrt(it.value / maxV) * 38);
    if (i === 0) {
      placed.push({ it, r, x: 100 - r - 4, y: 52 });
      return;
    }
    const big = placed[0];
    const ang = ((i === 1 ? 205 : 140) * Math.PI) / 180;
    const d = big.r + r * 0.55;
    const x = Math.min(100 - r, Math.max(r, big.x + Math.cos(ang) * d));
    const y = Math.min(100 - r, Math.max(r, big.y - Math.sin(ang) * d));
    placed.push({ it, r, x, y });
  });
  return (
    <div className="nv-bubbles">
      <div className="nv-bubble-stage" aria-hidden="true">
        {placed.map(({ it, r, x, y }, i) => (
          <span
            key={it.label}
            className={cn("nv-bubble", `is-${it.tone}`)}
            style={{
              width: `${r * 2}%`,
              left: `${x - r}%`,
              top: `${y - r}%`,
              zIndex: i + 1,
              ["--i" as string]: i,
              ["--fs" as string]: `${Math.max(0.8, (r / 38) * 1.6)}rem`,
            }}
          >
            {total ? Math.round((it.value / total) * 100) : 0}%
          </span>
        ))}
      </div>
      <ul className="nv-legend">
        {items.map((it) => (
          <li key={it.label}>
            <i className={cn("nv-dot", `is-${it.tone}`)} />
            <span className="flex-1 truncate">{it.label}</span>
            <strong>{formatNumber(it.value)}</strong>
            <span className="nv-legend-pct">{total ? Math.round((it.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Top products leaving ────────────────────────────────────────────── */

export function topSaidas(movs: Saida[], produtos: Mercadoria[], from: string, to: string, n = 5) {
  const by = new Map<string, { qtd: number; vezes: number; unidade: string }>();
  for (const m of movs) {
    if (m.data < from || m.data > to || isEntrada(m)) continue;
    const row = by.get(m.mercadoria_id) ?? { qtd: 0, vezes: 0, unidade: m.unidade };
    row.qtd += Number(m.quantidade) || 0;
    row.vezes += 1;
    by.set(m.mercadoria_id, row);
  }
  return [...by.entries()]
    .map(([id, r]) => ({ id, ...r, p: produtos.find((p) => p.id === id) }))
    .filter((r) => r.p)
    .sort((a, b) => b.vezes - a.vezes || b.qtd - a.qtd)
    .slice(0, n);
}

export function TopBars({ rows, unitShort }: { rows: ReturnType<typeof topSaidas>; unitShort: (u: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.vezes));
  return (
    <ul className="nv-top">
      {rows.map((r, i) => (
        <li key={r.id} style={{ ["--i" as string]: i }}>
          <Link to="/produto/$id" params={{ id: r.id }} className="nv-top-row">
            <span className="nv-top-rank">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{r.p!.nome}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatNumber(r.vezes)} {r.vezes === 1 ? "saída" : "saídas"} · {formatNumber(r.qtd)} {unitShort(r.unidade)}
                </span>
              </span>
              <span className="nv-top-track">
                <span className="nv-top-fill" style={{ width: `${Math.max(6, (r.vezes / max) * 100)}%` }} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ── Card shell ──────────────────────────────────────────────────────── */

export function NvCard({ title, sub, action, children, className, ...rest }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string } & Record<`data-${string}`, string | undefined>) {
  return (
    <section className={cn("nv-card nv-panel", className)} {...rest}>
      <header className="nv-panel-head">
        <div className="min-w-0">
          <h2 className="nv-panel-title">{title}</h2>
          {sub ? <p className="nv-panel-sub">{sub}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function useBuckets(movs: Saida[], p: Periodo) {
  return useMemo(() => ({ cur: bucketize(movs, p, 0), prev: bucketize(movs, p, 1) }), [movs, p]);
}
