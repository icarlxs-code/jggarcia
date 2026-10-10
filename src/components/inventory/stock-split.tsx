import { db } from "@/lib/store";
import { pavTitle } from "@/lib/catalog";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductIcon } from "@/components/inventory/product-icon";

function frasePt(partes: string[]) {
  if (partes.length <= 1) return partes[0] || "";
  if (partes.length === 2) return `${partes[0]} e ${partes[1]}`;
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

export function StockSplit({
  mercadoriaId,
  highlightId,
  delta = 0,
  className,
  showProduct,
  onSelect,
}: {
  mercadoriaId: string;
  highlightId?: string;
  delta?: number;
  className?: string;
  showProduct?: boolean;
  onSelect?: (id: string) => void;
}) {
  const merc = db.listMercadorias().find((m) => m.id === mercadoriaId);
  const pavilhoes = db.listPavilhoes();
  if (!merc) return null;
  const pos = db.stockPositions(mercadoriaId);
  const unidade = merc.unidade;
  const total = pos.reduce((a, p) => a + p.quantidade, 0);
  const nextTotal = Math.max(0, total + (highlightId ? delta : 0));
  const vivos = pos.filter((p) => p.quantidade > 0);
  const frase = !vivos.length
    ? `Não tem ${unidade.toLowerCase()} em nenhum pavilhão.`
    : `Tem ${frasePt(
        vivos.map((p, i) =>
          i === 0 ? `${formatNumber(p.quantidade)} ${unidade.toLowerCase()} no ${p.nome}` : `${formatNumber(p.quantidade)} no ${p.nome}`,
        ),
      )}. Total na empresa: ${formatNumber(total)} ${unidade.toLowerCase()}.`;

  return (
    <div className={cn("rounded-2xl border border-border bg-muted/40 p-4", className)}>
      {showProduct ? (
        <div className="mb-3 flex items-center gap-3">
          <ProductIcon nome={merc.nome} codigo={merc.codigo} size="md" />
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold tabular-nums">{merc.codigo}</p>
            <p className="truncate text-sm">{merc.nome}</p>
          </div>
        </div>
      ) : null}
      <p className="mb-3 text-sm leading-snug text-foreground">{frase}</p>
      <ul className="space-y-1.5">
        {pavilhoes.map((p) => {
          const atual = pos.find((x) => x.id === p.id)?.quantidade || 0;
          const on = highlightId === p.id;
          const depois = on ? Math.max(0, atual + delta) : atual;
          const inner = (
            <>
              <span className={cn("min-w-0 truncate", on ? "font-medium" : "text-muted-foreground")}>{pavTitle(p)}</span>
              <span className="shrink-0 tabular-nums">
                {on && delta !== 0 ? (
                  <>
                    <span className="text-muted-foreground">{formatNumber(atual)}</span>
                    <span className="mx-1 text-muted-foreground">→</span>
                    <span className="font-semibold">{formatNumber(depois)}</span>
                  </>
                ) : (
                  <span className={atual ? "font-medium" : "text-muted-foreground"}>{formatNumber(atual)}</span>
                )}{" "}
                <span className="text-xs text-muted-foreground">{unidade}</span>
              </span>
            </>
          );
          return (
            <li key={p.id}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm",
                    on ? "bg-card ring-1 ring-primary/30" : "hover:bg-card/70",
                  )}
                >
                  {inner}
                </button>
              ) : (
                <div className={cn("flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm", on && "bg-card ring-1 ring-primary/30")}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-medium">Total na empresa</span>
        <span className="tabular-nums text-lg font-semibold leading-none">
          {highlightId && delta !== 0 ? (
            <>
              <span className="text-sm font-normal text-muted-foreground">{formatNumber(total)} → </span>
              {formatNumber(nextTotal)}
            </>
          ) : (
            formatNumber(total)
          )}{" "}
          <span className="text-sm font-normal text-muted-foreground">{unidade}</span>
        </span>
      </div>
    </div>
  );
}