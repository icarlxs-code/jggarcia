import type { Usuario } from "./types";

const KEY = "jg-plain-user";

export function savePlainUser(user: Usuario) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* a sessão em memória ainda abre a tela */
  }
}

export function readPlainUser(): Usuario | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as Usuario;
    if (!user?.id || !user.email || user.status === false) return null;
    return user;
  } catch {
    return null;
  }
}

export function clearPlainUser() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
