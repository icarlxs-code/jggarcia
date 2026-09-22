import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fold } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function NameRecall({
  id,
  label,
  value,
  onChange,
  names,
  placeholder,
  hint,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  names: string[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  const term = fold(value.trim());
  const chips = (term ? names.filter((n) => fold(n).includes(term)) : names).slice(0, 12);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? "" : <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {names.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((n) => {
            const on = fold(n) === term && term.length > 0;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      ) : null}
      <Input
        id={id}
        name={`${id}-livre`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Escreva o nome"}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        className="h-12"
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
