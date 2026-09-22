import { isoDaysAgo, todayISO } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PeriodKey = "hoje" | "7" | "15" | "30" | "dia";

export function periodRange(key: PeriodKey, day: string): { from: string; to: string } {
  const hoje = todayISO();
  const chosen = day || hoje;
  if (key === "hoje") return { from: hoje, to: hoje };
  if (key === "7") return { from: isoDaysAgo(6), to: hoje };
  if (key === "15") return { from: isoDaysAgo(14), to: hoje };
  if (key === "30") return { from: isoDaysAgo(29), to: hoje };
  return { from: chosen, to: chosen };
}

const CHIPS: { id: PeriodKey; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "7", label: "7 dias" },
  { id: "15", label: "15 dias" },
  { id: "30", label: "30 dias" },
  { id: "dia", label: "Dia" },
];

export function PeriodFilter({
  value,
  day,
  onChange,
}: {
  value: PeriodKey | "atual";
  day: string;
  onChange: (key: PeriodKey, day: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CHIPS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id, c.id === "dia" ? day || todayISO() : day || todayISO())}
          className={cn(
            "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors",
            value === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          {c.label}
        </button>
      ))}
      <Input
        type="date"
        value={value === "dia" ? day : value === "hoje" ? todayISO() : day}
        onChange={(e) => onChange("dia", e.target.value)}
        aria-label="Escolher o dia"
        className="h-9 w-[10.5rem]"
      />
    </div>
  );
}
