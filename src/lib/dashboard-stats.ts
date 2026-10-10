import { addDaysISO, formatDateBR } from "./format";
import type { Saida } from "./types";

export interface ProductRank {
  id: string;
  nome: string;
  codigo: string;
  unidade: string;
  qtd: number;
  vezes: number;
}

export interface DayPoint {
  iso: string;
  name: string;
  entradas: number;
  saidas: number;
  entradasN: number;
  saidasN: number;
}

function bump(map: Map<string, ProductRank>, s: Saida) {
  const id = s.mercadoria_id || s.mercadoria?.id || s.mercadoria?.nome || "—";
  const row = map.get(id) ?? {
    id,
    nome: s.mercadoria?.nome ?? "Produto",
    codigo: s.mercadoria?.codigo ?? "",
    unidade: s.unidade || "",
    qtd: 0,
    vezes: 0,
  };
  row.qtd += Number(s.quantidade) || 0;
  row.vezes += 1;
  map.set(id, row);
}

export function productFlow(movs: Saida[]) {
  const ins = new Map<string, ProductRank>();
  const outs = new Map<string, ProductRank>();
  let totalIn = 0;
  let totalOut = 0;
  for (const s of movs) {
    const tipo = s.tipo ?? "saida";
    const q = Number(s.quantidade) || 0;
    if (tipo === "entrada") {
      bump(ins, s);
      totalIn += q;
    } else {
      bump(outs, s);
      totalOut += q;
    }
  }
  const topEntrada = [...ins.values()].sort((a, b) => b.qtd - a.qtd);
  const topSaida = [...outs.values()].sort((a, b) => b.qtd - a.qtd);
  const ids = new Set([...ins.keys(), ...outs.keys()]);
  const comparativo = [...ids]
    .map((id) => {
      const a = ins.get(id);
      const b = outs.get(id);
      return {
        id,
        nome: a?.nome || b?.nome || "Produto",
        codigo: a?.codigo || b?.codigo || "",
        unidade: a?.unidade || b?.unidade || "",
        entradas: a?.qtd || 0,
        saidas: b?.qtd || 0,
      };
    })
    .sort((a, b) => b.entradas + b.saidas - (a.entradas + a.saidas));
  return {
    topEntrada,
    topSaida,
    comparativo,
    totalIn,
    totalOut,
    maisEntrou: topEntrada[0] ?? null,
    maisSaiu: topSaida[0] ?? null,
  };
}

export function dailySeries(movs: Saida[], from: string, to: string): DayPoint[] {
  const by = new Map<string, DayPoint>();
  let cursor = from;
  while (cursor <= to) {
    by.set(cursor, {
      iso: cursor,
      name: formatDateBR(cursor).slice(0, 5),
      entradas: 0,
      saidas: 0,
      entradasN: 0,
      saidasN: 0,
    });
    cursor = addDaysISO(cursor, 1);
    if (by.size > 62) break;
  }
  for (const s of movs) {
    const row = by.get(s.data);
    if (!row) continue;
    const q = Number(s.quantidade) || 0;
    if ((s.tipo ?? "saida") === "entrada") {
      row.entradas += q;
      row.entradasN += 1;
    } else {
      row.saidas += q;
      row.saidasN += 1;
    }
  }
  return [...by.values()];
}

export function hourOf(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const clock = raw.match(/T(\d{2}):(\d{2})/) || raw.match(/(\d{1,2}):(\d{2})/);
  if (clock) {
    const h = Number(clock[1]);
    return h >= 0 && h <= 23 ? h : null;
  }
  if (/^\d{4}$/.test(raw)) {
    const h = Number(raw.slice(0, 2));
    return h >= 0 && h <= 23 ? h : null;
  }
  return null;
}

/** Reparte um total nas horas do dia. A soma dos pontos é a soma do que entrou na função. */
export function countsByHour(stamps: (string | null | undefined)[]): number[] {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const stamp of stamps) {
    const h = hourOf(stamp);
    if (h == null) continue;
    hours[h] += 1;
  }
  return trimHours(hours);
}

export function trimHours(hours: number[]): number[] {
  let start = hours.findIndex((n) => n > 0);
  if (start < 0) return [0];
  let end = hours.length - 1;
  while (end > start && hours[end] === 0) end -= 1;
  if (start > 0) start -= 1;
  if (end < 23) end += 1;
  const slice = hours.slice(start, end + 1);
  return slice.length === 1 ? [slice[0], slice[0]] : slice;
}
