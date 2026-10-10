import { destinoDaSaida, lugarDaSaida, pavTitle } from "./catalog";
import { formatDateBR, formatNumber, formatPeriodo, formatTime, formatMinutes } from "./format";
import { motivoContagemLabel } from "./constants";
import { db, resolvePavilhaoId } from "./store";
import type { Contagem, Destino, Pavilhao, Saida } from "./types";
import { esc, printHtml } from "./print-pdf";
import { notify } from "./notify";
import { forkliftRanking, forkliftTrips } from "./forklift";
import { tipoMovimentacaoOf } from "./movement";
import { fold } from "./utils";

export type ReportKind = "tudo" | "entrada" | "saida" | "contagem";

export interface ReportOpts {
  from: string;
  to: string;
  pavilhaoId: string;
  kind: ReportKind;
  mercadoriaId?: string;
  destinoId?: string;
  destinoNome?: string;
  produtoQuery?: string;
}

export interface ReportRow {
  kind: "entrada" | "saida" | "contagem";
  id: string;
  data: string;
  hora: string;
  produto: string;
  codigo: string;
  quantidade: number;
  unidade: string;
  lugar: string;
  cliente: string;
  usuario: string;
  extra: string;
  destinoId?: string;
  operador?: string;
  empilhadeira?: string;
  horaChegada?: string;
  minutos?: number | null;
}

function pavOf(s: Saida, pavilhoes: Pavilhao[]) {
  return resolvePavilhaoId(pavilhoes, s.pavilhao_id || s.pavilhao || s.origem);
}

function matchesProduto(opts: ReportOpts, nome: string, codigo: string, id: string) {
  if (opts.mercadoriaId && id === opts.mercadoriaId) return true;
  const q = fold(opts.produtoQuery || "").trim();
  if (q && (fold(nome).includes(q) || fold(codigo).includes(q) || fold(codigo).replace(/^0+/, "").includes(q.replace(/^0+/, "")))) return true;
  if (opts.mercadoriaId || q) return false;
  return true;
}

function saidaVaiPara(s: Saida, pavilhoes: Pavilhao[], destinoId?: string, destinoNome?: string) {
  if (!destinoId && !destinoNome) return true;
  const pavId = resolvePavilhaoId(pavilhoes, s.destino_pavilhao_id);
  if (destinoId && destinoId !== "sem" && (s.destino_id === destinoId || pavId === destinoId)) return true;
  const label = fold(destinoDaSaida(pavilhoes, s));
  const nome = fold(destinoNome || "");
  if (nome && label === nome) return true;
  if (destinoId && destinoId !== "sem") {
    const dest = db.listDestinos().find((d) => d.id === destinoId);
    if (dest && fold(dest.nome) === label) return true;
  }
  return false;
}

export function collectReport(opts: ReportOpts): ReportRow[] {
  const pavilhoes = db.listPavilhoes(true);
  const rows: ReportRow[] = [];
  const wantIn = opts.kind === "tudo" || opts.kind === "entrada";
  const wantOut = opts.kind === "tudo" || opts.kind === "saida";
  const wantCount = opts.kind === "tudo" || opts.kind === "contagem";

  if (wantIn || wantOut) {
    const movs = db.listSaidas({ from: opts.from, to: opts.to });
    for (const s of movs) {
      const tipo = (s.tipo ?? "saida") as "entrada" | "saida";
      if (tipo === "entrada" && !wantIn) continue;
      if (tipo === "saida" && !wantOut) continue;
      if (!matchesProduto(opts, s.mercadoria?.nome ?? "", s.mercadoria?.codigo ?? "", s.mercadoria_id)) continue;
      if ((opts.destinoId || opts.destinoNome) && !saidaVaiPara(s, pavilhoes, opts.destinoId, opts.destinoNome)) continue;
      if (opts.pavilhaoId !== "todos") {
        const pid = pavOf(s, pavilhoes);
        const destPid = resolvePavilhaoId(pavilhoes, s.destino_pavilhao_id);
        if (pid !== opts.pavilhaoId && destPid !== opts.pavilhaoId) continue;
      }
      const extras = movementNotes(s);
      rows.push({
        kind: tipo,
        id: s.id,
        data: s.data,
        hora: s.hora_saida || s.hora_chegada || "",
        produto: s.mercadoria?.nome ?? "Produto",
        codigo: s.mercadoria?.codigo ?? "",
        quantidade: Number(s.quantidade) || 0,
        unidade: s.unidade,
        lugar: lugarDaSaida(pavilhoes, s),
        cliente: tipo === "saida" ? destinoDaSaida(pavilhoes, s) : "",
        usuario: s.usuario?.nome ?? "—",
        extra: extras,
        destinoId: s.destino_id,
        operador: s.operador_nome || "",
        empilhadeira: s.empilhadeira || "",
        horaChegada: s.hora_chegada || "",
        minutos: s.tempo_transporte ?? null,
      });
    }
  }

  if (wantCount) {
    for (const c of db.listContagens()) {
      if (c.data < opts.from || c.data > opts.to) continue;
      if (opts.pavilhaoId !== "todos" && c.pavilhao_id !== opts.pavilhaoId) continue;
      const merc = db.listMercadorias().find((m) => m.id === c.mercadoria_id);
      if (!matchesProduto(opts, merc?.nome ?? "", merc?.codigo ?? "", c.mercadoria_id)) continue;
      const pav = pavilhoes.find((p) => p.id === c.pavilhao_id);
      rows.push({
        kind: "contagem",
        id: c.id,
        data: c.data,
        hora: c.created_at,
        produto: merc?.nome ?? "Produto",
        codigo: merc?.codigo ?? "",
        quantidade: c.contado,
        unidade: c.unidade,
        lugar: pav ? pavTitle(pav) : "—",
        cliente: "",
        usuario: c.contador || c.usuario_nome,
        extra: c.delta === 0 ? "Conferiu" : `${formatNumber(c.esperado)} → ${formatNumber(c.contado)}${c.motivo ? ` · ${motivoContagemLabel(c.motivo)}` : ""}`,
      });
    }
  }

  return rows.sort((a, b) => `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`));
}

/** Notes that are NOT the empilhador/máquina — those go in the dedicated line. */
function movementNotes(s: Saida): string {
  const op = (s.operador_nome || "").trim().toLowerCase();
  const maq = (s.empilhadeira || "").trim().toLowerCase();
  return [
    s.desconta_estoque === false ? "sem baixa de estoque" : "",
    s.destino_pavilhao_id ? "transferência" : "",
    (s.observacao || "").trim(),
  ]
    .filter(Boolean)
    .filter((p) => {
      const t = p.toLowerCase();
      if (op && (t === op || t === `empilhador ${op}` || t === `empilhador: ${op}`)) return false;
      if (maq && (t === maq || t === `máquina ${maq}` || t === `maquina ${maq}`)) return false;
      return true;
    })
    .join(" · ");
}

function empilhadorLine(r: ReportRow): string {
  const nome = (r.operador || "").trim();
  const maq = (r.empilhadeira || "").trim();
  if (!nome && !maq) return "";
  const label = nome ? (/^empilhador\b/i.test(nome) ? nome : `Empilhador ${nome}`) : `Máquina ${maq}`;
  const rest = nome && maq ? ` · ${maq}` : "";
  return `<div class="muted">${esc(label + rest)}</div>`;
}

function quemLancouHtml(r: ReportRow): string {
  return `${esc(r.usuario || "—")}${empilhadorLine(r)}${r.extra ? `<div class="muted">${esc(r.extra)}</div>` : ""}`;
}

export function reportTitle(opts: ReportOpts, pavilhoes: Pavilhao[]) {
  const lugar =
    opts.pavilhaoId === "todos"
      ? "Todos os lugares"
      : pavTitle(pavilhoes.find((p) => p.id === opts.pavilhaoId) ?? { codigo: "" });
  const tipo =
    opts.kind === "entrada" ? "Entradas" : opts.kind === "saida" ? "Saídas" : opts.kind === "contagem" ? "Contagens" : "Movimento do dia";
  const bits = [tipo, lugar];
  if (opts.mercadoriaId) {
    const m = db.listMercadorias().find((x) => x.id === opts.mercadoriaId);
    if (m) bits.push(m.nome);
  } else if (opts.produtoQuery?.trim()) {
    bits.push(`Busca “${opts.produtoQuery.trim()}”`);
  }
  if (opts.destinoNome) bits.push(opts.destinoNome);
  else if (opts.destinoId) {
    const d = db.listDestinos().find((x) => x.id === opts.destinoId);
    if (d) bits.push(d.nome);
  }
  return bits.join(" · ");
}

function table(headers: string[], body: string) {
  const numeric = new Set(["Qtd", "Quantidade", "Quantidade neste lugar", "Total", "Pallets", "Por pallet"]);
  return `<table><thead><tr>${headers.map((h) => `<th class="${numeric.has(h) ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
}

function produtoCell(codigo: string, nome: string) {
  return `<div class="prod"><span class="code">${esc(codigo)}</span><strong>${esc(nome)}</strong></div>`;
}

function locaisCell(positions: { nome: string; quantidade: number }[], unidade: string) {
  if (!positions.length) return "—";
  return `<div class="loc-list">${positions
    .map(
      (x) =>
        `<div class="loc"><span>${esc(x.nome)}</span><b>${esc(formatNumber(x.quantidade))} ${esc(unidade)}</b></div>`,
    )
    .join("")}</div>`;
}

function unidadeGeral(rows: { unidade: string }[]) {
  const units = [...new Set(rows.map((r) => r.unidade).filter(Boolean))];
  return units.length === 1 ? units[0] : "";
}

function estoquePorLugar(stock: { codigo: string; nome: string; unidade: string; total: number; positions: { id: string; nome: string; quantidade: number }[] }[]) {
  const places = new Map<string, { nome: string; unidade: string; itens: { codigo: string; nome: string; quantidade: number; unidade: string }[] }>();
  for (const p of stock) {
    for (const pos of p.positions) {
      const row = places.get(pos.id || pos.nome) ?? { nome: pos.nome, unidade: p.unidade, itens: [] };
      row.itens.push({ codigo: p.codigo, nome: p.nome, quantidade: pos.quantidade, unidade: p.unidade });
      places.set(pos.id || pos.nome, row);
    }
  }
  return [...places.values()]
    .map((p) => ({ ...p, total: p.itens.reduce((a, i) => a + i.quantidade, 0) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function htmlEstoque(stock: { codigo: string; nome: string; unidade: string; total: number; positions: { id: string; nome: string; quantidade: number }[] }[]) {
  const unidade = unidadeGeral(stock);
  const porProduto = stock
    .map(
      (p) => `<tr>
      <td>${produtoCell(p.codigo, p.nome)}</td>
      <td class="num">${esc(formatNumber(p.total))} ${esc(p.unidade)}</td>
      <td>${locaisCell(p.positions, p.unidade)}</td>
    </tr>`,
    )
    .join("");
  const lugares = estoquePorLugar(stock)
    .map((lugar) => {
      const linhas = lugar.itens
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map(
          (item) => `<tr>
          <td>${produtoCell(item.codigo, item.nome)}</td>
          <td class="num">${esc(formatNumber(item.quantidade))} ${esc(item.unidade)}</td>
        </tr>`,
        )
        .join("");
      const und = unidadeGeral(lugar.itens);
      return `<article class="place">
        <h3>${esc(lugar.nome)}<span>${lugar.itens.length} produto(s)${und ? ` · ${esc(formatNumber(lugar.total))} ${esc(und)}` : ""}</span></h3>
        ${table(["Produto", "Quantidade neste lugar"], linhas)}
      </article>`;
    })
    .join("");
  return { porProduto, lugares, unidade };
}

export function exportReportPdf(opts: ReportOpts) {
  const pavilhoes = db.listPavilhoes(true);
  const destinos = db.listDestinos();
  const rows = collectReport(opts);
  const title = reportTitle(opts, pavilhoes);
  const ins = rows.filter((r) => r.kind === "entrada");
  const outs = rows.filter((r) => r.kind === "saida");
  const counts = rows.filter((r) => r.kind === "contagem");
  const sum = (list: ReportRow[]) => list.reduce((a, r) => a + r.quantidade, 0);

  const kpis = [
    ["Lançamentos", formatNumber(rows.length)],
    ["Entradas", formatNumber(sum(ins))],
    ["Saídas", formatNumber(sum(outs))],
    ["Contagens", formatNumber(counts.length)],
  ]
    .map(([k, v]) => `<div class="kpi"><span>${esc(k)}</span><b>${esc(v)}</b></div>`)
    .join("");

  const rowHtml = (list: ReportRow[], withClient: boolean) =>
    list
      .map(
        (r) => `<tr>
      <td>${esc(formatDateBR(r.data))}<div class="muted">${esc(formatTime(r.hora) === "—" ? "" : formatTime(r.hora))}${r.horaChegada ? ` → ${esc(formatTime(r.horaChegada))}` : ""}</div></td>
      <td><div class="muted" style="font-family:IBM Plex Mono,monospace;font-size:10px">${esc(r.codigo)}</div>${esc(r.produto)}</td>
      <td class="num">${esc(formatNumber(r.quantidade))} ${esc(r.unidade)}</td>
      <td>${esc(r.lugar)}</td>
      ${withClient ? `<td>${esc(r.cliente || "—")}</td>` : ""}
      <td>${quemLancouHtml(r)}</td>
    </tr>`,
      )
      .join("");

  let sections = "";
  if (ins.length) {
    sections += `<h2>Entradas · ${ins.length}</h2>${table(
      ["Data", "Produto", "Qtd", "Lugar", "Quem lançou"],
      rowHtml(ins, false),
    )}`;
  }
  if (outs.length) {
    sections += `<h2>Saídas · ${outs.length}</h2>${table(
      ["Data", "Produto", "Qtd", "Saiu de", "Cliente", "Quem lançou"],
      rowHtml(outs, true),
    )}`;
    sections += clientBlocks(outs, destinos);
  }
  if (counts.length) {
    sections += `<h2>Contagens · ${counts.length}</h2>${table(
      ["Data", "Produto", "Contado", "Lugar", "Quem contou"],
      rowHtml(counts, false),
    )}`;
  }
  if (!rows.length) sections = `<p class="empty">Nenhum lançamento neste filtro.</p>`;

  const body = `
    <div class="meta">
      <span class="chip">${esc(formatPeriodo(opts.from, opts.to))}</span>
      <span class="chip">${esc(opts.kind === "tudo" ? "Entradas, saídas e contagens" : title)}</span>
    </div>
    <div class="kpis">${kpis}</div>
    ${sections}
  `;
  printHtml(title, body);
  notify.success("Na impressão, escolha Salvar como PDF.");
}

function clientBlocks(outs: ReportRow[], destinos: Destino[]) {
  const by = new Map<string, ReportRow[]>();
  for (const r of outs) {
    const key = r.destinoId || r.cliente || "—";
    const list = by.get(key) ?? [];
    list.push(r);
    by.set(key, list);
  }
  const blocks = [...by.entries()]
    .sort((a, b) => b[1].reduce((n, r) => n + r.quantidade, 0) - a[1].reduce((n, r) => n + r.quantidade, 0))
    .map(([key, list]) => {
      const dest = destinos.find((d) => d.id === key);
      const nome = dest?.nome || list[0]?.cliente || "Cliente";
      const total = list.reduce((n, r) => n + r.quantidade, 0);
      const logo = dest?.logo ? `<img src="${dest.logo}" alt="" />` : "";
      const contato = [dest?.telefone || dest?.contato, dest?.cnpj, dest?.email].filter(Boolean).join(" · ");
      const lines = list
        .map((r) => `<tr><td>${esc(r.produto)}</td><td class="num">${esc(formatNumber(r.quantidade))} ${esc(r.unidade)}</td><td>${esc(r.lugar)}</td></tr>`)
        .join("");
      return `<article class="client">
        <h3>${logo}${esc(nome)} <span class="muted" style="font-weight:500;font-size:11px">· ${esc(formatNumber(total))} un.</span></h3>
        ${contato ? `<p class="muted" style="margin:0 0 8px">${esc(contato)}</p>` : ""}
        <table><thead><tr><th>Produto</th><th class="num">Qtd</th><th>Saiu de</th></tr></thead><tbody>${lines}</tbody></table>
      </article>`;
    })
    .join("");
  return `<h2>Saídas por cliente</h2>${blocks}`;
}

export function exportSaidasClientesPdf(opts: { from: string; to: string; pavilhaoId?: string; destinoId?: string }) {
  exportReportPdf({
    from: opts.from,
    to: opts.to,
    pavilhaoId: opts.pavilhaoId || "todos",
    kind: "saida",
    destinoId: opts.destinoId,
  });
}

export function exportProdutoMovimentoPdf(opts: {
  from: string;
  to: string;
  pavilhaoId: string;
  mercadoriaId?: string;
  produtoQuery?: string;
  kind?: ReportKind;
}) {
  exportReportPdf({
    from: opts.from,
    to: opts.to,
    pavilhaoId: opts.pavilhaoId || "todos",
    kind: opts.kind || "tudo",
    mercadoriaId: opts.mercadoriaId,
    produtoQuery: opts.produtoQuery,
  });
}

export function exportForkliftPdf(opts: { from: string; to: string; operador?: string }) {
  const pavilhoes = db.listPavilhoes(true);
  const movs = db.listSaidas({ from: opts.from, to: opts.to, tipo: "saida" });
  const allTrips = forkliftTrips(movs, pavilhoes);
  const trips = opts.operador
    ? allTrips.filter((t) => t.operador.toLowerCase() === opts.operador!.trim().toLowerCase())
    : allTrips;
  const stats = forkliftRanking(trips);
  const who = opts.operador?.trim();
  const title = who ? `Empilhador · ${who}` : "Empilhadeiras · ranking do período";
  const rankRows = stats.rank
    .map(
      (r, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td>${esc(r.nome)}</td>
      <td class="num">${esc(r.trips)}</td>
      <td class="num">${esc(formatMinutes(r.avg))}</td>
      <td class="num">${esc(formatMinutes(r.fastest))}</td>
      <td class="num">${esc(formatMinutes(r.slowest))}</td>
    </tr>`,
    )
    .join("");
  const routeRows = stats.routes
    .map(
      (r) => `<tr>
      <td>${esc(r.route)}</td>
      <td class="num">${esc(r.trips)}</td>
      <td class="num">${esc(formatMinutes(r.avg))}</td>
      <td>${esc(formatDateBR(r.fastest.data))}<div class="muted">${esc(formatMinutes(r.fastest.minutos))}${r.fastest.operador !== "—" ? ` · ${esc(r.fastest.operador)}` : ""}</div></td>
      <td>${esc(formatDateBR(r.slowest.data))}<div class="muted">${esc(formatMinutes(r.slowest.minutos))}${r.slowest.operador !== "—" ? ` · ${esc(r.slowest.operador)}` : ""}</div></td>
    </tr>`,
    )
    .join("");
  const tripRows = stats.verdicts
    .slice(0, 80)
    .map(
      (v) => `<tr>
      <td>${esc(formatDateBR(v.trip.data))}</td>
      <td>${esc(v.trip.operador)}</td>
      <td>${esc(v.trip.route)}</td>
      <td class="num">${esc(formatMinutes(v.trip.minutos))}</td>
      <td>${esc(v.label)}</td>
    </tr>`,
    )
    .join("");
  const kpis = [
    ["Viagens com empilhador", formatNumber(stats.namedCount)],
    ["Média da equipe", formatMinutes(stats.teamAvg)],
    ["Mais rápido", stats.fastest ? `${stats.fastest.nome} · ${formatMinutes(stats.fastest.avg)}` : "—"],
    ["Rotas", formatNumber(stats.routes.length)],
  ]
    .map(([k, v]) => `<div class="kpi"><span>${esc(k)}</span><b>${esc(v)}</b></div>`)
    .join("");
  const body = `
    <div class="meta">
      <span class="chip">${esc(formatPeriodo(opts.from, opts.to))}</span>
      <span class="chip">${who ? `Somente ${esc(who)}` : "Tempo de pavilhão a pavilhão e até o cliente"}</span>
    </div>
    <div class="kpis">${kpis}</div>
    <h2>Ranking de empilhadores</h2>
    ${
      stats.rank.length
        ? table(
            ["#", "Empilhador", "Viagens", "Média", "Mais rápido", "Mais lento"],
            rankRows,
          )
        : `<p class="empty">Nenhuma saída com empilhador neste período. Preencha o nome na nota de saída — não é obrigatório.</p>`
    }
    <h2>Rotas</h2>
    ${
      stats.routes.length
        ? table(["Rota", "Viagens", "Média", "Dia mais rápido", "Dia mais lento"], routeRows)
        : `<p class="empty">Sem rotas com horário de saída e chegada.</p>`
    }
    <h2>Viagens</h2>
    ${stats.verdicts.length ? table(["Data", "Empilhador", "Rota", "Tempo", "Leitura"], tripRows) : ""}
  `;
  printHtml(title, body);
  notify.success("Na impressão, escolha Salvar como PDF.");
}

export function productTimeline(mercadoriaId: string) {
  const pavilhoes = db.listPavilhoes(true);
  const movs = db
    .listSaidas()
    .filter((s) => s.mercadoria_id === mercadoriaId)
    .map((s) => {
      const tipo = tipoMovimentacaoOf(s);
      return {
        at: s.created_at || s.data,
        kind: tipo,
        title: tipo === "entrada" ? "Entrada" : tipo === "transferencia" ? "Transferência" : "Saída",
        qty: Number(s.quantidade) || 0,
        unidade: s.unidade,
        lugar: lugarDaSaida(pavilhoes, s),
        who: s.usuario?.nome ?? "—",
        extra:
          tipo === "entrada"
            ? ""
            : tipo === "transferencia"
              ? destinoDaSaida(pavilhoes, s)
              : s.destino?.nome ?? destinoDaSaida(pavilhoes, s),
        id: s.id,
        codigo: s.codigo,
        status: s.status,
        desconta: s.desconta_estoque !== false,
      };
    });
  const counts = db.listContagens().filter((c) => c.mercadoria_id === mercadoriaId);
  const countRows = counts.map((c) => {
    const pav = pavilhoes.find((p) => p.id === c.pavilhao_id);
    return {
      at: c.created_at,
      kind: "contagem" as const,
      title: "Contagem",
      qty: c.contado,
      unidade: c.unidade,
      lugar: pav ? pavTitle(pav) : "—",
      who: c.contador || c.usuario_nome,
      extra: extraContagem(c),
      id: c.id,
    };
  });
  const logs = db
    .listLogs()
    .filter((l) => l.entidade === "produto" && l.entidade_id === mercadoriaId)
    .map((l) => ({
      at: l.created_at,
      kind: "log" as const,
      title: l.acao === "cadastrou" ? "Cadastro" : "Alteração",
      qty: 0,
      unidade: "",
      lugar: "",
      who: l.usuario_nome,
      extra: l.resumo,
      id: l.id,
    }));
  return [...movs, ...countRows, ...logs].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

function extraContagem(c: Contagem) {
  const parts = [`Sistema ${formatNumber(c.esperado)} → contado ${formatNumber(c.contado)}`];
  if (c.delta > 0) parts.push(`sobrou ${formatNumber(c.delta)}`);
  if (c.delta < 0) parts.push(`faltou ${formatNumber(Math.abs(c.delta))}`);
  if (c.motivo && c.motivo !== "conferencia") parts.push(motivoContagemLabel(c.motivo));
  if (c.observacao) parts.push(c.observacao);
  return parts.join(" · ");
}

export function clientStats(from: string, to: string) {
  const saidas = db.listSaidas({ from, to, tipo: "saida" });
  const entradas = db.listSaidas({ from, to, tipo: "entrada" });
  const pavilhoes = db.listPavilhoes(true);
  const destinos = db.listDestinos();

  const byClient = new Map<string, { id: string; nome: string; qtd: number; vezes: number; produtos: Map<string, { nome: string; qtd: number }> }>();
  for (const s of saidas) {
    const nome = destinoDaSaida(pavilhoes, s);
    const id = s.destino_id || resolvePavilhaoId(pavilhoes, s.destino_pavilhao_id) || nome || "sem";
    const row = byClient.get(id) ?? { id, nome: nome && nome !== "—" ? nome : destinos.find((d) => d.id === id)?.nome || "Sem cliente", qtd: 0, vezes: 0, produtos: new Map() };
    row.qtd += Number(s.quantidade) || 0;
    row.vezes += 1;
    const pid = s.mercadoria_id;
    const p = row.produtos.get(pid) ?? { nome: s.mercadoria?.nome ?? "Produto", qtd: 0 };
    p.qtd += Number(s.quantidade) || 0;
    row.produtos.set(pid, p);
    byClient.set(id, row);
  }

  const rankClients = [...byClient.values()]
    .map((c) => ({
      ...c,
      topProduto: [...c.produtos.values()].sort((a, b) => b.qtd - a.qtd)[0] ?? null,
    }))
    .sort((a, b) => b.qtd - a.qtd);

  const byProdOut = new Map<string, { id: string; nome: string; qtd: number }>();
  for (const s of saidas) {
    const row = byProdOut.get(s.mercadoria_id) ?? { id: s.mercadoria_id, nome: s.mercadoria?.nome ?? "Produto", qtd: 0 };
    row.qtd += Number(s.quantidade) || 0;
    byProdOut.set(s.mercadoria_id, row);
  }
  const byProdIn = new Map<string, { id: string; nome: string; qtd: number }>();
  for (const s of entradas) {
    const row = byProdIn.get(s.mercadoria_id) ?? { id: s.mercadoria_id, nome: s.mercadoria?.nome ?? "Produto", qtd: 0 };
    row.qtd += Number(s.quantidade) || 0;
    byProdIn.set(s.mercadoria_id, row);
  }

  return {
    rankClients,
    topSaida: [...byProdOut.values()].sort((a, b) => b.qtd - a.qtd),
    topEntrada: [...byProdIn.values()].sort((a, b) => b.qtd - a.qtd),
    totalSaidas: saidas.reduce((a, s) => a + Number(s.quantidade || 0), 0),
    totalEntradas: entradas.reduce((a, s) => a + Number(s.quantidade || 0), 0),
  };
}

export function exportDiaCompletoPdf(date: string) {
  const pavilhoes = db.listPavilhoes(true);
  const rows = collectReport({ from: date, to: date, pavilhaoId: "todos", kind: "tudo" });
  const ins = rows.filter((r) => r.kind === "entrada");
  const outs = rows.filter((r) => r.kind === "saida");
  const counts = rows.filter((r) => r.kind === "contagem");
  const stock = db.stockSnapshot(date);
  const sum = (list: ReportRow[]) => list.reduce((a, r) => a + r.quantidade, 0);
  const title = `Movimento do dia · ${formatDateBR(date)}`;
  const kpis = [
    ["Entradas", `${ins.length} · ${formatNumber(sum(ins))}`],
    ["Saídas", `${outs.length} · ${formatNumber(sum(outs))}`],
    ["Contagens", formatNumber(counts.length)],
    ["Itens em estoque", formatNumber(stock.length)],
  ]
    .map(([k, v]) => `<div class="kpi"><span>${esc(k)}</span><b>${esc(v)}</b></div>`)
    .join("");

  const movRow = (list: ReportRow[], dest: boolean) =>
    list
      .map(
        (r) => `<tr>
      <td>${esc(formatTime(r.hora) === "—" ? "" : formatTime(r.hora))}${r.horaChegada ? ` → ${esc(formatTime(r.horaChegada))}` : ""}</td>
      <td><div class="muted" style="font-family:IBM Plex Mono,monospace;font-size:10px">${esc(r.codigo)}</div>${esc(r.produto)}</td>
      <td class="num">${esc(formatNumber(r.quantidade))} ${esc(r.unidade)}</td>
      <td>${esc(r.lugar)}${dest ? `<div class="muted">→ ${esc(r.cliente || "—")}</div>` : ""}</td>
      <td>${quemLancouHtml(r)}</td>
    </tr>`,
      )
      .join("");

  const countHtml = counts
    .map(
      (r) => `<tr>
      <td>${esc(r.produto)}</td>
      <td class="num">${esc(formatNumber(r.quantidade))} ${esc(r.unidade)}</td>
      <td>${esc(r.lugar)}</td>
      <td>${esc(r.usuario)}</td>
      <td>${esc(r.extra)}</td>
    </tr>`,
    )
    .join("");

  const stockHtml = htmlEstoque(stock);

  let sections = "";
  sections += ins.length
    ? `<h2>Entradas · ${ins.length}</h2>${table(["Hora", "Produto", "Qtd", "Entrou em", "Quem lançou"], movRow(ins, false))}`
    : `<h2>Entradas</h2><p class="empty">Nenhuma entrada neste dia.</p>`;
  sections += outs.length
    ? `<h2>Saídas e transferências · ${outs.length}</h2>${table(["Hora", "Produto", "Qtd", "De → Para", "Quem lançou / empilhador"], movRow(outs, true))}`
    : `<h2>Saídas</h2><p class="empty">Nenhuma saída neste dia.</p>`;
  sections += counts.length
    ? `<h2>Contagens · ${counts.length}</h2>${table(["Produto", "Contado", "Lugar", "Quem contou", "Diferença"], countHtml)}`
    : `<h2>Contagens</h2><p class="empty">Nenhuma contagem neste dia.</p>`;
  sections += stock.length
    ? `<h2>Estoque no fim do dia · ${stock.length} produtos</h2>${table(["Produto", "Total", "Onde está"], stockHtml.porProduto)}<h2>Estoque por lugar</h2>${stockHtml.lugares}`
    : `<h2>Estoque</h2><p class="empty">Nenhum saldo neste dia.</p>`;

  const body = `
    <div class="meta">
      <span class="chip">${esc(formatDateBR(date))}</span>
      <span class="chip">Entradas, saídas, contagens e estoque</span>
    </div>
    <div class="kpis">${kpis}</div>
    ${sections}
  `;
  printHtml(title, body);
  notify.success("Na impressão, escolha Salvar como PDF.");
}

export function exportEstoqueDiaPdf(date?: string) {
  const dia = date || "";
  const stock = db.stockSnapshot(dia || undefined);
  const title = dia ? `Estoque · ${formatDateBR(dia)}` : "Estoque atual";
  const detalhe = htmlEstoque(stock);
  const totalGeral = stock.reduce((a, p) => a + p.total, 0);
  const lugares = new Set(stock.flatMap((p) => p.positions.map((x) => x.id || x.nome)));
  const kpis = [
    ["Produtos com saldo", formatNumber(stock.length)],
    ["Lugares com saldo", formatNumber(lugares.size)],
    ["Total geral", `${formatNumber(totalGeral)}${detalhe.unidade ? ` ${detalhe.unidade}` : ""}`],
    ["Posição", dia ? formatDateBR(dia) : "Atual"],
  ]
    .map(([k, v]) => `<div class="kpi"><span>${esc(k)}</span><b>${esc(v)}</b></div>`)
    .join("");
  const body = `
    <div class="meta">
      <span class="chip">${esc(dia ? formatDateBR(dia) : "Posição de agora")}</span>
      <span class="chip">${esc(stock.length ? `${stock.length} produtos` : "Sem saldo")}</span>
    </div>
    <div class="kpis">${kpis}</div>
    <h2>Por produto</h2>
    <p class="muted">Cada lugar fica numa linha, com o nome separado da quantidade.</p>
    ${stock.length ? table(["Produto", "Total", "Onde está"], detalhe.porProduto) : `<p class="empty">Nenhum produto com saldo neste recorte.</p>`}
    ${stock.length ? `<h2>Por pavilhão e galpão</h2>${detalhe.lugares}` : ""}
  `;
  printHtml(title, body);
  notify.success("Na impressão, escolha Salvar como PDF.");
}


export function clientsForProduct(mercadoriaId: string, from: string, to: string) {
  const merc = db.listMercadorias().find((m) => m.id === mercadoriaId);
  const pavilhoes = db.listPavilhoes(true);
  const saidas = db.listSaidas({ from, to, tipo: "saida" }).filter((s) => s.mercadoria_id === mercadoriaId);
  const by = new Map<string, { id: string; nome: string; qtd: number; vezes: number }>();
  for (const s of saidas) {
    const nome = destinoDaSaida(pavilhoes, s);
    const id = s.destino_id || resolvePavilhaoId(pavilhoes, s.destino_pavilhao_id) || nome || "sem";
    const row = by.get(id) ?? { id, nome: nome && nome !== "—" ? nome : "Sem cliente", qtd: 0, vezes: 0 };
    row.qtd += Number(s.quantidade) || 0;
    row.vezes += 1;
    by.set(id, row);
  }
  return {
    produto: merc?.nome ?? "Produto",
    unidade: merc?.unidade ?? "",
    total: saidas.reduce((a, s) => a + (Number(s.quantidade) || 0), 0),
    rank: [...by.values()].sort((a, b) => b.qtd - a.qtd),
  };
}

export function readLogoFile(file: File): Promise<string> {
  return readLogoAsset(file).then((r) => r.dataUrl);
}

export function readLogoAsset(file: File): Promise<{ dataUrl: string; png: boolean; transparent: boolean }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)) {
      reject(new Error("Escolha uma imagem."));
      return;
    }
    if (file.size > 3_000_000) {
      reject(new Error("A foto precisa ter até 3 MB."));
      return;
    }
    const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 360;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível ler a imagem."));
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!isPng) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      let transparent = false;
      if (isPng) {
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] < 250) {
            transparent = true;
            break;
          }
        }
      }
      const dataUrl = isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.86);
      resolve({ dataUrl, png: isPng, transparent });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem inválida."));
    };
    img.src = url;
  });
}

export function exportProductFichaPdf(mercadoriaId: string) {
  const merc = db.listMercadorias().find((m) => m.id === mercadoriaId);
  if (!merc) {
    notify.error("Produto não encontrado.");
    return;
  }
  const pos = db.stockPositions(merc.id);
  const comSaldo = pos.filter((p) => p.quantidade > 0);
  const lugares = (comSaldo.length ? comSaldo : pos)
    .map((p) => `<tr><td>${esc(p.nome)}</td><td class="num">${esc(formatNumber(p.quantidade))} ${esc(merc.unidade)}</td></tr>`)
    .join("");
  const hist = productTimeline(merc.id).slice(0, 50);
  const histRows = hist
    .map((h) => {
      const raw = h.at || "";
      const data = raw.slice(0, 10);
      const hora = raw.includes("T") ? raw.slice(11, 16) : "";
      return `<tr>
      <td>${esc(formatDateBR(data))}${hora ? `<div class="muted">${esc(hora)}</div>` : ""}</td>
      <td>${esc(h.title)}</td>
      <td class="num">${h.qty ? `${esc(formatNumber(h.qty))} ${esc(h.unidade)}` : "—"}</td>
      <td>${esc(h.lugar || "—")}</td>
      <td>${esc(h.who || "—")}${h.extra ? `<div class="muted">${esc(h.extra)}</div>` : ""}</td>
    </tr>`;
    })
    .join("");
  const body = `
    <div class="meta">
      <span class="chip">${esc(merc.codigo)}</span>
      <span class="chip">${esc(merc.unidade)}</span>
      <span class="chip">Estoque ${esc(formatNumber(merc.estoque))} ${esc(merc.unidade)}</span>
    </div>
    <h2>Onde está</h2>
    ${table(["Lugar", "Quantidade"], lugares || `<tr><td colspan="2">Sem saldo neste momento.</td></tr>`)}
    <h2>Histórico</h2>
    ${hist.length ? table(["Data", "Tipo", "Qtd", "Lugar", "Quem"], histRows) : `<p class="empty">Este produto ainda não tem lançamento.</p>`}
  `;
  printHtml(`Ficha · ${merc.codigo} ${merc.nome}`, body);
}

export function exportPlacePdf(pavilhaoId: string) {
  const pavilhoes = db.listPavilhoes(true);
  const pav = pavilhoes.find((p) => p.id === pavilhaoId);
  if (!pav) {
    notify.error("Lugar não encontrado.");
    return;
  }
  const nome = pavTitle(pav);
  const mercs = db.listMercadorias();
  const mercOf = new Map(mercs.map((m) => [m.id, m]));
  const estoque = mercs
    .map((m) => ({ m, qtd: db.stockAt(m.id, pav.id) }))
    .filter((x) => x.qtd > 0)
    .sort((a, b) => a.m.nome.localeCompare(b.m.nome, "pt-BR"));
  const totalCx = estoque.reduce((n, x) => n + x.qtd, 0);
  const stockRows = estoque
    .map(
      (x) => `<tr><td><div class="muted" style="font-family:IBM Plex Mono,monospace;font-size:10px">${esc(x.m.codigo)}</div>${esc(x.m.nome)}</td><td class="num">${esc(formatNumber(x.qtd))} ${esc(x.m.unidade)}</td></tr>`,
    )
    .join("");
  const counts = db
    .listContagens()
    .filter((c) => !c.deleted_at && c.pavilhao_id === pav.id)
    .slice(0, 60);
  const countRows = counts
    .map((c) => {
      const m = mercOf.get(c.mercadoria_id);
      const hora = (c.created_at || "").includes("T") ? c.created_at.slice(11, 16) : "";
      const diff = c.delta === 0 ? "Bateu" : c.delta > 0 ? `+${formatNumber(c.delta)}` : formatNumber(c.delta);
      return `<tr>
        <td>${esc(formatDateBR(c.data))}${hora ? `<div class="muted">${esc(hora)}</div>` : ""}</td>
        <td>${esc(m?.nome || "Produto")}</td>
        <td class="num">${esc(formatNumber(c.esperado))}</td>
        <td class="num">${esc(formatNumber(c.contado))} ${esc(c.unidade)}</td>
        <td class="num">${esc(diff)}</td>
        <td>${esc(c.contador || c.usuario_nome || "—")}</td>
      </tr>`;
    })
    .join("");
  const movs = db
    .listSaidas()
    .filter((s) => {
      const pid = resolvePavilhaoId(pavilhoes, s.pavilhao_id || s.pavilhao || s.origem);
      const dest = resolvePavilhaoId(pavilhoes, s.destino_pavilhao_id);
      return pid === pav.id || dest === pav.id;
    })
    .slice(0, 60);
  const movRows = movs
    .map((s) => {
      const tipo = s.destino_pavilhao_id ? "Transferência" : s.tipo === "entrada" ? "Entrada" : "Saída";
      const hora = (s.hora_saida || s.hora_chegada || "").slice(0, 5);
      return `<tr>
        <td>${esc(formatDateBR(s.data))}${hora ? `<div class="muted">${esc(hora)}</div>` : ""}</td>
        <td>${esc(tipo)}</td>
        <td>${esc(s.mercadoria?.nome || mercOf.get(s.mercadoria_id)?.nome || "Produto")}</td>
        <td class="num">${esc(formatNumber(Number(s.quantidade) || 0))} ${esc(s.unidade)}</td>
        <td>${esc(s.usuario?.nome || "—")}</td>
      </tr>`;
    })
    .join("");
  const body = `
    <div class="meta">
      <span class="chip">${esc(nome)}</span>
      <span class="chip">${esc(String(estoque.length))} produtos com saldo</span>
      <span class="chip">${esc(formatNumber(totalCx))} no lugar</span>
    </div>
    <h2>O que tem agora</h2>
    ${estoque.length ? table(["Produto", "Quantidade"], stockRows) : `<p class="empty">Nenhum saldo neste lugar agora.</p>`}
    <h2>Contagens</h2>
    ${counts.length ? table(["Data", "Produto", "Sistema", "Contado", "Diferença", "Quem"], countRows) : `<p class="empty">Nenhuma contagem neste lugar.</p>`}
    <h2>Movimentação</h2>
    ${movs.length ? table(["Data", "Tipo", "Produto", "Qtd", "Quem"], movRows) : `<p class="empty">Nenhuma entrada ou saída neste lugar.</p>`}
  `;
  printHtml(`Lugar · ${nome}`, body);
}
