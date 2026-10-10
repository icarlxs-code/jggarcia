import { useEffect, useState } from "react";

export const MOTION = {
  duration: {
    micro: 150,
    fast: 150,
    normal: 200,
    slow: 280,
    page: 200,
    hero: 280,
    icon: 280,
  },
  ease: {
    standard: "cubic-bezier(0.22, 1, 0.36, 1)",
    enter: "cubic-bezier(0.16, 1, 0.3, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    spring: "cubic-bezier(0.34, 1.2, 0.64, 1)",
  },
} as const;

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  if (document.documentElement.classList.contains("is-lite")) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function canHoverFine() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => prefersReducedMotion());
  useEffect(() => {
    const read = () => setReduced(prefersReducedMotion());
    read();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => read();
    mq.addEventListener("change", onChange);
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mq.removeEventListener("change", onChange);
      obs.disconnect();
    };
  }, []);
  return reduced;
}

export function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setFine(mq.matches);
    const onChange = () => setFine(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return fine;
}
