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
