import { isoDaysAgo, todayISO } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    <>
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={value === c.id}
            onClick={() => onChange(c.id, day || todayISO(), { from, to })}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors",
              value === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {c.label}
          </button>
        ))}
        {value === "periodo" && allowRange ? (
          <>
            <Input type="date" value={from} onChange={(e) => onChange("periodo", day, { from: e.target.value, to })} aria-label="Data inicial" className="h-8 w-[9.5rem]" />
            <Input type="date" value={to} onChange={(e) => onChange("periodo", day, { from, to: e.target.value })} aria-label="Data final" className="h-8 w-[9.5rem]" />
          </>
        ) : (
          <Input
            type="date"
            value={value === "dia" ? day : value === "hoje" ? todayISO() : day}
            onChange={(e) => onChange("dia", e.target.value, { from, to })}
            aria-label="Escolher o dia"
            className="h-8 w-[9.5rem]"
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:hidden">
        <select
          aria-label="Período"
          value={value === "atual" ? "hoje" : value}
          onChange={(e) => onChange(e.target.value as PeriodKey, day || todayISO(), { from, to })}
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm"
        >
          {chips.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        {value === "periodo" && allowRange ? (
          <>
            <Input type="date" value={from} onChange={(e) => onChange("periodo", day, { from: e.target.value, to })} aria-label="Data inicial" className="h-10 w-[9.5rem]" />
            <Input type="date" value={to} onChange={(e) => onChange("periodo", day, { from, to: e.target.value })} aria-label="Data final" className="h-10 w-[9.5rem]" />
          </>
        ) : value === "dia" ? (
          <Input type="date" value={day || todayISO()} onChange={(e) => onChange("dia", e.target.value)} aria-label="Escolher o dia" className="h-10 w-[9.5rem]" />
        ) : null}
      </div>
    </>
  );
}
