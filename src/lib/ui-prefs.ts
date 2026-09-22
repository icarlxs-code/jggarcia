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

export interface UserUiPrefs {
  charts: ChartFlags;
}

const KEY = "jg-garcia-ui-prefs-v2";

function empty(): UserUiPrefs {
  return { charts: { ...DEFAULT_CHARTS } };
}

function readAll(): Record<string, UserUiPrefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, UserUiPrefs>;
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

export function readUiPrefs(userId?: string | null): UserUiPrefs {
  const id = userId || "_anon";
  const row = readAll()[id];
  if (!row?.charts) return empty();
  return {
    charts: { ...DEFAULT_CHARTS, ...row.charts },
  };
}

export function writeUiPrefs(userId: string | null | undefined, prefs: UserUiPrefs) {
  const id = userId || "_anon";
  const all = readAll();
  all[id] = {
    charts: { ...DEFAULT_CHARTS, ...prefs.charts },
  };
  writeAll(all);
}
