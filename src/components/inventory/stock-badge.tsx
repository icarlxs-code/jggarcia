import { AlertTriangle, Check, Minus, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StockAlert } from "@/lib/types";

const COPY: Record<StockAlert, { label: string; variant: "success" | "muted" | "gold" | "destructive"; icon: typeof Check }> = {
  ok: { label: "Em estoque", variant: "success", icon: Check },
  atencao: { label: "Atenção", variant: "muted", icon: Minus },
  baixo: { label: "Baixo", variant: "gold", icon: AlertTriangle },
  critico: { label: "Crítico", variant: "destructive", icon: ShieldAlert },
};

export function StockBadge({ alert }: { alert: StockAlert }) {
  const c = COPY[alert] ?? COPY.ok;
  const Icon = c.icon;
  return (
    <Badge variant={c.variant} className="gap-1 font-medium">
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}
