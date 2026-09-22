const KEY = "jg-theme-v2";

export type ThemeMode = "light" | "dark";

export function readTheme(): ThemeMode {
  try {
    if (localStorage.getItem(KEY) === "dark") return "dark";
  } catch {
    /* ignore */
  }
  return "light";
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = document.documentElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
  return next;
}
