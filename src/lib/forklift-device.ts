const KEY = "jg-empilhador-device";

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashToken(token: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < token.length; i++) {
    const c = token.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export function readDeviceToken(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token || null;
  } catch {
    return null;
  }
}

export function saveDeviceToken(token: string) {
  localStorage.setItem(KEY, JSON.stringify({ token }));
}

export function clearDeviceToken() {
  localStorage.removeItem(KEY);
}

export function formatElapsed(startedAt: string, now = Date.now()) {
  const ms = Math.max(0, now - new Date(startedAt).getTime());
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatDurationText(startedAt: string, finishedAt: string) {
  const ms = Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime());
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} ${h === 1 ? "hora" : "horas"} e ${m} min`;
  if (m > 0) return `${m} ${m === 1 ? "minuto" : "minutos"} e ${s} segundos`;
  return `${s} segundos`;
}
