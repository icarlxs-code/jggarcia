export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function monthStartISO(ref: Date = new Date()): string {
  return `${ref.getFullYear()}-${pad2(ref.getMonth() + 1)}-01`;
}

export function dateFromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = dateFromISO(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function nowHHMM(): string {
  return new Date().toTimeString().slice(0, 5);
}

/** Digits-only clock: 0300 → 03:00 while typing. */
export function maskTimeInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function completeTime(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (!d) return "";
  const padded = d.length <= 2 ? d.padStart(2, "0") + "00" : d.padStart(4, "0");
  const h = Number(padded.slice(0, 2)) || 0;
  const m = Number(padded.slice(2, 4)) || 0;
  return `${pad2(h)}:${pad2(m)}`;
}

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  return t.slice(0, 5);
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function calcTransportTime(saida: string, chegada: string): number | null {
  if (!saida || !chegada) return null;
  let diff = timeToMinutes(chegada) - timeToMinutes(saida);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function formatMinutes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${pad2(m)}min`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR");
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDateLongBR(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatPeriodo(from: string, to: string): string {
  if (from === to) return formatDateBR(from);
  return `${formatDateBR(from)} a ${formatDateBR(to)}`;
}
