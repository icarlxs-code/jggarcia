import { EMPRESA, pixTipoLabel } from "./constants";
import { formatBRL, formatDateBR, pad2 } from "./format";
import { esc, printHtmlDocument } from "./print-pdf";
import type { FretePagamento } from "./types";

const FIELDS: { key: keyof FretePagamento; label: string; filled: (f: FretePagamento) => boolean }[] = [
  { key: "fornecedor", label: "Nome do fornecedor", filled: (f) => Boolean(f.fornecedor?.trim()) },
  { key: "numero_bilhete", label: "Número do bilhete", filled: (f) => Boolean(f.numero_bilhete?.trim()) },
  { key: "valor", label: "Valor do frete", filled: (f) => Number(f.valor) > 0 },
  { key: "data_entrada", label: "Data de entrada", filled: (f) => Boolean(f.data_entrada) },
  { key: "pavilhao", label: "Pavilhão onde descarregou", filled: (f) => Boolean(f.pavilhao?.trim()) },
  { key: "placa", label: "Placa do veículo", filled: (f) => Boolean(f.placa?.trim()) },
  { key: "motorista", label: "Nome do motorista", filled: (f) => Boolean(f.motorista?.trim()) },
  { key: "cpf", label: "CPF do motorista", filled: (f) => Boolean(f.cpf?.trim()) },
  { key: "assinatura_motorista", label: "Assinatura do motorista", filled: (f) => Boolean(f.assinatura_motorista) },
  { key: "forma_pagamento", label: "Forma de pagamento", filled: (f) => Boolean(f.forma_pagamento) },
  { key: "rubrica", label: "Rubrica / autorização", filled: (f) => Boolean(f.rubrica) },
  { key: "data_autorizacao", label: "Data da autorização", filled: (f) => Boolean(f.data_autorizacao) },
  { key: "observacoes", label: "Observações", filled: (f) => Boolean(f.observacoes?.trim()) },
];

export function missingFreteFields(f: FretePagamento) {
  return FIELDS.filter((x) => !x.filled(f)).map((x) => x.label);
}

function padDocNo(raw?: string | null) {
  const d = String(raw || "").replace(/\D/g, "");
  return d ? d.padStart(6, "0") : "";
}

function formatEmissao(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function badge(path: string) {
  return `<span class="ico"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
}

const ICO = {
  truck: badge('<rect x="1" y="7" width="15" height="10" rx="1"/><path d="M16 9h4l3 4v4h-7V9z"/><circle cx="5.5" cy="18.5" r="1.6"/><circle cx="18.5" cy="18.5" r="1.6"/>'),
  van: badge('<path d="M3 8h11v9H3z"/><path d="M14 11h4l3 3v3h-7v-6z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
  card: badge('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),
  note: badge('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>'),
  shield: badge('<path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z"/>'),
  pen: badge('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>'),
};

function cell(label: string, value?: string | null, extraClass = "") {
  const v = (value || "").trim();
  if (!v) return "";
  return `<div class="cell${extraClass ? ` ${extraClass}` : ""}"><span>${esc(label)}</span><b>${esc(v)}</b></div>`;
}

function grid(cols: number, inner: string) {
  if (!inner.trim()) return "";
  return `<div class="grid cols-${cols}">${inner}</div>`;
}

function section(title: string, ico: string, inner: string) {
  if (!inner.trim()) return "";
  return `<section class="block">
    <h2>${ico}<span>${esc(title)}</span></h2>
    ${inner}
  </section>`;
}

function pagamentoHtml(f: FretePagamento) {
  const cells = [
    cell("Forma de Pagamento:", f.forma_pagamento),
    f.forma_pagamento === "PIX" ? cell("Tipo de chave PIX:", pixTipoLabel(f.pix_tipo)) : "",
    f.forma_pagamento === "PIX" ? cell("Chave PIX:", f.pix_chave) : "",
  ].filter(Boolean);
  if (!cells.length) return "";
  return section("Pagamento", ICO.card, grid(cells.length, cells.join("")));
}

export function logoUrl() {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/logo.png`;
}

export function buildFreteHtml(f: FretePagamento, logo = logoUrl()) {
  const docNo = padDocNo(f.numero_bilhete) || padDocNo(f.numero) || f.numero || "000000";
  const pav = (f.pavilhao || "").trim();
  const endereco = pav ? `${EMPRESA.logradouro} — ${pav}` : EMPRESA.logradouro;
  const emitido = formatEmissao(f.updated_at || f.created_at);
  const dataDoc = formatDateBR(f.data_entrada || f.created_at?.slice(0, 10));

  const freteTop = [
    cell("Fornecedor:", f.fornecedor),
    cell("Número do Bilhete:", f.numero_bilhete),
    cell("Valor do Frete:", Number(f.valor) > 0 ? formatBRL(f.valor) : ""),
    cell("Data de Entrada:", f.data_entrada ? formatDateBR(f.data_entrada) : ""),
  ].filter(Boolean);
  const pavCell = cell("Pavilhão:", f.pavilhao, "wide");
  const transCells = [cell("Placa do Veículo:", f.placa), cell("Motorista:", f.motorista), cell("CPF:", f.cpf)].filter(Boolean);

  const signMotorista = f.assinatura_motorista
    ? `<img class="sign" src="${esc(f.assinatura_motorista)}" alt="Assinatura do motorista" />`
    : "";
  const signRubrica = f.rubrica ? `<img class="sign sign-sm" src="${esc(f.rubrica)}" alt="Rubrica" />` : "";

  const assinaTop = [
    signMotorista ? `<div class="cell"><span>Motorista:</span>${signMotorista}</div>` : "",
    f.cpf?.trim() ? `<div class="cell"><span>CPF:</span><b>${esc(f.cpf)}</b></div>` : "",
  ].filter(Boolean);

  const assinaBottomBits = [
    signRubrica || f.data_autorizacao
      ? `<div class="cell wide auth">
          <span>Autorização do Pagamento:</span>
          <div class="auth-row">
            ${
              signRubrica
                ? `<div class="auth-rub"><span>Rubrica:</span>${signRubrica}</div>`
                : ""
            }
            ${f.data_autorizacao ? `<div class="auth-date"><span>Data:</span><b>${esc(formatDateBR(f.data_autorizacao))}</b></div>` : ""}
          </div>
        </div>`
      : "",
  ].filter(Boolean);

  const assinaInner = [...assinaTop, ...assinaBottomBits].join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comprovante de pagamento de frete nº ${esc(docNo)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    @page { size: A4; margin: 10mm 12mm 12mm; }
    html, body { margin: 0; padding: 0; background: #fff; color: #14261c; font-family: Inter, "Segoe UI", system-ui, sans-serif; }
    body { font-size: 11.5px; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { position: relative; min-height: 277mm; padding: 2mm 1mm 16mm; overflow: hidden; }
    .wm { position: absolute; inset: 28% 8% 18%; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
    .wm img { width: 78%; max-width: 460px; opacity: 0.06; }
    header.top { position: relative; z-index: 1; display: flex; align-items: center; gap: 18px; padding: 0 2px 12px; }
    header.top img.logo { height: 78px; width: auto; }
    .id { flex: 1; min-width: 0; }
    .id .brand { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; color: #14532d; }
    .id .razao { margin-top: 2px; font-size: 16.5px; font-weight: 800; letter-spacing: -0.02em; color: #10241a; line-height: 1.15; }
    .id p { margin: 3px 0 0; color: #2a4336; font-size: 11.5px; }
    .banner { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #14532d; color: #fff; border-radius: 10px; padding: 10px 18px; margin: 4px 0 16px; }
    .banner strong { font-size: 13.5px; letter-spacing: 0.12em; font-weight: 800; }
    .banner .no { font-size: 14px; font-weight: 800; letter-spacing: 0.04em; border-left: 1px solid rgba(255,255,255,.4); padding: 2px 0 2px 16px; white-space: nowrap; }
    section.block { position: relative; z-index: 1; margin: 0 0 12px; }
    h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 11.5px; letter-spacing: 0.1em; text-transform: uppercase; color: #14532d; font-weight: 800; }
    .ico { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; background: #14532d; border-radius: 5px; flex-shrink: 0; }
    .grid { display: grid; border: 1.5px solid #1b5c3e; border-radius: 8px; overflow: hidden; background: #fff; }
    .cols-4 { grid-template-columns: repeat(4, 1fr); }
    .cols-3 { grid-template-columns: repeat(3, 1fr); }
    .cols-2 { grid-template-columns: 1.45fr 1fr; }
    .cols-1 { grid-template-columns: 1fr; }
    .cell { padding: 8px 11px; border-right: 1px solid #c5d8cc; min-height: 46px; }
    .cell span { display: block; font-size: 10px; color: #4b6256; font-weight: 500; }
    .cell b { display: block; margin-top: 3px; font-size: 12.5px; font-weight: 700; color: #12261c; }
    .wide { grid-column: 1 / -1; border-top: 1px solid #c5d8cc; border-right: none; }
    .decl { border: 1.5px solid #1b5c3e; border-radius: 8px; padding: 11px 13px; font-size: 12px; color: #1a2e24; background: #fff; }
    .sign { height: 44px; width: auto; max-width: 200px; object-fit: contain; display: block; margin-top: 4px; }
    .sign-sm { height: 36px; }
    .auth-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-top: 6px; }
    .auth-rub { display: flex; align-items: flex-end; gap: 8px; }
    .auth-rub span, .auth-date span { display: inline; font-size: 10px; color: #4b6256; }
    footer.bar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 1; display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 8px; padding: 8px 4px 0; border-top: 1px solid #c5d8cc; color: #3d5248; font-size: 10.5px; font-weight: 500; }
    footer.bar span { padding: 0 8px; }
    footer.bar span + span { border-left: 1px solid #c5d8cc; }
    footer.bar span:last-child { text-align: right; }
    @media print {
      html, body { background: #fff; }
      .sheet { min-height: auto; }
      .wm { position: fixed; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="wm"><img src="${logo}" alt="" /></div>
    <header class="top">
      <img class="logo" src="${logo}" alt="JG Garcia" />
      <div class="id">
        <div class="brand">${esc(EMPRESA.nomeCurto)}</div>
        <div class="razao">${esc(EMPRESA.razao)}</div>
        <p>CNPJ: ${esc(EMPRESA.cnpj)}</p>
        <p>${esc(endereco)}</p>
        <p>${esc(EMPRESA.bairro)} — CEP: ${esc(EMPRESA.cep)}</p>
      </div>
    </header>
    <div class="banner">
      <strong>COMPROVANTE DE PAGAMENTO DE FRETE</strong>
      <span class="no">Nº ${esc(docNo)}</span>
    </div>
    ${
      freteTop.length || pavCell
        ? section("Dados do frete", ICO.truck, grid(Math.max(freteTop.length, 1), `${freteTop.join("")}${pavCell}`))
        : ""
    }
    ${transCells.length ? section("Dados do transporte", ICO.van, grid(transCells.length, transCells.join(""))) : ""}
    ${pagamentoHtml(f)}
    ${f.observacoes?.trim() ? section("Observações", ICO.note, grid(1, cell("Observações:", f.observacoes))) : ""}
    ${section("Declaração", ICO.shield, `<div class="decl">Declaro que as informações acima correspondem ao transporte realizado e autorizo o pagamento referente ao serviço prestado.</div>`)}
    ${assinaInner ? section("Assinaturas", ICO.pen, `<div class="grid ${assinaTop.length === 2 ? "cols-2" : "cols-1"}">${assinaInner}</div>`) : ""}
    <footer class="bar">
      <span>Bilhete: ${esc(docNo)}</span>
      <span>Data: ${esc(dataDoc)}</span>
      <span>Data/Hora da emissão: ${esc(emitido)}</span>
    </footer>
  </div>
</body>
</html>`;
}

export function exportFretePdf(f: FretePagamento) {
  printHtmlDocument(buildFreteHtml(f));
}
