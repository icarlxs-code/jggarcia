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
        name={id ? `${id}-clock` : "hora-livre"}
        value={value}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="hh:mm"
        aria-label={ariaLabel}
        data-lpignore="true"
        data-1p-ignore="true"
        className="pl-10 font-mono tabular-nums tracking-wider placeholder:text-muted-foreground/55"
        onChange={(e) => onChange(maskTimeInput(e.target.value))}
        onBlur={() => {
          if (!value.trim()) return;
          onChange(completeTime(value));
        }}
      />
    </div>
  );
}
