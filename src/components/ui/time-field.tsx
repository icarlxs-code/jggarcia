import { Clock } from "lucide-react";
import { completeTime, maskTimeInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function TimeField({
  id,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        placeholder="00:00"
        aria-label={ariaLabel}
        className="pl-10 font-mono tabular-nums tracking-wider"
        onChange={(e) => onChange(maskTimeInput(e.target.value))}
        onBlur={() => {
          if (!value.trim()) return;
          onChange(completeTime(value));
        }}
      />
    </div>
  );
}
