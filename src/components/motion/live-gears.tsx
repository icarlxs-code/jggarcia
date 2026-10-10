/** Linha do dado real. Sem pontos, fica reta. A soma dos pontos é o número do cartão. */
export function Spark({
  values,
  tone = "in",
  label = "Distribuição do número ao lado",
}: {
  values: number[];
  tone?: string;
  label?: string;
}) {
  const pts = values.length ? values : [0];
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const flat = max === min;
  const span = max - min || 1;
  const w = 72;
  const h = 28;
  const pad = 3;
  const yOf = (v: number) => (flat ? h / 2 : pad + (1 - (v - min) / span) * (h - pad * 2));
  const d =
    pts.length === 1
      ? `M4 ${yOf(pts[0])} H68`
      : pts
          .map((v, i) => {
            const x = pad + (i / (pts.length - 1)) * (w - pad * 2);
            return `${i ? "L" : "M"}${x.toFixed(1)} ${yOf(v).toFixed(1)}`;
          })
          .join(" ");
  const last = pts[pts.length - 1];
  const lx = pts.length === 1 ? 68 : w - pad;
  return (
    <svg className={`kpi-spark is-${tone || "in"}${flat ? " is-flat" : ""}`} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <path d={d} />
      <circle cx={lx} cy={yOf(last)} r="1.7" />
    </svg>
  );
}