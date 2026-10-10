import { isoDaysAgo, todayISO } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PeriodKey = "hoje" | "7" | "15" | "30" | "dia" | "periodo";

export function periodRange(key: PeriodKey, day: string, span?: { from: string; to: string }): { from: string; to: string } {
  const hoje = todayISO();
  const chosen = day || hoje;
  if (key === "hoje") return { from: hoje, to: hoje };
  if (key === "7") return { from: isoDaysAgo(6), to: hoje };
  if (key === "15") return { from: isoDaysAgo(14), to: hoje };
  if (key === "30") return { from: isoDaysAgo(29), to: hoje };
  if (key === "periodo") {
    const from = span?.from || chosen;
    const to = span?.to || from;
    return from <= to ? { from, to } : { from: to, to: from };
  }
  return { from: chosen, to: chosen };
}

const CHIPS: { id: PeriodKey; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "7", label: "7 dias" },
  { id: "15", label: "15 dias" },
  { id: "30", label: "30 dias" },
  { id: "dia", label: "Um dia" },
  { id: "periodo", label: "De / até" },
];

export function PeriodFilter({
  value,
  day,
  span,
  allowRange = false,
  onChange,
}: {
  value: PeriodKey | "atual";
  day: string;
  span?: { from: string; to: string };
  allowRange?: boolean;
  onChange: (key: PeriodKey, day: string, span?: { from: string; to: string }) => void;
}) {
  const chips = allowRange ? CHIPS : CHIPS.filter((c) => c.id !== "periodo");
  const from = span?.from || day || todayISO();
  const to = span?.to || from;
  return (
    <div className="filter-group flex flex-wrap items-center gap-3" role="group" aria-label="Período de consulta">
      <Select value={value === "atual" ? "hoje" : value} onValueChange={(key) => onChange(key as PeriodKey, day || todayISO(), { from, to })}>
        <SelectTrigger className="w-44 gap-2" aria-label="Período">
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" /><SelectValue />
        </SelectTrigger>
        <SelectContent>{chips.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
      </Select>
      {value === "periodo" && allowRange ? (
        <>
          <Input type="date" value={from} onChange={(e) => onChange("periodo", day, { from: e.target.value, to })} aria-label="Data inicial" className="w-40" />
          <span className="text-sm text-muted-foreground">até</span>
          <Input type="date" value={to} onChange={(e) => onChange("periodo", day, { from, to: e.target.value })} aria-label="Data final" className="w-40" />
        </>
      ) : value === "dia" ? <Input type="date" value={day || todayISO()} onChange={(e) => onChange("dia", e.target.value)} aria-label="Escolher o dia" className="w-40" /> : null}
    </div>
  );
}
