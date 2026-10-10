import { useEffect, useRef, useState } from "react";
import { MOTION, usePrefersReducedMotion } from "@/lib/motion";
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
  const [shown, setShown] = useState(reduced ? value : 0);
  const [pop, setPop] = useState(false);
  const from = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      from.current = value;
      setPop(false);
      return;
    }
    const start = from.current;
    const delta = value - start;
    from.current = value;
    if (delta === 0) {
      setShown(value);
      return;
    }
    const t0 = performance.now();
    const dur = Math.min(920, Math.max(MOTION.duration.slow, 380 + Math.min(400, Math.abs(delta))));
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - p) ** 4;
      setShown(start + delta * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setPop(true);
        window.setTimeout(() => setPop(false), 460);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);

  const formatted = decimals > 0 ? shown.toFixed(decimals) : Math.round(shown).toLocaleString("pt-BR");
  return (
    <span className={cn("inline-block tabular-nums", pop && "num-pop", className)}>
      {formatted}
      {suffix}
    </span>
  );
}