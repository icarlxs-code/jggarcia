export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function dateFromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isoDaysAgo(days: number, from = todayISO()): string {
  const d = dateFromISO(from);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDaysISO(iso: string, n: number) {
  return isoDaysAgo(-n, iso);
}

export function monthStartISO(ref: Date | string = new Date()): string {
  if (typeof ref === "string") {
    return `${ref.slice(0, 7)}-01`;
  }
  return `${ref.getFullYear()}-${pad2(ref.getMonth() + 1)}-01`;
}

export function monthEndISO(iso = todayISO()) {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${pad2(m)}-${pad2(last)}`;
}

export function localDateISO(iso?: string | null) {
  if (!iso) return todayISO();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = dateFromISO(iso.slice(0, 10));
  if (Number.isNaN(d.getTime())) return iso;
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
  const h = Math.min(23, Number(padded.slice(0, 2)) || 0);
  const m = Math.min(59, Number(padded.slice(2, 4)) || 0);
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

export function unitShort(unidade?: string | null): string {
  const u = (unidade || "").toLowerCase();
  if (u === "cx" || u.startsWith("caixa")) return "cx";
  if (u === "un" || u.startsWith("unidade")) return "un";
  if (u === "kg" || u.startsWith("quilo")) return "kg";
  if (u === "g" || u.startsWith("grama")) return "g";
  if (u === "l" || u.startsWith("litro")) return "L";
  if (u === "ml" || u.startsWith("mililitro")) return "ml";
  if (u === "sc" || u.startsWith("saco")) return "sc";
  if (u === "mç" || u.startsWith("maço") || u.startsWith("maco")) return "mç";
  if (u === "bdj" || u.startsWith("band")) return "bdj";
  if (u === "pct" || u.startsWith("pacote")) return "pct";
  return unidade || "un";
}

export type PainelPeriodo = "dia" | "semana" | "quinzena" | "mes";

export function painelRange(period: PainelPeriodo, day = todayISO()) {
  if (period === "dia") return { from: day, to: day };
  if (period === "semana") return { from: isoDaysAgo(6, day), to: day };
  if (period === "quinzena") return { from: isoDaysAgo(14, day), to: day };
  return { from: monthStartISO(day), to: monthEndISO(day) };
}

export function formatBRL(n?: number | null) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function maskMoney(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  return formatBRL(Number(digits) / 100);
}

export function parseMoney(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

export function maskCPF(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function maskCNPJ(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function maskCelular(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskPixChave(tipo: string, raw: string) {
  if (tipo === "cpf") return maskCPF(raw);
  if (tipo === "cnpj") return maskCNPJ(raw);
  if (tipo === "celular") return maskCelular(raw);
  if (tipo === "email") return raw.trim().toLowerCase().slice(0, 80);
  if (tipo === "aleatoria") return raw.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36);
  return raw.slice(0, 80);
}

export function maskPlaca(raw: string) {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  if (v.length <= 3) return v;
  return `${v.slice(0, 3)}-${v.slice(3)}`;
}
