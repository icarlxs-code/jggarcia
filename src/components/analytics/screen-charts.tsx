import { useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fluxo, porTipo, rankCampo, rankNome, saldoExterno, sameUnit, situacaoCount, transito, divergencias, type Metric } from "@/lib/chart-data";
import { forkliftRanking, forkliftTrips } from "@/lib/forklift";
import { formatMinutes, formatNumber } from "@/lib/format";
import { lugarDaSaida, destinoDaSaida } from "@/lib/catalog";
import { usePrefersReducedMotion } from "@/lib/motion";
import { db } from "@/lib/store";
import type { Contagem, Mercadoria, Pavilhao, Saida } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ChartScreen = "hoje" | "inicio" | "entradas" | "saidas" | "movimentacoes" | "estoque" | "contagem" | "painel";

const COLORS = {
  in: "var(--color-primary)",
  out: "var(--color-gold)",
  move: "#2563eb",
  count: "#7c3aed",
  alert: "var(--color-destructive)",
};

export function ScreenCharts({
  screen,
  movs,
  contagens = [],
  produtos = [],
  pavilhoes = [],
  periodLabel,
  show,
}: {
  screen: ChartScreen;
  movs: Saida[];
  contagens?: Contagem[];
  produtos?: Mercadoria[];
  pavilhoes?: Pavilhao[];
  periodLabel: string;
  show?: Partial<Record<"cartoes" | "fluxo" | "ranks" | "locais" | "situacao", boolean>>;
}) {
  const [metric, setMetric] = useState<Metric>("quantidade");
  const unidade = sameUnit(movs);
  const base = metric === "quantidade" ? unidade.rows : movs;
  const bucket = movs.length && new Set(movs.map((s) => s.data)).size <= 2 ? "hora" : "dia";
  const serie = fluxo(base, bucket, metric);
  const saldo = saldoExterno(base, metric);
  const tipos = porTipo(movs);
  const trip = transito(movs);
  const on = (id: "cartoes" | "fluxo" | "ranks" | "locais" | "situacao") => show?.[id] !== false;
  const nomes = new Map(db.listMercadorias().map((m) => [m.id, m.nome]));
  const nomePav = (id?: string) => pavilhoes.find((p) => p.id === id)?.nome || "—";

  return (
    <section className="an-board space-y-2" aria-label="Gráficos do recorte">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {periodLabel}
          {metric === "quantidade" && unidade.misto ? ` · quantidades em ${unidade.unidade}. Outras unidades não entram nesta soma.` : ""}
          {metric === "lancamentos" ? " · cada lançamento vale 1, sem somar caixas com quilos." : ""}
        </p>
        <div className="inline-flex rounded-full border border-border bg-card p-0.5">
          {(["quantidade", "lancamentos"] as Metric[]).map((id) => (
            <button
              key={id}
              type="button"
              className={cn("h-8 rounded-full px-3 text-xs font-medium", metric === id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              onClick={() => setMetric(id)}
            >
              {id === "quantidade" ? "Quantidade" : "Lançamentos"}
            </button>
          ))}
        </div>
      </div>

      {on("cartoes") && (screen === "painel" || screen === "hoje" || screen === "inicio") ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Stat k="Entradas" v={saldo.entrou} hint={metric === "lancamentos" ? "lançamentos" : unidade.unidade || "no recorte"} />
          <Stat k="Saídas externas" v={saldo.saiu} hint="sem transferência" />
          <Stat k="Saldo do período" v={saldo.saldo} hint="entrou − saiu" />
          <Stat k="Em trânsito" v={trip.pendente} hint={trip.media != null ? `média ${formatMinutes(trip.media)}` : "transferências abertas"} />
        </div>
      ) : null}

      {on("fluxo") && serie.length === 0 ? <Empty /> : null}
      {on("fluxo") && serie.length > 0 && screen !== "estoque" && screen !== "contagem" ? (
        <ChartCard
          title={bucket === "hora" ? "Por hora" : "Por dia"}
          hint="Verde entrou · âmbar saiu para fora · azul transferiu"
          period={periodLabel}
          unit={metric === "lancamentos" ? "lançamentos" : unidade.unidade}
          rows={serie}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} barGap={2} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis width={36} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={metric === "lancamentos"} />
              <Tooltip content={<Tip unit={metric === "lancamentos" ? "lançamentos" : unidade.unidade} />} />
              <Bar dataKey="entradas" name="Entradas" fill={COLORS.in} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              <Bar dataKey="saidas" name="Saídas" fill={COLORS.out} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              <Bar dataKey="transferencias" name="Transferências" fill={COLORS.move} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}

      {on("ranks") && screen !== "estoque" && screen !== "contagem" ? (
        <div className="grid items-start gap-2 lg:grid-cols-2">
          <Rank title="Produtos que mais entraram" rows={rankNome(base, "entrada", metric)} unit={metric === "lancamentos" ? "lançamentos" : unidade.unidade} period={periodLabel} color={COLORS.in} />
          <Rank title="Produtos que mais saíram" rows={rankNome(base, "saida", metric)} unit={metric === "lancamentos" ? "lançamentos" : unidade.unidade} period={periodLabel} color={COLORS.out} />
        </div>
      ) : null}

      {(screen === "hoje" || screen === "movimentacoes" || screen === "painel") && tipos.length ? (
        <div className="grid items-start gap-2 lg:grid-cols-2">
          <Donut title="Lançamentos por tipo" hint="Conta registros, não a quantidade" unit="lançamentos" rows={tipos} />
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-sm font-semibold">Transferências</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <p><span className="block text-lg font-semibold tabular-nums">{trip.pendente}</span><span className="text-[10px] text-muted-foreground">Pendentes</span></p>
              <p><span className="block text-lg font-semibold tabular-nums">{trip.concluida}</span><span className="text-[10px] text-muted-foreground">Concluídas</span></p>
              <p><span className="block text-lg font-semibold tabular-nums">{trip.media != null ? formatMinutes(trip.media) : "—"}</span><span className="text-[10px] text-muted-foreground">Tempo médio</span></p>
            </div>
            <ForkList movs={movs} pavilhoes={pavilhoes} />
          </div>
        </div>
      ) : null}

      {screen === "entradas" ? (
        <div className="grid items-start gap-2 lg:grid-cols-2">
          <Rank title="Onde a carga entrou" rows={rankCampo(base, (s) => lugarDaSaida(pavilhoes, s), "entrada", metric)} unit={metric === "lancamentos" ? "lançamentos" : unidade.unidade} period={periodLabel} color={COLORS.in} />
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            O lançamento de entrada não guarda o fornecedor. O gráfico por fornecedor fica de fora até esse campo existir na entrada.
          </p>
        </div>
      ) : null}

      {screen === "saidas" || screen === "movimentacoes" ? (
        <div className="grid items-start gap-2 lg:grid-cols-2">
          <Rank title="Saídas por destino" rows={rankCampo(base, (s) => destinoDaSaida(pavilhoes, s), "saida", metric)} unit={metric === "lancamentos" ? "lançamentos" : unidade.unidade} period={periodLabel} color={COLORS.out} />
          <Rank title="Origem da saída" rows={rankCampo(base, (s) => lugarDaSaida(pavilhoes, s), "saida", metric)} unit={metric === "lancamentos" ? "lançamentos" : unidade.unidade} period={periodLabel} color={COLORS.out} />
          {screen === "movimentacoes" ? (
            <Rank
              title="Rotas de transferência"
              rows={rankCampo(base, (s) => `${lugarDaSaida(pavilhoes, s)} → ${destinoDaSaida(pavilhoes, s)}`, "transferencia", metric)}
              unit={metric === "lancamentos" ? "lançamentos" : unidade.unidade}
              period={periodLabel}
              color={COLORS.move}
            />
          ) : null}
        </div>
      ) : null}

      {on("locais") && (screen === "estoque" || screen === "inicio" || screen === "painel") ? <EstoqueBloco produtos={produtos} pavilhoes={pavilhoes} /> : null}

      {on("situacao") && (screen === "estoque" || screen === "inicio" || screen === "painel") ? (
        <div className="grid items-start gap-2 lg:grid-cols-2">
          <Donut title="Situação do estoque" hint="Cada produto entra numa categoria só" unit="produtos" rows={situacaoCount(produtos)} />
        </div>
      ) : null}

      {(screen === "contagem" || screen === "painel") && on("situacao") ? <ContagemBloco rows={contagens} nomes={nomes} nomePav={nomePav} period={periodLabel} /> : null}
    </section>
  );
}

function EstoqueBloco({ produtos }: { produtos: Mercadoria[]; pavilhoes: Pavilhao[] }) {
  const rows = [...produtos].filter((m) => m.estoque > 0).sort((a, b) => b.estoque - a.estoque).slice(0, 10);
  const unidade = rows[0]?.unidade || "";
  const mesma = rows.every((m) => m.unidade === unidade);
  const locais = new Map<string, number>();
  for (const m of produtos) {
    for (const p of db.stockPositions(m.id)) {
      if (p.quantidade > 0) locais.set(p.nome, (locais.get(p.nome) || 0) + (m.unidade === unidade ? p.quantidade : 0));
    }
  }
  const localRows = [...locais.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  return (
    <div className="grid items-start gap-2 lg:grid-cols-2">
      <Rank title="Maiores saldos" rows={rows.map((m) => ({ nome: m.nome, valor: m.estoque }))} unit={mesma ? unidade : "ver unidade no nome"} period="Posição atual" color={COLORS.in} />
      <Rank title="Saldo por local" rows={localRows} unit={unidade || "da unidade principal"} period="Posição atual" color={COLORS.in} />
      <p className="text-[11px] text-muted-foreground lg:col-span-2">
        Saldo por local só soma a unidade {unidade || "principal"}, para não misturar caixa com quilo. Abaixo do mínimo: {produtos.filter((m) => m.estoque > 0 && m.estoque < m.minimo).length}.
      </p>
    </div>
  );
}

function ContagemBloco({
  rows,
  nomes,
  nomePav,
  period,
}: {
  rows: Contagem[];
  nomes: Map<string, string>;
  nomePav: (id?: string) => string;
  period: string;
}) {
  if (!rows.length) return <Empty />;
  const d = divergencias(rows);
  const barras = d.maiores.map((r) => ({ nome: nomes.get(r.nome) || "Produto", sobra: r.sobra, falta: r.falta }));
  const porDia = new Map<string, number>();
  for (const c of rows) porDia.set(c.data, (porDia.get(c.data) || 0) + 1);
  const dias = [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, valor]) => ({ nome: data.slice(8) + "/" + data.slice(5, 7), valor }));
  return (
    <div className="grid items-start gap-2 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-3">
        <p className="text-sm font-semibold">Conferência</p>
        <p className="text-xs text-muted-foreground">{period} · a diferença é a gravada na hora da contagem</p>
        <p className="mt-2 text-sm">
          Sem divergência: <strong className="tabular-nums">{d.pct == null ? "—" : `${d.pct.toLocaleString("pt-BR")}%`}</strong> de {d.total} contagens
        </p>
        <p className="text-xs text-muted-foreground">Sobrou {formatNumber(d.sobra)} · faltou {formatNumber(d.falta)}. Unidades diferentes não foram convertidas.</p>
      </div>
      <Rank title="Contagens por dia" rows={dias} unit="contagens" period={period} color={COLORS.count} />
      {barras.length ? <SplitBars title="Maiores divergências" hint="Verde sobrou · vermelho faltou" rows={barras} /> : null}
      <Rank title="Contagens por local" rows={Object.entries(rows.reduce<Record<string, number>>((a, c) => { const n = nomePav(c.pavilhao_id); a[n] = (a[n] || 0) + 1; return a; }, {})).map(([nome, valor]) => ({ nome, valor }))} unit="contagens" period={period} color={COLORS.count} />
    </div>
  );
}

function ForkList({ movs, pavilhoes }: { movs: Saida[]; pavilhoes: Pavilhao[] }) {
  const rank = forkliftRanking(forkliftTrips(movs.filter((s) => tipoMov(s)), pavilhoes)).rank.slice(0, 4);
  if (!rank.length) return <p className="mt-2 text-xs text-muted-foreground">Nenhum empilhador com duas viagens neste recorte.</p>;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {rank.map((r) => (
        <li key={r.nome} className="flex justify-between gap-2">
          <span className="truncate">{r.nome}</span>
          <span className="tabular-nums text-muted-foreground">{formatMinutes(r.avg)} · {r.trips}</span>
        </li>
      ))}
    </ul>
  );
}

function tipoMov(s: Saida) {
  return s.tipo !== "entrada";
}

function Stat({ k, v, hint }: { k: string; v: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</p>
      <p className="text-xl font-semibold tabular-nums">{formatNumber(v)}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function Empty() {
  return <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Nenhum dado neste período.</p>;
}

function Rank({ title, rows, unit, period, color }: { title: string; rows: { nome: string; valor: number }[]; unit: string; period: string; color: string }) {
  const [open, setOpen] = useState(false);
  const shown = open ? rows.slice(0, 10) : rows.slice(0, 5);
  const max = shown[0]?.valor || rows[0]?.valor || 1;
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {rows.length > 5 ? (
          <button type="button" className="text-[11px] font-medium text-primary" onClick={() => setOpen((v) => !v)}>
            {open ? "Menos" : `+${rows.length - 5}`}
          </button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">{period} · {unit}</p>
      {shown.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nenhum dado neste período.</p> : (
        <ol className="mt-1.5 space-y-1">
          {shown.map((r) => (
            <li key={r.nome} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
              <span className="truncate text-xs">{r.nome}</span>
              <span className="text-xs tabular-nums font-semibold">{formatNumber(r.valor)}</span>
              <div className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.round((r.valor / max) * 100))}%`, background: color }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Donut({ title, hint, unit, rows }: { title: string; hint: string; unit: string; rows: { nome: string; valor: number; fill: string }[] }) {
  const total = rows.reduce((a, r) => a + r.valor, 0) || 1;
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <button type="button" className="h-7 rounded-full border border-border px-2 text-[11px]" onClick={() => downloadCsv(title, rows)}>CSV</button>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-24 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="valor" nameKey="nome" innerRadius={28} outerRadius={42} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {rows.map((r) => (
                  <Cell key={r.nome} fill={r.fill} />
                ))}
              </Pie>
              <Tooltip content={<Tip unit={unit} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-1">
          {rows.map((r) => (
            <li key={r.nome} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.fill }} />
              <span className="min-w-0 flex-1 truncate">{r.nome}</span>
              <span className="tabular-nums font-semibold">{formatNumber(r.valor)}</span>
              <span className="w-8 text-right text-muted-foreground">{Math.round((r.valor / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SplitBars({ title, hint, rows }: { title: string; hint: string; rows: { nome: string; sobra: number; falta: number }[] }) {
  const max = Math.max(...rows.flatMap((r) => [r.sobra, r.falta]), 1);
  const shown = rows.slice(0, 6);
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <ul className="mt-1.5 space-y-1.5">
        {shown.map((r) => (
          <li key={r.nome}>
            <div className="flex justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">{r.nome}</span>
              <span className="shrink-0 tabular-nums">
                <span className="text-primary">{formatNumber(r.sobra)}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="text-destructive">{formatNumber(r.falta)}</span>
              </span>
            </div>
            <div className="mt-0.5 flex h-1 gap-0.5">
              <div className="overflow-hidden rounded-full bg-muted" style={{ width: `${Math.max(8, Math.round((r.sobra / max) * 50))}%` }}>
                <div className="h-full rounded-full bg-primary" />
              </div>
              <div className="overflow-hidden rounded-full bg-muted" style={{ width: `${Math.max(8, Math.round((r.falta / max) * 50))}%` }}>
                <div className="h-full rounded-full bg-destructive" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartCard({ title, hint, period, unit, rows, children }: { title: string; hint: string; period: string; unit: string; rows: object[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const lite = usePrefersReducedMotion();
  const [table, setTable] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground">{hint} · {period} · {unit}</p>
        </div>
        <div className="flex gap-1">
          <button type="button" className="h-8 rounded-full border border-border px-2.5 text-[11px]" onClick={() => setTable((v) => !v)}>{table ? "Gráfico" : "Tabela"}</button>
          <button type="button" className="h-8 rounded-full border border-border px-2.5 text-[11px]" onClick={() => downloadCsv(title, rows)}>CSV</button>
          <button type="button" className="h-8 rounded-full border border-border px-2.5 text-[11px]" onClick={() => downloadPng(ref.current, title)} disabled={lite}>PNG</button>
        </div>
      </div>
      {table ? (
        <div className="mt-2 max-h-48 overflow-auto text-xs">
          <table className="w-full">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 pr-2">{Object.values(r).filter((v) => typeof v === "string").join(" · ") || "—"}</td>
                  <td className="py-1 text-right tabular-nums">{Object.values(r).filter((v) => typeof v === "number").map((n) => formatNumber(n as number)).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="mt-2 h-28">{children}</div>
      )}
    </div>
  );
}

function Tip({ active, payload, unit }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((a, p) => a + (Number(p.value) || 0), 0);
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-card">
      {payload.map((p) => (
        <p key={p.name}>
          {p.name}: <strong className="tabular-nums">{formatNumber(Number(p.value) || 0)}</strong> {unit}
          {total > 0 ? ` · ${Math.round(((Number(p.value) || 0) / total) * 100)}%` : ""}
        </p>
      ))}
    </div>
  );
}

function downloadCsv(title: string, rows: object[]) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [keys.join(";")].concat(rows.map((r) => keys.map((k) => String((r as Record<string, unknown>)[k] ?? "")).join(";")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadPng(node: HTMLElement | null, title: string) {
  const svg = node?.querySelector("svg");
  if (!svg) return;
  const xml = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 40, 40, 1120, 560);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
