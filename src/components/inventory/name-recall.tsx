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
  const shown = names.filter((n) => !term || fold(n).includes(term)).slice(0, 10);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? "" : <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {shown.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {shown.map((n) => {
            const on = fold(value) === fold(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(on ? "" : n)}
                className={cn(
                  "min-h-10 rounded-full border px-3 text-sm font-medium transition-colors",
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || (names.length ? "Ou escreva um nome novo" : "Escreva o nome")}
        autoComplete="off"
        className="h-12"
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
