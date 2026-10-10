import { formatDateBR, formatNumber, formatTime } from "./format";
import { esc, printHtml } from "./print-pdf";
import type { FiltroSaidas, SaidaLinha } from "./saidas-consulta";
import { agruparMercadoria, agruparPavilhao, totais } from "./saidas-consulta";

export interface RelatorioMeta {
  filtro: FiltroSaidas;
  pavilhao: string;
  mercadoria: string;
  variedade?: string;
  busca: string;
}

function periodo(f: FiltroSaidas) {
  if (f.de && f.ate) return `${formatDateBR(f.de)} a ${formatDateBR(f.ate)}`;
  if (f.de) return `a partir de ${formatDateBR(f.de)}`;
  if (f.ate) return `até ${formatDateBR(f.ate)}`;
  return "Todos os dias";
}

function qtd(n: number | null) {
  return n == null ? "—" : formatNumber(n);
}

function horaSaida(r: SaidaLinha) {
  return formatTime(r.raw.hora_saida);
}

function horaChegada(r: SaidaLinha) {
  return r.raw.hora_chegada ? formatTime(r.raw.hora_chegada) : "Aguardando chegada";
}

export function htmlRelatorioSaidas(linhas: SaidaLinha[], meta: RelatorioMeta) {
  const t = totais(linhas);
  const grupos = agruparMercadoria(linhas);
  const pavs = agruparPavilhao(linhas);
  const chips = [
    `Período: ${periodo(meta.filtro)}`,
    `Pavilhão: ${meta.pavilhao || "Todos"}`,
    `Mercadoria: ${meta.mercadoria || meta.busca || "Todas"}`,
  ];
  const rows = linhas
    .map(
      (r) => `<tr>
        <td>${esc(formatDateBR(r.data))}</td>
        <td>${esc(r.pavilhao)}</td>
        <td>${esc(r.mercadoria)}</td>
        <td>${esc(r.variedade || "—")}</td>
        <td>${esc(horaSaida(r))}</td>
        <td>${esc(horaChegada(r))}</td>
        <td class="num">${esc(formatNumber(r.total))} ${esc(r.unidade)}</td>
        <td>${esc(r.destino)}</td>
        <td>${esc(r.cliente || "—")}</td>
        <td>${esc(r.usuario || "—")}</td>
      </tr>`,
    )
    .join("");
  const porProduto = grupos
    .map((g) => `<tr><td>${esc(g.nome)}</td><td class="num">${esc(qtd(g.pallets))}</td><td class="num">${esc(formatNumber(g.total))} ${esc(g.unidade)}</td></tr>`)
    .join("");
  const porPav = pavs
    .map((p) => {
      const linhasProd = p.produtos
        .map(
          (g) => `<tr><td>${esc(g.nome)}</td><td class="num">${esc(qtd(g.pallets))}</td><td class="num">${esc(formatNumber(g.total))} ${esc(g.unidade)}</td></tr>`,
        )
        .join("");
      return `<article class="place"><h3>${esc(p.nome)}<span>${esc(formatNumber(p.total))} ${esc(p.unidade)}</span></h3><table><thead><tr><th>Mercadoria</th><th class="num">Pallets</th><th class="num">Total</th></tr></thead><tbody>${linhasProd}</tbody></table></article>`;
    })
    .join("");
  return `
    <h1>Relatório de saídas de mercadorias</h1>
    <div class="meta">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>
    <div class="kpis">
      <div class="kpi"><b>${esc(formatNumber(t.saidas))}</b><span>Total de saídas</span></div>
      <div class="kpi"><b>${esc(qtd(t.pallets))}</b><span>Total de pallets</span></div>
      <div class="kpi"><b>${esc(formatNumber(t.volumes))}</b><span>Volumes / caixas</span></div>
      <div class="kpi"><b>${esc(meta.pavilhao || "Todos")}</b><span>Pavilhão</span></div>
    </div>
    <h2>Por mercadoria</h2>
    <table><thead><tr><th>Mercadoria</th><th class="num">Pallets</th><th class="num">Total</th></tr></thead><tbody>${porProduto || `<tr><td colspan="3">Nenhuma saída</td></tr>`}</tbody></table>
    <h2>Por pavilhão</h2>
    ${porPav || `<p class="empty">Nenhuma saída</p>`}
    <h2>Lançamentos</h2>
    <table>
      <thead><tr><th>Data</th><th>Origem</th><th>Mercadoria</th><th>Variedade</th><th>Horário de saída</th><th>Horário de chegada</th><th class="num">Total</th><th>Destino</th><th>Cliente</th><th>Usuário</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="10">Nenhuma saída neste filtro</td></tr>`}</tbody>
    </table>
  `;
}

export function exportarPdfSaidas(linhas: SaidaLinha[], meta: RelatorioMeta) {
  printHtml("Relatório de saídas de mercadorias", htmlRelatorioSaidas(linhas, meta));
}

export function exportarExcelSaidas(linhas: SaidaLinha[], meta: RelatorioMeta) {
  const t = totais(linhas);
  const head = ["Data", "Pavilhão de origem", "Mercadoria", "Variedade", "Horário de saída", "Horário de chegada", "Quantidade total", "Unidade", "Destino", "Cliente", "Usuário", "Documento"];
  const body = linhas
    .map(
      (r) => `<tr>
        <td>${esc(formatDateBR(r.data))}</td>
        <td>${esc(r.pavilhao)}</td>
        <td>${esc(r.mercadoria)}</td>
        <td>${esc(r.variedade)}</td>
        <td>${esc(horaSaida(r))}</td>
        <td>${esc(horaChegada(r))}</td>
        <td>${r.total}</td>
        <td>${esc(r.unidade)}</td>
        <td>${esc(r.destino)}</td>
        <td>${esc(r.cliente)}</td>
        <td>${esc(r.usuario)}</td>
        <td>${esc(r.documento)}</td>
      </tr>`,
    )
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head><body>
    <h2>Relatório de saídas de mercadorias</h2>
    <p>Período: ${esc(periodo(meta.filtro))} · Pavilhão: ${esc(meta.pavilhao || "Todos")} · Mercadoria: ${esc(meta.mercadoria || meta.busca || "Todas")}</p>
    <p>Saídas: ${t.saidas} · Pallets: ${t.pallets ?? "—"} · Volumes: ${t.volumes} ${esc(t.unidade)}</p>
    <table border="1"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
  </body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `saidas-${meta.filtro.de || "tudo"}-${meta.filtro.ate || "tudo"}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
