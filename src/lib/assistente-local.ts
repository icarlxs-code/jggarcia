import Fuse from "fuse.js";
import { db, loteStatus, stockAlert } from "@/lib/store";
import { formatNumber, isoDaysAgo, todayISO } from "@/lib/format";
import { coverageOf } from "@/components/analytics/dash-widgets";
import type { Mercadoria } from "@/lib/types";

/**
 * Answers the common stock questions straight from the local data, so the
 * assistant still helps when no AI provider is configured.
 */

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isSaida = (tipo?: string) => (tipo ?? "saida") === "saida";

function porPavilhao(p: Mercadoria) {
  return db
    .stockPositions(p.id)
    .filter((r) => r.quantidade)
    .map((r) => `${r.nome}: ${formatNumber(r.quantidade)}`)
    .join(" · ");
}

function acharProduto(pergunta: string): Mercadoria | null {
  const produtos = db.listMercadorias().filter((p) => p.status);
  const q = norm(pergunta);
  const exato = produtos
    .filter((p) => q.includes(norm(p.nome)))
    .sort((a, b) => b.nome.length - a.nome.length)[0];
  if (exato) return exato;
  const codigo = q.match(/\b\d{4,7}\b/)?.[0];
  if (codigo) {
    const porCodigo = produtos.find((p) => p.codigo.endsWith(codigo));
    if (porCodigo) return porCodigo;
  }
  const palavras = q.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const fuse = new Fuse(produtos, { keys: ["nome"], threshold: 0.3, ignoreLocation: true });
  for (const w of palavras) {
    const hit = fuse.search(w)[0]?.item;
    if (hit) return hit;
  }
  return null;
}

function movimentoDoDia(dia: string, rotulo: string) {
  const movs = db.listSaidas().filter((m) => m.data === dia);
  const ent = movs.filter((m) => m.tipo === "entrada");
  const sai = movs.filter((m) => isSaida(m.tipo));
  const linhas = (rows: typeof movs) =>
    rows
      .slice(0, 5)
      .map((m) => `• ${m.mercadoria?.nome ?? "produto"}: ${formatNumber(m.quantidade)} ${m.unidade}`)
      .join("\n");
  let t = `${rotulo}: ${ent.length} ${ent.length === 1 ? "entrada" : "entradas"} e ${sai.length} ${sai.length === 1 ? "saída" : "saídas"}.`;
  if (ent.length) t += `\n\nEntradas:\n${linhas(ent)}`;
  if (sai.length) t += `\n\nSaídas:\n${linhas(sai)}`;
  return t;
}

export function respostaLocal(pergunta: string): string {
  const q = norm(pergunta);
  const produtos = db.listMercadorias().filter((p) => p.status);

  if (/(acab|termin|falt|repor|reposi|critic|baixo|zerad|esgot)/.test(q)) {
    const criticos = produtos.filter((p) => stockAlert(p) === "critico");
    const movs = db.listSaidas();
    let cobertura = coverageOf(produtos, movs, 14);
    let janela = 14;
    if (!cobertura.length) {
      cobertura = coverageOf(produtos, movs, 90);
      janela = 90;
    }
    let t = `${criticos.length} ${criticos.length === 1 ? "produto está" : "produtos estão"} no nível crítico.`;
    if (cobertura.length) {
      t += `\n\nAcabam primeiro (ritmo dos últimos ${janela} dias):\n`;
      t += cobertura
        .slice(0, 6)
        .map((c) => `• ${c.p.nome}: ${c.dias <= 0 ? "esgotado" : `~${Math.max(1, Math.floor(c.dias))} dia(s)`} · ${formatNumber(c.p.estoque)} ${c.p.unidade}`)
        .join("\n");
    }
    return t;
  }

  if (/(venc|validade|lote)/.test(q)) {
    const lotes = db.listLotes().filter((l) => loteStatus(l.validade) !== "ok");
    if (!lotes.length) return "Nenhum lote vencido ou perto de vencer.";
    return `${lotes.length} ${lotes.length === 1 ? "lote precisa" : "lotes precisam"} de atenção:\n${lotes
      .slice(0, 8)
      .map((l) => {
        const p = produtos.find((x) => x.id === l.mercadoria_id);
        return `• ${p?.nome ?? "produto"} (${l.codigo}): vence ${l.validade.split("-").reverse().join("/")} · ${formatNumber(l.quantidade)} ${l.unidade}`;
      })
      .join("\n")}`;
  }

  if (/ontem/.test(q)) return movimentoDoDia(isoDaysAgo(1), "Ontem");
  if (/(hoje|dia)/.test(q) && /(entrad|said|movim|lanc)/.test(q)) return movimentoDoDia(todayISO(), "Hoje");

  if (/(mais|maior|top|ranking)/.test(q) && /(estoque|tem)/.test(q)) {
    const top = [...produtos].sort((a, b) => b.estoque - a.estoque).slice(0, 6);
    return `Maiores estoques:\n${top.map((p) => `• ${p.nome}: ${formatNumber(p.estoque)} ${p.unidade}`).join("\n")}`;
  }

  if (/(mais|maior|top)/.test(q) && /(sai|vend|giro)/.test(q)) {
    const desde = isoDaysAgo(29);
    const soma = new Map<string, number>();
    for (const m of db.listSaidas()) if (m.data >= desde && isSaida(m.tipo)) soma.set(m.mercadoria_id, (soma.get(m.mercadoria_id) || 0) + m.quantidade);
    const top = [...soma.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!top.length) return "Nenhuma saída nos últimos 30 dias.";
    return `O que mais saiu nos últimos 30 dias:\n${top
      .map(([id, q2]) => {
        const p = produtos.find((x) => x.id === id);
        return `• ${p?.nome ?? "produto"}: ${formatNumber(q2)} ${p?.unidade ?? ""}`;
      })
      .join("\n")}`;
  }

  const p = acharProduto(pergunta);
  if (p) {
    const onde = porPavilhao(p);
    const alerta = stockAlert(p);
    return `${p.nome} (${p.codigo}): ${formatNumber(p.estoque)} ${p.unidade} no total.${onde ? `\n${onde}` : ""}\nMínimo: ${formatNumber(p.minimo)} · situação: ${alerta === "ok" ? "ok" : alerta}.`;
  }

  const total = produtos.length;
  const criticos = produtos.filter((p2) => stockAlert(p2) === "critico").length;
  return `Estou no modo local (sem IA conectada), então respondo perguntas diretas do estoque. Agora: ${total} produtos ativos, ${criticos} no nível crítico.\n\nExperimente: "quanto tem de abacate", "o que está acabando", "entradas de hoje", "lotes vencendo", "o que mais saiu".`;
}
