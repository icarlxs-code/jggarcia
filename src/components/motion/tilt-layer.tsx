import { useEffect } from "react";
import { prefersReducedMotion } from "@/lib/motion";

const SELECTOR = ".kpi-card, .hoje-kpi, .gauge-card, .radar-card, .tilt-on";
const MAX = 6;

/** Tilts cards toward the pointer (mouse only); one listener for the whole app. */
export function TiltLayer() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let current: HTMLElement | null = null;
    let frame = 0;

    const reset = (el: HTMLElement) => {
      el.classList.remove("is-tilting");
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };

    const onMove = (e: PointerEvent) => {
      if (!fine.matches || prefersReducedMotion()) return;
      const el = (e.target as Element | null)?.closest?.(SELECTOR) as HTMLElement | null;
      if (current && current !== el) reset(current);
      current = el;
      if (!el) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        // Large cards lean less, so wide panels never swing.
        const k = Math.min(1, 320 / Math.max(r.width, r.height));
        el.classList.add("tilt", "is-tilting");
        el.style.setProperty("--ry", `${((px - 0.5) * 2 * MAX * k).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-(py - 0.5) * 2 * MAX * k).toFixed(2)}deg`);
        el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
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
