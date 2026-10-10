import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { dailySeries } from "@/lib/dashboard-stats";
import { tipoMovimentacaoOf } from "@/lib/movement";
import { addDaysISO, formatNumber, todayISO } from "@/lib/format";
import { db } from "@/lib/store";
import { usePrefersReducedMotion } from "@/lib/motion";

export function ProductCharts({ mercadoriaId, unidade }: { mercadoriaId: string; unidade: string }) {
  const lite = usePrefersReducedMotion();
  const to = todayISO();
  const from = addDaysISO(to, -13);
  const movs = db.listSaidas({ from, to }).filter((s) => s.mercadoria_id === mercadoriaId);
  const externas = movs.filter((s) => tipoMovimentacaoOf(s) !== "transferencia");
  const series = dailySeries(externas, from, to);
  const entrou = series.reduce((a, d) => a + d.entradas, 0);
  const saiu = series.reduce((a, d) => a + d.saidas, 0);
  const pos = db.stockPositions(mercadoriaId).filter((p) => p.quantidade > 0);
  const total = pos.reduce((a, p) => a + p.quantidade, 0);
  const media = saiu / 14;
  const cobertura = media > 0 ? total / media : null;
  const max = Math.max(...pos.map((p) => p.quantidade), 1);

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Leitura deste produto</h2>
      <div className="grid gap-2 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Onde está o saldo</p>
          <p className="text-xs text-muted-foreground">Cada barra é a quantidade real neste pavilhão.</p>
          {total <= 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sem saldo em nenhum pavilhão.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pos.map((p) => {
                const pct = Math.round((p.quantidade / total) * 100);
                return (
                  <li key={p.id}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate">{p.nome}</span>
                      <span className="shrink-0 tabular-nums font-semibold">
                        {formatNumber(p.quantidade)} {unidade}
                        <span className="ml-1 font-medium text-muted-foreground">{pct}%</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, Math.round((p.quantidade / max) * 100))}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Últimos 14 dias</p>
          <p className="text-xs text-muted-foreground">
            Entrou {formatNumber(entrou)} · saiu {formatNumber(saiu)} {unidade}. Transferência interna não entra nessa saída.
            {cobertura == null ? " Sem dados suficientes para estimar a cobertura." : ` Cobertura estimada: ${cobertura.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias, saldo dividido pela média diária das saídas externas destes 14 dias.`}
          </p>
          {!entrou && !saiu ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma entrada ou saída neste período.</p>
          ) : (
            <div className="mt-2 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={1} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis width={32} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <ChartTooltip
                    cursor={{ fill: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs">
                          <p className="mb-1 font-medium">{label}</p>
                          {payload.map((p) => (
                            <p key={String(p.name)} className="tabular-nums">
                              {p.name}: {formatNumber(Number(p.value) || 0)} {unidade}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="entradas" name="Entrou" fill="var(--color-primary)" radius={[2, 2, 0, 0]} maxBarSize={8} isAnimationActive={!lite} animationDuration={lite ? 0 : 700} />
                  <Bar dataKey="saidas" name="Saiu" fill="var(--color-gold)" radius={[2, 2, 0, 0]} maxBarSize={8} isAnimationActive={!lite} animationDuration={lite ? 0 : 700} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}