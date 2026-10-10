import gsap from "gsap";
import { applyThemeChoice, isThemeId, normalizeHex, tokensFor, type ThemeId, type ThemeMode } from "@/lib/theme";
import { paintTheme } from "@/lib/theme-motion";

export type ChartWidgetId =
  | "destaques"
  | "topEntrada"
  | "topSaida"
  | "comparativo"
  | "empilhador"
  | "movimento";

export const CHART_WIDGETS: { id: ChartWidgetId; label: string; hint: string }[] = [
  { id: "destaques", label: "Destaques", hint: "O produto que mais entrou e o que mais saiu" },
  { id: "topEntrada", label: "Mais entrou", hint: "Ranking dos produtos que chegaram" },
  { id: "topSaida", label: "Mais saiu", hint: "Ranking dos produtos que saíram" },
  { id: "comparativo", label: "Entrada × saída", hint: "Comparativo lado a lado" },
  { id: "empilhador", label: "Empilhador mais rápido", hint: "Tempo médio, mais rápido e mais lento" },
  { id: "movimento", label: "Movimento no período", hint: "Gráfico dia a dia" },
];

export type ChartFlags = Record<ChartWidgetId, boolean>;

export const DEFAULT_CHARTS: ChartFlags = {
  destaques: false,
  topEntrada: true,
  topSaida: true,
  comparativo: true,
  empilhador: true,
  movimento: false,
};

export type PeriodoPadrao = "hoje" | "7" | "30";

export interface UserUiPrefs {
  charts: ChartFlags;
  /** Ausente = verde e branco, até a pessoa escolher. */
  tema?: ThemeMode;
  temaId: ThemeId;
  temaCor: string;
  som: boolean;
  avisarDuplicado: boolean;
  pavilhaoPadraoId: string;
  validadeDias: number;
  criticoPct: number;
  baixoPct: number;
  descontaPadrao: boolean;
  periodoPadrao: PeriodoPadrao;
  /** Sem transições nem animações. Só nesta conta. */
  sistemaLite: boolean;
}

const KEY = "jg-garcia-ui-prefs-v2";

const listeners = new Set<() => void>();
let activeId: string | null = null;

function clamp(n: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function defaultUiPrefs(): UserUiPrefs {
  return {
    charts: { ...DEFAULT_CHARTS },
    som: true,
    avisarDuplicado: true,
    pavilhaoPadraoId: "",
    validadeDias: 7,
    criticoPct: 20,
    baixoPct: 50,
    descontaPadrao: true,
    periodoPadrao: "hoje",
    sistemaLite: false,
    temaId: "verde-branco",
    temaCor: "#1b5c3e",
  };
}

function normalize(row?: Partial<UserUiPrefs> | null): UserUiPrefs {
  const base = defaultUiPrefs();
  if (!row) return base;
  const criticoPct = clamp(Number(row.criticoPct), 5, 40, base.criticoPct);
  let baixoPct = clamp(Number(row.baixoPct), 25, 100, base.baixoPct);
  if (baixoPct <= criticoPct) baixoPct = Math.min(100, criticoPct + 10);
  const periodo = row.periodoPadrao === "7" || row.periodoPadrao === "30" ? row.periodoPadrao : "hoje";
  const temaId: ThemeId = isThemeId(String(row.temaId ?? "")) ? (row.temaId as ThemeId) : row.tema === "dark" ? "noite" : "verde-branco";
  const temaCor = normalizeHex(String(row.temaCor ?? ""), "#1b5c3e");
  const tema: ThemeMode = tokensFor(temaId, temaCor).dark ? "dark" : "light";
  return {
    charts: { ...DEFAULT_CHARTS, ...(row.charts ?? {}) },
    tema,
    temaId,
    temaCor,
    som: row.som !== false,
    avisarDuplicado: row.avisarDuplicado !== false,
    pavilhaoPadraoId: typeof row.pavilhaoPadraoId === "string" ? row.pavilhaoPadraoId : "",
    validadeDias: clamp(Number(row.validadeDias), 1, 60, base.validadeDias),
    criticoPct,
    baixoPct,
    descontaPadrao: row.descontaPadrao !== false,
    periodoPadrao: periodo,
    sistemaLite: row.sistemaLite === true,
  };
}

function readAll(): Record<string, Partial<UserUiPrefs>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<UserUiPrefs>>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, UserUiPrefs>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribePrefs(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function activeUserId() {
  return activeId;
}

const LITE_STYLE_ID = "jg-lite-kill";
const LITE_CSS = `
html.is-lite, html.is-lite *, html.is-lite *::before, html.is-lite *::after {
  animation: none !important;
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition: none !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
  caret-color: auto;
}
html.is-lite {
  --motion-micro: 0ms;
  --motion-fast: 0s;
  --motion-slow: 0s;
  --motion-hero: 0s;
}
html.is-lite .split-overlay,
html.is-lite .login-shell.is-leaving {
  display: none !important;
}
html.is-lite .login-shell,
html.is-lite .login-shell.is-entering {
  display: flex !important;
  opacity: 1 !important;
  visibility: visible !important;
  animation: none !important;
  transform: none !important;
}
html.is-lite .spot-card::before,
html.is-lite .spot-card::after,
html.is-lite .product-stage-orb,
html.is-lite .product-stage-floor,
html.is-lite .glass-1,
html.is-lite .glass-2,
html.is-lite .glass-3 {
  display: none !important;
  backdrop-filter: none !important;
}
html.is-lite [class*="backdrop-blur"],
html.is-lite [class*="blur-"] {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  filter: none !important;
}
`;

let motionPatched = false;

function zeroTween(vars: unknown) {
  if (!vars || typeof vars !== "object") return;
  const row = vars as { duration?: number; delay?: number };
  row.duration = 0;
  row.delay = 0;
}

function installLiteRuntime() {
  if (typeof document === "undefined" || motionPatched) return;
  motionPatched = true;
  const style = document.createElement("style");
  style.id = LITE_STYLE_ID;
  style.textContent = LITE_CSS;
  document.head.appendChild(style);

  const wrap = <T extends (...args: never[]) => unknown>(fn: T): T =>
    function (this: unknown, ...args: never[]) {
      if (document.documentElement.classList.contains("is-lite")) {
        zeroTween(args[args.length - 1]);
        if (args.length >= 3) zeroTween(args[2]);
      }
      return fn.apply(this, args);
    } as T;
  gsap.to = wrap(gsap.to);
  gsap.from = wrap(gsap.from);
  gsap.fromTo = wrap(gsap.fromTo);

  const doc = document as Document & { __jgViewPatched?: boolean };
  if (typeof document.startViewTransition === "function" && !doc.__jgViewPatched) {
    const native = document.startViewTransition.bind(document);
    doc.__jgViewPatched = true;
    document.startViewTransition = ((input: unknown) => {
      const update =
        typeof input === "function"
          ? (input as () => unknown)
          : input && typeof input === "object" && typeof (input as { update?: unknown }).update === "function"
            ? (input as { update: () => unknown }).update
            : null;
      const root = document.documentElement;
      let reduced = false;
      try {
        reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        reduced = false;
      }
      const skip = true;
      if (!skip) {
        try {
          return native(input as never);
        } catch {
          /* segue sem animação */
        }
      }
      let updateCallbackDone: Promise<void>;
      try {
        updateCallbackDone = Promise.resolve(update ? update() : undefined).then(
          () => undefined,
          () => undefined,
        );
      } catch {
        updateCallbackDone = Promise.resolve();
      }
      return {
        finished: updateCallbackDone,
        ready: updateCallbackDone,
        updateCallbackDone,
        skipTransition() {},
        types: new Set<string>(),
      };
    }) as typeof document.startViewTransition;
  }
}

/** Called while the session renders so the rest of the app reads this account. */
export function applyLiteMode(on: boolean) {
  if (typeof document === "undefined") return;
  installLiteRuntime();
  document.getElementById(LITE_STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = LITE_STYLE_ID;
  style.textContent = LITE_CSS;
  document.head.appendChild(style);
  document.documentElement.classList.toggle("is-lite", on);
  document.body?.classList.toggle("is-lite", on);
  gsap.globalTimeline.timeScale(on ? 1000000 : 1);
  if (on) gsap.globalTimeline.getChildren(false, true, true).forEach((tween) => tween.progress(1).kill());
}

export function setActiveUserId(id: string | null) {
  activeId = id;
  if (!id) {
    applyLiteMode(false);
    applyThemeChoice("verde-branco");
    writeUiPrefs(null, { temaId: "verde-branco" });
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
    return;
  }
  const prefs = readUiPrefs(id);
  applyLiteMode(prefs.sistemaLite);
  applyThemeChoice(prefs.temaId, prefs.temaCor);
}

export function readUiPrefs(userId?: string | null): UserUiPrefs {
  const id = userId || "_anon";
  return normalize(readAll()[id]);
}

export function activePrefs(): UserUiPrefs {
  return readUiPrefs(activeId);
}

export function writeUiPrefs(userId: string | null | undefined, patch: Partial<UserUiPrefs>) {
  const id = userId || "_anon";
  const all = readAll();
  const prev = normalize(all[id]);
  const next = normalize({
    ...prev,
    ...patch,
    charts: { ...prev.charts, ...(patch.charts ?? {}) },
  });
  all[id] = next;
  writeAll(all as Record<string, UserUiPrefs>);
  if (id === (activeId || "_anon")) {
    applyLiteMode(next.sistemaLite);
    const themeChanged = next.temaId !== prev.temaId || next.temaCor !== prev.temaCor;
    if (themeChanged) paintTheme(next.temaId, next.temaCor, true);
  }
  emit();
  return next;
}

export function resetUiPrefs(userId: string | null | undefined) {
  const id = userId || "_anon";
  const all = readAll();
  delete all[id];
  writeAll(all as Record<string, UserUiPrefs>);
  if (id === (activeId || "_anon")) {
    applyLiteMode(false);
    paintTheme("verde-branco", undefined, true);
  }
  emit();
  return defaultUiPrefs();
}

export function toggleUserTheme(): ThemeMode {
  const prefs = activePrefs();
  const dark = tokensFor(prefs.temaId, prefs.temaCor).dark;
  const nextId: ThemeId = dark ? "branco-verde" : "preto-total";
  writeUiPrefs(activeId, { temaId: nextId });
  applyThemeChoice(nextId);
  return dark ? "light" : "dark";
}

export function setUserTheme(userId: string | null | undefined, mode: ThemeMode) {
  return writeUiPrefs(userId, { temaId: mode === "dark" ? "noite" : "verde-branco" });
}

export function setUserPalette(userId: string | null | undefined, temaId: ThemeId, temaCor?: string) {
  return writeUiPrefs(userId, { temaId, ...(temaCor ? { temaCor: normalizeHex(temaCor) } : {}) });
}

if (typeof document !== "undefined") installLiteRuntime();