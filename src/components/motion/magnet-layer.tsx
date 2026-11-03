import { useEffect } from "react";
import { prefersReducedMotion } from "@/lib/motion";

const SELECTOR = ".jg-btn.bg-primary, .magnet";
const PULL = 0.18;
const MAX = 4;

/** Primary actions lean a few pixels toward the pointer (mouse only). */
export function MagnetLayer() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let current: HTMLElement | null = null;
    let frame = 0;
    const reset = (el: HTMLElement) => {
      el.style.removeProperty("--mag-x");
      el.style.removeProperty("--mag-y");
    };
    const onMove = (e: PointerEvent) => {
      if (!fine.matches || prefersReducedMotion()) return;
      const el = (e.target as Element | null)?.closest?.(SELECTOR) as HTMLElement | null;
      if (current && current !== el) reset(current);
      current = el;
      if (!el || (el as HTMLButtonElement).disabled) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = Math.max(-MAX, Math.min(MAX, (e.clientX - (r.left + r.width / 2)) * PULL));
        const dy = Math.max(-MAX / 2, Math.min(MAX / 2, (e.clientY - (r.top + r.height / 2)) * PULL));
        el.style.setProperty("--mag-x", `${dx.toFixed(2)}px`);
        el.style.setProperty("--mag-y", `${dy.toFixed(2)}px`);
      });
    };
    const onLeave = () => {
      if (current) reset(current);
      current = null;
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);
  return null;
}
