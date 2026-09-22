const KEY = "jg-viewport";

export type ViewportPref = "auto" | "phone" | "computer";
export type ViewportKind = "phone" | "computer";

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeViewport(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function detectPhone() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const mobileUa = /Android|iPhone|iPod|iPad|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const narrow = window.matchMedia("(max-width: 820px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return mobileUa || (narrow && coarse) || window.innerWidth < 768;
}

export function readViewportPref(): ViewportPref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "phone" || v === "computer" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function resolveViewport(pref = readViewportPref()): ViewportKind {
  if (pref === "phone") return "phone";
  if (pref === "computer") return "computer";
  return detectPhone() ? "phone" : "computer";
}

export function applyViewport(pref: ViewportPref) {
  const kind = resolveViewport(pref);
  const root = document.documentElement;
  if (root.dataset.viewport === kind && root.classList.contains(kind === "phone" ? "is-phone" : "is-computer")) {
    try {
      if (localStorage.getItem(KEY) !== pref) localStorage.setItem(KEY, pref);
    } catch {
      /* ignore */
    }
    return kind;
  }
  root.classList.toggle("is-phone", kind === "phone");
  root.classList.toggle("is-computer", kind === "computer");
  root.dataset.viewport = kind;
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  emit();
  return kind;
}

export function getViewport(): ViewportKind {
  if (typeof document === "undefined") return "computer";
  return document.documentElement.classList.contains("is-phone") ? "phone" : "computer";
}

export function cycleViewport(): ViewportPref {
  const cur = readViewportPref();
  const next: ViewportPref = cur === "auto" ? (getViewport() === "phone" ? "computer" : "phone") : cur === "phone" ? "computer" : "phone";
  applyViewport(next);
  return next;
}

export function setViewportPref(pref: ViewportPref) {
  applyViewport(pref);
  return resolveViewport(pref);
}
