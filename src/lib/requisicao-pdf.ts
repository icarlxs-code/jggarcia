import { EMPRESA } from "./constants";
import { formatBRL, formatDateBR, formatNumber } from "./format";
import { esc, printHtmlDocument } from "./print-pdf";
import type { RequisicaoFornecedor } from "./types";

function signBlock(label: string, img?: string | null) {
  const drawn = img?.trim() ? `<img class="sign" src="${esc(img)}" alt="" />` : "";
  return `<div class="sign-box">${drawn}<i></i><span>${esc(label)}</span></div>`;
}

export function requisicaoFileName(numero: string) {
  const n = String(numero || "").replace(/\D/g, "").padStart(6, "0");
  return `Requisicao_${n}`;
}

export function buildRequisicaoHtml(r: RequisicaoFornecedor) {
  const numero = String(r.numero || "").padStart(6, "0");
  const file = requisicaoFileName(numero);
  const rows: [string, string][] = [
    ["Fornecedor", r.fornecedor],
    ["Mercadoria", r.mercadoria_codigo ? `${r.mercadoria_codigo} — ${r.mercadoria}` : r.mercadoria],
    ["Quantidade", formatNumber(r.quantidade)],
    ["Valor da Mercadoria", Number(r.valor) > 0 ? formatBRL(r.valor) : ""],
    ["Carregador", r.carregador],
    ["Vendedor", r.vendedor],
  ];
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${esc(file)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    @page { size: A4; margin: 14mm 14mm 16mm; }
    html, body { margin: 0; padding: 0; background: #fff; color: #14261c; font-family: Inter, "Segoe UI", system-ui, sans-serif; }
    body { font-size: 13px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { min-height: 267mm; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 3px solid #14532d; padding-bottom: 12px; }
    header img { height: 58px; width: auto; }
    .brand { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; color: #14532d; }
    .razao { margin-top: 2px; font-size: 15px; font-weight: 800; }
    .muted { margin: 2px 0 0; color: #3d5248; font-size: 11px; }
    h1 { margin: 22px 0 6px; text-align: center; font-size: 22px; letter-spacing: 0.08em; color: #14532d; }
    .no { margin: 0 auto 14px; width: fit-content; background: #14532d; color: #fff; border-radius: 8px; padding: 8px 18px; font-size: 18px; font-weight: 800; letter-spacing: 0.04em; }
    .when { display: flex; justify-content: center; gap: 28px; margin: 0 0 18px; font-size: 13px; }
    .when b { font-weight: 800; }
    table { width: 100%; border-collapse: collapse; border: 1.5px solid #1b5c3e; border-radius: 8px; overflow: hidden; }
    td { padding: 11px 14px; border-bottom: 1px solid #d5e4da; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    td.k { width: 34%; color: #3d5248; font-size: 12px; font-weight: 600; }
    td.v { font-size: 15px; font-weight: 700; }
    .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 36px; }
    .sign-box { min-height: 120px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; text-align: center; }
    .sign { height: 64px; max-width: 220px; object-fit: contain; margin-bottom: -8px; }
    .sign-box i { display: block; width: 100%; border-bottom: 1.5px solid #14261c; }
    .sign-box span { display: block; margin-top: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.03em; text-transform: uppercase; color: #14532d; }
    footer { margin-top: 28px; border-top: 1px solid #c5d8cc; padding-top: 8px; color: #3d5248; font-size: 11px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="sheet">
    <header>
      <img src="/logo.png" alt="JG Garcia" />
      <div>
        <div class="brand">${esc(EMPRESA.nomeCurto)}</div>
        <div class="razao">${esc(EMPRESA.razao)}</div>
        <p class="muted">CNPJ: ${esc(EMPRESA.cnpj)}</p>
      </div>
    </header>
    <h1>REQUISIÇÃO DE FORNECEDOR</h1>
    <p class="no">REQUISIÇÃO Nº ${esc(numero)}</p>
    <div class="when">
      <span>Data: <b>${esc(formatDateBR(r.data))}</b></span>
      <span>Horário: <b>${esc(r.horario || "—")}</b></span>
    </div>
    <table>
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td class="k">${esc(k)}</td><td class="v">${esc((v || "").trim() || "—")}</td></tr>`,
        )
        .join("")}
    </table>
    <div class="signs">
      ${signBlock("Assinatura do Responsável pela Requisição", r.assinatura_responsavel)}
      ${signBlock("Assinatura do Fornecedor", r.assinatura_fornecedor)}
    </div>
    <footer>
      <span>${esc(r.usuario_nome ? `Responsável: ${r.usuario_nome}` : "")}</span>
      <span>${esc(file)}.pdf</span>
    </footer>
  </div>
</body>
</html>`;
}

export function exportRequisicaoPdf(r: RequisicaoFornecedor) {
  printHtmlDocument(buildRequisicaoHtml(r));
}
