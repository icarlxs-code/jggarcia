import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

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
  const [shown, setShown] = useState(value);
  const displayed = useRef(value);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      displayed.current = value;
      return;
    }
    const start = displayed.current;
    const delta = value - start;
    if (delta === 0) {
      setShown(value);
      return;
    }
    const t0 = performance.now();
    const dur = 480;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - p) ** 4;
      displayed.current = start + delta * eased;
      setShown(displayed.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);

  const format = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const label = `${format(value)}${suffix ? ` ${suffix.trim()}` : ""}`;
  return (
    <span className={cn("inline-block tabular-nums", className)} aria-label={label}>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{format(reduced ? value : shown)}</span>
      {suffix ? <span aria-hidden="true" className="ml-1 text-[0.5em] font-medium text-muted-foreground">{suffix.trim()}</span> : null}
    </span>
  );
}
