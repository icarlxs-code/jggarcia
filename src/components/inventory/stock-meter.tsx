import type { StockAlert } from "@/lib/types";

/**
 * Availability at a glance: the bar spans twice the product's minimum, so the
 * tick in the middle is the minimum itself. Colour follows the existing alert.
 */
export function StockMeter({ total, minimo, alert }: { total: number; minimo: number; alert: StockAlert }) {
  if (!(minimo > 0)) return null;
  const fill = Math.max(0, Math.min(1, total / (minimo * 2)));
  return (
    <span className="stock-meter" data-alert={alert} title={`Mínimo: ${minimo.toLocaleString("pt-BR")}`} aria-hidden="true">
      <i style={{ width: `${(fill * 100).toFixed(1)}%` }} />
      <b />
    </span>
  );
}
