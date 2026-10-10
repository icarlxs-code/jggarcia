import { hourOf } from "@/lib/dashboard-stats";
import { tipoMovimentacaoOf, statusOf } from "@/lib/movement";
import { stockAlert } from "@/lib/store";
import type { Contagem, Mercadoria, Saida, StockAlert } from "@/lib/types";

export type Metric = "quantidade" | "lancamentos";
export type Bucket = "hora" | "dia";

export function sameUnit(rows: Saida[]): { unidade: string; misto: boolean; rows: Saida[] } {
  const counts = new Map<string, number>();
  for (const s of rows) {
    const u = (s.unidade || "—").trim() || "—";
    counts.set(u, (counts.get(u) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const unidade = top?.[0] || "";
  const misto = counts.size > 1;
  return { unidade, misto, rows: misto ? rows.filter((s) => ((s.unidade || "—").trim() || "—") === unidade) : rows };
}

export function valorDe(s: Saida, metric: Metric) {
  return metric === "lancamentos" ? 1 : Number(s.quantidade) || 0;
}

export function isExterna(s: Saida) {
  return tipoMovimentacaoOf(s) === "saida";
}

function dayKey(iso: string) {
  return iso.slice(8, 10) + "/" + iso.slice(5, 7);
}

export function fluxo(rows: Saida[], bucket: Bucket, metric: Metric) {
  const map = new Map<string, { name: string; entradas: number; saidas: number; transferencias: number }>();
  const touch = (key: string, name: string) => {
    const row = map.get(key) ?? { name, entradas: 0, saidas: 0, transferencias: 0 };
    map.set(key, row);
    return row;
  };
  if (bucket === "dia") {
    const days = [...new Set(rows.map((s) => s.data).filter(Boolean))].sort();
    for (const d of days) touch(d, dayKey(d));
  }
  for (const s of rows) {
    const tipo = tipoMovimentacaoOf(s);
    const v = valorDe(s, metric);
    if (bucket === "hora") {
      const h = hourOf(s.hora_saida || s.created_at);
      if (h == null) continue;
      const key = String(h).padStart(2, "0");
      const row = touch(key, `${key}h`);
      if (tipo === "entrada") row.entradas += v;
      else if (tipo === "transferencia") row.transferencias += v;
      else row.saidas += v;
    } else if (s.data) {
      const row = touch(s.data, dayKey(s.data));
      if (tipo === "entrada") row.entradas += v;
      else if (tipo === "transferencia") row.transferencias += v;
      else row.saidas += v;
    }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
}

export function rankNome(rows: Saida[], tipo: "entrada" | "saida" | "transferencia", metric: Metric, limit = 10) {
  const map = new Map<string, { nome: string; valor: number; unidade: string; n: number }>();
  for (const s of rows) {
    if (tipoMovimentacaoOf(s) !== tipo) continue;
    const id = s.mercadoria_id || s.mercadoria?.nome || "—";
    const row = map.get(id) ?? { nome: s.mercadoria?.nome || "Produto", valor: 0, unidade: s.unidade || "", n: 0 };
    row.valor += valorDe(s, metric);
    row.n += 1;
    map.set(id, row);
  }
  return [...map.values()].sort((a, b) => b.valor - a.valor).slice(0, limit);
}

export function rankCampo(rows: Saida[], labelOf: (s: Saida) => string, tipo: "entrada" | "saida" | "transferencia" | "qualquer", metric: Metric, limit = 8) {
  const map = new Map<string, number>();
  for (const s of rows) {
    const t = tipoMovimentacaoOf(s);
    if (tipo !== "qualquer" && t !== tipo) continue;
    const label = labelOf(s) || "—";
    map.set(label, (map.get(label) || 0) + valorDe(s, metric));
  }
  return [...map.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limit);
}

export function porTipo(rows: Saida[]) {
  const acc = { entrada: 0, saida: 0, transferencia: 0 };
  for (const s of rows) {
    const tipo = tipoMovimentacaoOf(s);
    if (tipo === "contagem") continue;
    acc[tipo] += 1;
  }
  return [
    { nome: "Entrada", valor: acc.entrada, fill: "var(--color-primary)" },
    { nome: "Saída", valor: acc.saida, fill: "var(--color-gold)" },
    { nome: "Transferência", valor: acc.transferencia, fill: "#2563eb" },
  ].filter((r) => r.valor > 0);
}

export function transito(rows: Saida[]) {
  let pendente = 0;
  let concluida = 0;
  let minutos = 0;
  let comTempo = 0;
  for (const s of rows) {
    if (tipoMovimentacaoOf(s) !== "transferencia") continue;
    if (statusOf(s) === "em_transito") pendente += 1;
    else {
      concluida += 1;
      const t = Number(s.tempo_transporte);
      if (Number.isFinite(t) && t > 0) {
        minutos += t;
        comTempo += 1;
      }
    }
  }
  return {
    pendente,
    concluida,
    media: comTempo ? Math.round(minutos / comTempo) : null,
  };
}

export function saldoExterno(rows: Saida[], metric: Metric) {
  let entrou = 0;
  let saiu = 0;
  for (const s of rows) {
    const t = tipoMovimentacaoOf(s);
    const v = valorDe(s, metric);
    if (t === "entrada") entrou += v;
    else if (t === "saida") saiu += v;
  }
  return { entrou, saiu, saldo: entrou - saiu };
}

export type Situacao = "normal" | "baixo" | "critico" | "sem";

export function situacaoDe(m: Mercadoria): Situacao {
  if ((m.estoque ?? 0) <= 0) return "sem";
  const a: StockAlert = stockAlert(m);
  if (a === "critico") return "critico";
  if (a === "baixo" || a === "atencao") return "baixo";
  return "normal";
}

export function situacaoCount(produtos: Mercadoria[]) {
  const acc = { normal: 0, baixo: 0, critico: 0, sem: 0 };
  for (const m of produtos) acc[situacaoDe(m)] += 1;
  return [
    { nome: "Normal", valor: acc.normal, fill: "var(--color-primary)" },
    { nome: "Baixo", valor: acc.baixo, fill: "var(--color-gold)" },
    { nome: "Crítico", valor: acc.critico, fill: "var(--color-destructive)" },
    { nome: "Sem estoque", valor: acc.sem, fill: "#7c3aed" },
  ];
}

export function divergencias(rows: Contagem[]) {
  let sem = 0;
  let sobra = 0;
  let falta = 0;
  const porProduto = new Map<string, { nome: string; sobra: number; falta: number; unidade: string }>();
  for (const c of rows) {
    const d = Number(c.delta) || 0;
    if (d === 0) sem += 1;
    else if (d > 0) sobra += d;
    else falta += Math.abs(d);
    const id = c.mercadoria_id;
    const row = porProduto.get(id) ?? { nome: c.mercadoria_id, sobra: 0, falta: 0, unidade: c.unidade || "" };
    if (d > 0) row.sobra += d;
    if (d < 0) row.falta += Math.abs(d);
    porProduto.set(id, row);
  }
  const total = rows.length;
  const pct = total ? Math.round((sem / total) * 1000) / 10 : null;
  const maiores = [...porProduto.values()]
    .map((r) => ({ ...r, total: r.sobra + r.falta }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  return { sem, sobra, falta, pct, total, maiores };
}
