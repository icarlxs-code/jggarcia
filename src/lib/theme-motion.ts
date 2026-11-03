import gsap from "gsap";
import { cssColorToHex, mixHex, THEME_CSS_VARS, tokensFor, applyTokens, type ThemeId, type ThemeTokens } from "@/lib/theme";
import { prefersReducedMotion } from "@/lib/motion";

const lastPointer = { x: 0, y: 72 };
let tween: gsap.core.Tween | null = null;
let wash: HTMLDivElement | null = null;

if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (event) => {
      lastPointer.x = event.clientX;
      lastPointer.y = event.clientY;
    },
    true,
  );
}

function readTokens(): ThemeTokens | null {
  if (typeof document === "undefined") return null;
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const tokens = {} as ThemeTokens;
  for (const [key, cssVar] of THEME_CSS_VARS) {
    const current = style.getPropertyValue(cssVar).trim();
    if (!current) return null;
    tokens[key] = cssColorToHex(current, current.startsWith("#") ? current : "#000000");
  }
  return tokens;
}

function bloom(color: string) {
  if (typeof document === "undefined") return;
  if (!wash) {
    wash = document.createElement("div");
    wash.className = "theme-wash";
    wash.setAttribute("aria-hidden", "true");
    document.body.appendChild(wash);
  }
  const x = lastPointer.x || window.innerWidth / 2;
  const y = lastPointer.y || 72;
  wash.style.setProperty("--wash", color);
  wash.style.setProperty("--wx", `${x}px`);
  wash.style.setProperty("--wy", `${y}px`);
  wash.classList.remove("is-on");
  void wash.offsetWidth;
  wash.classList.add("is-on");
}

/** Pinta o tema. Com `fluid`, as cores caminham até o destino em vez de cortar. */
export function paintTheme(id: ThemeId, color?: string, fluid = false) {
  const { dark, tokens } = tokensFor(id, color);
  if (typeof document === "undefined") return;
  document.documentElement.dataset.themeId = id;
  const instant = !fluid || prefersReducedMotion();
  if (instant) {
    tween?.kill();
    tween = null;
    document.documentElement.classList.remove("is-theme-morph");
    applyTokens(tokens, dark);
    return;
  }

  const from = readTokens();
  if (!from) {
    applyTokens(tokens, dark);
    return;
  }

  const same = THEME_CSS_VARS.every(([key]) => from[key].toLowerCase() === tokens[key].toLowerCase());
  if (same) {
    applyTokens(tokens, dark);
    return;
  }

  const root = document.documentElement;
  const state = { t: 0 };
  const distance = id === "cor" ? 0.42 : 0.68;
  tween?.kill();
  root.classList.add("is-theme-morph");
  bloom(tokens.primary);
  tween = gsap.to(state, {
    t: 1,
    duration: distance,
    ease: "power3.out",
    overwrite: true,
    onUpdate() {
      const frame = {} as ThemeTokens;
      for (const [key] of THEME_CSS_VARS) frame[key] = mixHex(from[key], tokens[key], state.t);
      applyTokens(frame, dark);
    },
    onComplete() {
      applyTokens(tokens, dark);
      root.classList.remove("is-theme-morph");
      tween = null;
    },
  });
}
