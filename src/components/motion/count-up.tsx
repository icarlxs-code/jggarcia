import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** A number whose digits roll into place, on arrival and on every change. */
export function CountUp({
  value,
  suffix = "",
  decimals = 0,
  className,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  // Start at zero once so the figure rolls up when the card arrives.
  const [shown, setShown] = useState(() => (reduced ? value : 0));
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  const format = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  const label = `${value.toLocaleString("pt-BR", format)}${suffix ? ` ${suffix.trim()}` : ""}`;
  return (
    <span className={cn("inline-flex items-baseline tabular-nums", className)} aria-label={label}>
      <NumberFlow
        value={reduced ? value : shown}
        locales="pt-BR"
        format={format}
        animated={!reduced}
        respectMotionPreference={false}
        willChange
        transformTiming={{ duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        spinTiming={{ duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        aria-hidden="true"
      />
      {suffix ? <span aria-hidden="true" className="ml-1 text-[0.5em] font-medium text-muted-foreground">{suffix.trim()}</span> : null}
    </span>
  );
}
