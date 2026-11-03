export type ThemeId =
  | "nova"
  | "nova-noite"
  | "verde-branco"
  | "branco-verde"
  | "branco-total"
  | "preto-total"
  | "noite"
  | "grafite"
  | "areia"
  | "oceano"
  | "vinho"
  | "dourado"
  | "cor";

export type ThemeMode = "light" | "dark";

export type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  destructive: string;
  destructiveForeground: string;
  accent: string;
  accentForeground: string;
  gold: string;
  goldInk: string;
  mint: string;
  forest: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarAccent: string;
  sidebarBorder: string;
};

export type ThemePreset = {
  id: Exclude<ThemeId, "cor">;
  label: string;
  hint: string;
  dark: boolean;
  tokens: ThemeTokens;
};

const TOKEN_VARS: [keyof ThemeTokens, string][] = [
  ["background", "--color-background"],
  ["foreground", "--color-foreground"],
  ["card", "--color-card"],
  ["cardForeground", "--color-card-foreground"],
  ["muted", "--color-muted"],
  ["mutedForeground", "--color-muted-foreground"],
  ["border", "--color-border"],
  ["input", "--color-input"],
  ["ring", "--color-ring"],
  ["primary", "--color-primary"],
  ["primaryForeground", "--color-primary-foreground"],
  ["secondary", "--color-secondary"],
  ["secondaryForeground", "--color-secondary-foreground"],
  ["destructive", "--color-destructive"],
  ["destructiveForeground", "--color-destructive-foreground"],
  ["accent", "--color-accent"],
  ["accentForeground", "--color-accent-foreground"],
  ["gold", "--color-gold"],
  ["goldInk", "--color-gold-ink"],
  ["mint", "--color-mint"],
  ["forest", "--color-forest"],
  ["sidebar", "--color-sidebar"],
  ["sidebarForeground", "--color-sidebar-foreground"],
  ["sidebarAccent", "--color-sidebar-accent"],
  ["sidebarBorder", "--color-sidebar-border"],
];

function paint(partial: Partial<ThemeTokens> & Pick<ThemeTokens, "background" | "foreground" | "card" | "primary" | "primaryForeground" | "sidebar" | "sidebarForeground">): ThemeTokens {
  return {
    cardForeground: partial.foreground,
    muted: partial.card,
    mutedForeground: partial.foreground,
    border: partial.primary,
    input: partial.primary,
    ring: partial.primary,
    secondary: partial.card,
    secondaryForeground: partial.foreground,
    destructive: "#b42318",
    destructiveForeground: "#fff8f7",
    accent: partial.primary,
    accentForeground: partial.primaryForeground,
    gold: "#c67a0a",
    goldInk: "#8a4e08",
    mint: partial.card,
    forest: partial.sidebar,
    sidebarAccent: partial.sidebar,
    sidebarBorder: partial.sidebar,
    ...partial,
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "nova",
    label: "Nova Geração",
    hint: "Branco gelo, verde da marca nas ações",
    dark: false,
    tokens: paint({
      background: "#f5f7f3",
      foreground: "#13200f",
      card: "#ffffff",
      muted: "#f0f4ec",
      mutedForeground: "#66735f",
      border: "#e3e9de",
      input: "#dde5d7",
      ring: "#2f8f1c",
      primary: "#2f8f1c",
      primaryForeground: "#ffffff",
      secondary: "#ebf5e5",
      secondaryForeground: "#1f6512",
      accent: "#2f8f1c",
      accentForeground: "#ffffff",
      gold: "#f08c1a",
      goldInk: "#a8560a",
      mint: "#eaf5e3",
      forest: "#0b2410",
      sidebar: "#ffffff",
      sidebarForeground: "#18241a",
      sidebarAccent: "#edf6e7",
      sidebarBorder: "#e7ece3",
    }),
  },
  {
    id: "nova-noite",
    label: "Nova Geração · Noite",
    hint: "Verde-noite com brilho de folha",
    dark: true,
    tokens: paint({
      background: "#04140a",
      foreground: "#e8f5e4",
      card: "#0a2112",
      muted: "#0f2c18",
      mutedForeground: "#8fb095",
      border: "#183d22",
      input: "#1f4a2a",
      ring: "#5cc433",
      primary: "#5cc433",
      primaryForeground: "#04140a",
      secondary: "#103019",
      secondaryForeground: "#d3f2c7",
      accent: "#5cc433",
      accentForeground: "#04140a",
      destructive: "#ff6b6b",
      destructiveForeground: "#2a0606",
      gold: "#ffb547",
      goldInk: "#ffd08a",
      mint: "#10331a",
      forest: "#020a05",
      sidebar: "#051a0c",
      sidebarForeground: "#def3d8",
      sidebarAccent: "#12361c",
      sidebarBorder: "#143a1f",
    }),
  },
  {
    id: "verde-branco",
    label: "Verde e branco",
      hint: "Fundo neutro, verde profundo nas ações",
    dark: false,
    tokens: paint({
      background: "#f4f6f4",
      foreground: "#12261c",
      card: "#ffffff",
      muted: "#eef2ee",
      mutedForeground: "#5a6b62",
      border: "#dce5de",
      input: "#dce5de",
      primary: "#1b5c3e",
      primaryForeground: "#f4faf6",
      secondary: "#e8f1eb",
      secondaryForeground: "#174b34",
      mint: "#e3f3ea",
      sidebar: "#0f2a1f",
      sidebarForeground: "#e8f3ec",
      sidebarAccent: "#1a4333",
      sidebarBorder: "#1b3d30",
    }),
  },
  {
    id: "branco-verde",
    label: "Branco e verde",
    hint: "Fundo branco, verde nas ações",
    dark: false,
    tokens: paint({
      background: "#ffffff",
      foreground: "#14261c",
      card: "#ffffff",
      muted: "#f3f6f4",
      mutedForeground: "#5a6b62",
      border: "#dce5de",
      input: "#dce5de",
      primary: "#1b5c3e",
      primaryForeground: "#f4faf6",
      mint: "#e7f3ec",
      sidebar: "#f7fbf8",
      sidebarForeground: "#143026",
      sidebarAccent: "#e7f3ec",
      sidebarBorder: "#d5e6dc",
    }),
  },
  {
    id: "branco-total",
    label: "Branco total",
    hint: "Tudo branco, letra preta",
    dark: false,
    tokens: paint({
      background: "#ffffff",
      foreground: "#111111",
      card: "#ffffff",
      muted: "#f4f4f4",
      mutedForeground: "#555555",
      border: "#e4e4e4",
      input: "#e4e4e4",
      primary: "#1a1a1a",
      primaryForeground: "#ffffff",
      gold: "#8a6a12",
      goldInk: "#6d5310",
      sidebar: "#ffffff",
      sidebarForeground: "#111111",
      sidebarAccent: "#f0f0f0",
      sidebarBorder: "#e4e4e4",
    }),
  },
  {
    id: "preto-total",
    label: "Preto total",
    hint: "Tudo preto, letra branca",
    dark: true,
    tokens: paint({
      background: "#000000",
      foreground: "#ffffff",
      card: "#0c0c0c",
      muted: "#161616",
      mutedForeground: "#c8c8c8",
      border: "#2a2a2a",
      input: "#2a2a2a",
      primary: "#f2f2f2",
      primaryForeground: "#000000",
      destructive: "#ff6b61",
      destructiveForeground: "#1a0000",
      gold: "#e6c36a",
      goldInk: "#f0d48a",
      sidebar: "#000000",
      sidebarForeground: "#ffffff",
      sidebarAccent: "#1a1a1a",
      sidebarBorder: "#2a2a2a",
    }),
  },
  {
    id: "noite",
    label: "Noite",
    hint: "Verde escuro",
    dark: true,
    tokens: paint({
      background: "#0c1410",
      foreground: "#e8f0ea",
      card: "#121c17",
      muted: "#1a2620",
      mutedForeground: "#93a399",
      border: "#24332b",
      input: "#2a3d33",
      ring: "#4caf77",
      primary: "#3d9a68",
      primaryForeground: "#07140e",
      secondary: "#1a2e24",
      secondaryForeground: "#d4efe0",
      destructive: "#f07167",
      destructiveForeground: "#2a0c0a",
      gold: "#e0a43a",
      goldInk: "#f0c56a",
      mint: "#163326",
      forest: "#07110c",
      sidebar: "#07110c",
      sidebarForeground: "#dceee4",
      sidebarAccent: "#143326",
      sidebarBorder: "#1a2e24",
    }),
  },
  {
    id: "grafite",
    label: "Grafite",
    hint: "Cinza escuro, letra clara",
    dark: true,
    tokens: paint({
      background: "#1c1f22",
      foreground: "#f2f4f5",
      card: "#262a2e",
      muted: "#2e3338",
      mutedForeground: "#b7c0c7",
      border: "#3a4148",
      input: "#3a4148",
      primary: "#d7dde2",
      primaryForeground: "#1c1f22",
      gold: "#e0b15a",
      goldInk: "#f0cf8e",
      sidebar: "#14171a",
      sidebarForeground: "#f2f4f5",
      sidebarAccent: "#2a2f34",
      sidebarBorder: "#343a40",
    }),
  },
  {
    id: "areia",
    label: "Areia",
    hint: "Bege claro, letra marrom",
    dark: false,
    tokens: paint({
      background: "#f6f1e7",
      foreground: "#2a241c",
      card: "#fffdf8",
      muted: "#efe6d6",
      mutedForeground: "#6d6254",
      border: "#e2d5c0",
      input: "#e2d5c0",
      primary: "#8a5a2b",
      primaryForeground: "#fff8ef",
      gold: "#a56b12",
      goldInk: "#7a4e0c",
      sidebar: "#3d342c",
      sidebarForeground: "#f6f1e7",
      sidebarAccent: "#52483e",
      sidebarBorder: "#5c5146",
    }),
  },
  {
    id: "oceano",
    label: "Oceano",
    hint: "Azul escuro, letra clara",
    dark: true,
    tokens: paint({
      background: "#071824",
      foreground: "#e7f2f8",
      card: "#0d2230",
      muted: "#123044",
      mutedForeground: "#9eb8c8",
      border: "#1d4258",
      input: "#1d4258",
      primary: "#7ec8e3",
      primaryForeground: "#06202c",
      gold: "#e0b15a",
      goldInk: "#f0cf8e",
      sidebar: "#041018",
      sidebarForeground: "#e7f2f8",
      sidebarAccent: "#0d2c3e",
      sidebarBorder: "#16384c",
    }),
  },
  {
    id: "vinho",
    label: "Vinho",
    hint: "Vinho escuro, letra clara",
    dark: true,
    tokens: paint({
      background: "#1a0c10",
      foreground: "#f8ecee",
      card: "#261218",
      muted: "#341820",
      mutedForeground: "#d4b4ba",
      border: "#4a2832",
      input: "#4a2832",
      primary: "#e7a0ad",
      primaryForeground: "#2a1016",
      gold: "#e0b15a",
      goldInk: "#f0cf8e",
      sidebar: "#12080c",
      sidebarForeground: "#f8ecee",
      sidebarAccent: "#3a1822",
      sidebarBorder: "#4a2832",
    }),
  },
  {
    id: "dourado",
    label: "Dourado",
    hint: "Escuro com ouro, letra clara",
    dark: true,
    tokens: paint({
      background: "#1c160c",
      foreground: "#f8f1de",
      card: "#2a2216",
      muted: "#352a1a",
      mutedForeground: "#d9c8a2",
      border: "#4a3c24",
      input: "#4a3c24",
      primary: "#e2c27a",
      primaryForeground: "#1c1408",
      gold: "#e2c27a",
      goldInk: "#f3ddaa",
      sidebar: "#120e08",
      sidebarForeground: "#f8f1de",
      sidebarAccent: "#3a2e18",
      sidebarBorder: "#4a3c24",
    }),
  },
];

const PRESET_IDS = new Set(THEME_PRESETS.map((t) => t.id));

export function isThemeId(value: string): value is ThemeId {
  return value === "cor" || PRESET_IDS.has(value as Exclude<ThemeId, "cor">);
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(input: string): [number, number, number] | null {
  const hex = input.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

export function normalizeHex(input: string, fallback = "#1b5c3e") {
  const rgb = parseHex(input);
  if (!rgb) return fallback;
  return `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function hex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((n) => clampByte(n).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: string, b: string, t: number) {
  const pa = parseHex(a) ?? [0, 0, 0];
  const pb = parseHex(b) ?? [255, 255, 255];
  return hex(pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t);
}

export function luminance(color: string) {
  const rgb = parseHex(color) ?? [255, 255, 255];
  const lin = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function inkFor(color: string) {
  return luminance(color) > 0.42 ? "#121816" : "#f7f8f7";
}

export function paletteFromColor(input: string): { dark: boolean; tokens: ThemeTokens } {
  const background = normalizeHex(input);
  const dark = luminance(background) < 0.42;
  const foreground = dark ? "#f7f8f7" : "#121816";
  let primary = background;
  if (luminance(background) > 0.75) primary = mix(background, "#000000", 0.72);
  else if (luminance(background) < 0.12) primary = mix(background, "#ffffff", 0.78);
  if (luminance(primary) > 0.82 || luminance(primary) < 0.08) {
    primary = dark ? "#d7dde2" : "#1b5c3e";
  }
  const primaryForeground = inkFor(primary);
  const card = dark ? mix(background, "#ffffff", 0.08) : mix(background, "#ffffff", 0.72);
  const sidebar = dark ? mix(background, "#000000", 0.28) : mix(primary, "#000000", 0.62);
  const tokens = paint({
    background,
    foreground,
    card,
    cardForeground: foreground,
    muted: dark ? mix(background, "#ffffff", 0.14) : mix(background, "#000000", 0.05),
    mutedForeground: dark ? mix(foreground, background, 0.28) : mix(foreground, background, 0.38),
    border: dark ? mix(background, "#ffffff", 0.2) : mix(background, "#000000", 0.12),
    input: dark ? mix(background, "#ffffff", 0.2) : mix(background, "#000000", 0.12),
    ring: primary,
    primary,
    primaryForeground,
    secondary: card,
    secondaryForeground: foreground,
    destructive: dark ? "#ff6b61" : "#b42318",
    destructiveForeground: dark ? "#2a0c0a" : "#fff8f7",
    gold: dark ? "#e6c36a" : "#c67a0a",
    goldInk: dark ? "#f0d48a" : "#8a4e08",
    mint: dark ? mix(background, primary, 0.35) : mix("#ffffff", primary, 0.12),
    forest: sidebar,
    sidebar,
    sidebarForeground: inkFor(sidebar),
    sidebarAccent: mix(sidebar, inkFor(sidebar), 0.12),
    sidebarBorder: mix(sidebar, inkFor(sidebar), 0.2),
  });
  return { dark, tokens };
}

export function tokensFor(id: ThemeId, color?: string) {
  if (id === "cor") return paletteFromColor(color || "#1b5c3e");
  const preset = THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
  return { dark: preset.dark, tokens: preset.tokens };
}

export const THEME_CSS_VARS = TOKEN_VARS;

export function mixHex(a: string, b: string, t: number) {
  return mix(a, b, t);
}

export function cssColorToHex(input: string, fallback: string) {
  const value = input.trim();
  if (!value) return fallback;
  if (value.startsWith("#")) return normalizeHex(value, fallback);
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!match) return fallback;
  return hex(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function applyTokens(tokens: ThemeTokens, dark: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, cssVar] of TOKEN_VARS) root.style.setProperty(cssVar, tokens[key]);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function applyThemeChoice(id: ThemeId, color?: string) {
  const { dark, tokens } = tokensFor(id, color);
  applyTokens(tokens, dark);
  if (typeof document !== "undefined") document.documentElement.dataset.themeId = id;
  return dark ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode) {
  applyThemeChoice(mode === "dark" ? "nova-noite" : "nova");
}

export function readTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = readTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
