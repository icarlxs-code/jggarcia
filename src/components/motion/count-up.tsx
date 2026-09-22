import { useEffect, useRef, useState } from "react";
import { MOTION, usePrefersReducedMotion } from "@/lib/motion";

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
  const from = useRef(0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
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
    const dur = MOTION.duration.slow;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - p) ** 3;
      setShown(start + delta * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);

  const formatted = decimals > 0 ? shown.toFixed(decimals) : Math.round(shown).toLocaleString("pt-BR");
  return (
    <span className={className}>
      {formatted}
      {suffix}
    </span>
  );
}
