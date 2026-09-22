import { cn } from "@/lib/utils";
import type { Destino } from "@/lib/types";

export function ClientMark({ d, size = "md" }: { d: Pick<Destino, "nome" | "logo">; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16" : "h-11 w-11";
  if (d.logo) {
    return <img src={d.logo} alt="" className={cn(dim, "rounded-xl border border-border bg-card object-contain p-1")} />;
  }
  return (
    <span className={cn("inline-flex items-center justify-center rounded-xl bg-mint font-display text-sm font-semibold text-primary", dim)}>
      {(d.nome || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
