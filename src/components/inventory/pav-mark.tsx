import { Warehouse } from "lucide-react";
import { logoOfPavilhao, pavTitle } from "@/lib/catalog";
import { formatNumber } from "@/lib/format";
import type { Pavilhao } from "@/lib/types";
import { cn } from "@/lib/utils";

type PavLike = Pick<Pavilhao, "id" | "codigo" | "nome"> & { logo?: string };

export function PavMark({
  p,
  size = "md",
  className,
}: {
  p: PavLike;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const dim =
    size === "xl" ? "h-16 w-16" : size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8" : "h-11 w-11";
  const src = p.logo || logoOfPavilhao(p);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn("pav-mark", dim, className)}
      />
    );
  }
  return (
    <span className={cn("pav-mark-fallback", dim, className)}>
      <Warehouse />
    </span>
  );
}

export function PavPicker({
  items,
  value,
  onChange,
  excludeId,
  stockOf,
  unidade,
}: {
  items: PavLike[];
  value: string;
  onChange: (id: string) => void;
  excludeId?: string;
  stockOf?: (id: string) => number;
  unidade?: string;
}) {
  const list = excludeId ? items.filter((p) => p.id !== excludeId) : items;
  return (
    <div className="pav-picker">
      {list.map((p) => {
        const on = value === p.id;
        const stock = stockOf ? stockOf(p.id) : null;
        return (
          <button
            key={p.id}
            type="button"
            className={cn("pav-pick", on && "is-on")}
            aria-pressed={on}
            onClick={() => onChange(p.id)}
          >
            <PavMark p={p} size="lg" />
            <span className="pav-pick-name">{pavTitle(p)}</span>
            {stock != null && unidade ? (
              <span className="pav-pick-stock">
                {formatNumber(stock)} {unidade}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
