import { cn } from "@/lib/utils";
import type { Destino } from "@/lib/types";
import { NameMark } from "@/components/brand/name-mark";

export function ClientMark({ d, size = "md" }: { d: Pick<Destino, "nome" | "logo">; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16" : "h-11 w-11";
  if (d.logo) {
    return <img src={d.logo} alt="" className={cn(dim, "rounded-xl border border-border bg-card object-contain p-1")} />;
  }
  return <NameMark nome={d.nome || "?"} size={size === "lg" ? "lg" : "md"} />;
}
