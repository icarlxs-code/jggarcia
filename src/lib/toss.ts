import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";

export function rowEl(id: string) {
  return document.querySelector<HTMLElement>(`[data-toss-id="${CSS.escape(id)}"]`);
}

/** Clone a row and crumple it toward the bottom — like a satisfying toss into the bin. */
export function tossAway(el: HTMLElement | null) {
  if (!el || prefersReducedMotion()) return;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-toss-id");
  clone.setAttribute("aria-hidden", "true");
  Object.assign(clone.style, {
    position: "fixed",
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: "0",
    zIndex: "85",
    pointerEvents: "none",
    transformOrigin: "62% 85%",
    overflow: "hidden",
    borderRadius: "12px",
    boxShadow: "0 18px 40px rgb(12 20 16 / 0.22)",
    background: "var(--color-card)",
  });
  document.body.appendChild(clone);
  gsap.set(clone, { transformPerspective: 900, force3D: true });
  gsap.to(clone, {
    x: 18,
    y: 110,
    rotate: 16,
    rotateX: 52,
    scale: 0.1,
    opacity: 0,
    filter: "blur(6px)",
    duration: 0.68,
    ease: "power3.in",
    onComplete: () => clone.remove(),
  });
}

export function pulseDock() {
  const el =
    document.querySelector<HTMLElement>("[data-entrada-dock='true']") ||
    document.querySelector<HTMLElement>('a[href="/entradas"]');
  if (!el) return;
  el.classList.remove("dock-catch");
  void el.offsetWidth;
  el.classList.add("dock-catch");
  window.setTimeout(() => el.classList.remove("dock-catch"), 560);
}
