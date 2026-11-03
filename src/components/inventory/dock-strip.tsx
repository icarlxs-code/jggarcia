import type { Pavilhao, Saida } from "@/lib/types";
import { ModuleTile } from "@/components/brand/module-tile";
import { CountUp } from "@/components/motion/count-up";
import { lugarDaSaida } from "@/lib/catalog";
import { formatNumber, formatTime } from "@/lib/format";

/** The receiving dock today: how many arrivals, the latest one, and the volume by unit. */
export function DockStrip({ entradas, pavilhoes }: { entradas: Saida[]; pavilhoes: Pavilhao[] }) {
  const ultima = [...entradas].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
  const porUnidade = new Map<string, number>();
  for (const e of entradas) porUnidade.set(e.unidade || "Unidade", (porUnidade.get(e.unidade || "Unidade") || 0) + (Number(e.quantidade) || 0));
  return (
    <section className="dock-strip glyph-host" aria-label="Doca de recebimento de hoje">
      <ModuleTile id="entradas" size="lg" live={entradas.length > 0} />
      <div className="dock-count">
        <span className="kpi-figure text-3xl leading-none">
          <CountUp value={entradas.length} />
        </span>
        <span className="text-xs text-muted-foreground">{entradas.length === 1 ? "chegada hoje" : "chegadas hoje"}</span>
      </div>
      <div className="dock-last min-w-0">
        <span className="text-xs text-muted-foreground">Última chegada</span>
        {ultima ? (
          <span className="block truncate text-sm font-semibold">
            {formatTime(ultima.hora_saida) || "—"} · {ultima.mercadoria?.nome ?? "produto"} · {lugarDaSaida(pavilhoes, ultima)}
          </span>
        ) : (
          <span className="block text-sm text-muted-foreground">A doca ainda não recebeu nada hoje.</span>
        )}
      </div>
      {porUnidade.size ? (
        <ul className="dock-units" aria-label="Volume recebido por unidade">
          {[...porUnidade.entries()].map(([u, q]) => (
            <li key={u}>
              <b className="tabular-nums">{formatNumber(q)}</b> {u}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
