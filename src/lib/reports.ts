import { destinoDaSaida, lugarDaSaida, pavTitle } from "./catalog";
import { formatDateBR, formatNumber, formatPeriodo, formatTime, formatMinutes, localDateISO } from "./format";
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
  if (opts.mercadoriaId && id !== opts.mercadoriaId) return false;
  const q = fold(opts.produtoQuery || "").trim();
  if (!q) return true;
  return fold(nome).includes(q) || fold(codigo).includes(q) || fold(codigo).replace(/^0+/, "").includes(q.replace(/^0+/, ""));
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
      if (opts.mercadoriaId && s.mercadoria_id !== opts.mercadoriaId) continue;
      if (!matchesProduto(opts, s.mercadoria?.nome ?? "", s.mercadoria?.codigo ?? "", s.mercadoria_id)) continue;
      if (opts.destinoId) {
        if (tipo === "entrada") continue;
        if (s.destino_id !== opts.destinoId) continue;
      }
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
  if (opts.destinoId) {
    const d = db.listDestinos().find((x) => x.id === opts.destinoId);
    if (d) bits.push(d.nome);
  }
  return bits.join(" · ");
}

function table(headers: string[], body: string) {
  return `<table><thead><tr>${headers.map((h, i) => `<th class="${i === headers.length - 1 || h === "Qtd" ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
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
      <td>${esc(formatDateBR(r.fastest.data))} · ${esc(formatMinutes(r.fastest.minutos))}${r.fastest.operador !== "—" ? ` · ${esc(r.fastest.operador)}` : ""}</td>
      <td>${esc(formatDateBR(r.slowest.data))} · ${esc(formatMinutes(r.slowest.minutos))}${r.slowest.operador !== "—" ? ` · ${esc(r.slowest.operador)}` : ""}</td>
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
  const destinos = db.listDestinos();

  const byClient = new Map<string, { id: string; nome: string; qtd: number; vezes: number; produtos: Map<string, { nome: string; qtd: number }> }>();
  for (const s of saidas) {
    const id = s.destino_id || "sem";
    const nome = s.destino?.nome || destinos.find((d) => d.id === id)?.nome || "Sem cliente";
    const row = byClient.get(id) ?? { id, nome, qtd: 0, vezes: 0, produtos: new Map() };
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
  const logs = db.listLogs().filter((l) => localDateISO(l.created_at) === date);
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

  const logHtml = logs
    .slice(0, 80)
    .map(
      (l) => `<tr>
      <td>${esc((l.created_at || "").slice(11, 16))}</td>
      <td>${esc(l.usuario_nome)}</td>
      <td>${esc(l.acao)}</td>
      <td>${esc(l.resumo)}${l.detalhe ? `<div class="muted">${esc(l.detalhe)}</div>` : ""}</td>
    </tr>`,
    )
    .join("");

  const stockHtml = stock
    .map(
      (p) => `<tr>
      <td><div class="muted" style="font-family:IBM Plex Mono,monospace;font-size:10px">${esc(p.codigo)}</div>${esc(p.nome)}</td>
      <td class="num">${esc(formatNumber(p.total))} ${esc(p.unidade)}</td>
      <td>${esc(p.positions.map((x) => `${x.nome} ${formatNumber(x.quantidade)}`).join(" · "))}</td>
    </tr>`,
    )
    .join("");

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
  sections += logs.length
    ? `<h2>Quem editou, cadastrou ou desfez · ${logs.length}</h2>${table(["Hora", "Pessoa", "Ação", "Detalhe"], logHtml)}`
    : `<h2>Alterações</h2><p class="empty">Nenhuma edição registrada neste dia.</p>`;
  sections += stock.length
    ? `<h2>Estoque no fim do dia · ${stock.length} produtos</h2>${table(["Produto", "Total", "Por pavilhão"], stockHtml)}`
    : `<h2>Estoque</h2><p class="empty">Nenhum saldo neste dia.</p>`;

  const body = `
    <div class="meta">
      <span class="chip">${esc(formatDateBR(date))}</span>
      <span class="chip">Entradas, saídas, contagens, edições e estoque</span>
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
  const kpis = [
    ["Produtos com saldo", formatNumber(stock.length)],
    ["Total de linhas", formatNumber(stock.reduce((a, p) => a + p.positions.length, 0))],
    ["Dia", dia ? formatDateBR(dia) : "Posição atual"],
    ["Itens", formatNumber(stock.reduce((a, p) => a + p.total, 0))],
  ]
    .map(([k, v]) => `<div class="kpi"><span>${esc(k)}</span><b>${esc(v)}</b></div>`)
    .join("");
  const bodyRows = stock
    .map(
      (p) => `<tr>
      <td><div class="muted" style="font-family:IBM Plex Mono,monospace;font-size:10px">${esc(p.codigo)}</div>${esc(p.nome)}</td>
      <td class="num">${esc(formatNumber(p.total))} ${esc(p.unidade)}</td>
      <td>${esc(p.positions.map((x) => `${x.nome} ${formatNumber(x.quantidade)}`).join(" · ") || "—")}</td>
    </tr>`,
    )
    .join("");
  const body = `
    <div class="meta">
      <span class="chip">${esc(title)}</span>
      <span class="chip">${esc(stock.length ? `${stock.length} produtos` : "Sem saldo")}</span>
    </div>
    <div class="kpis">${kpis}</div>
    <h2>Posição</h2>
    ${stock.length ? table(["Produto", "Total", "Por pavilhão"], bodyRows) : `<p class="empty">Nenhum produto com saldo neste recorte.</p>`}
  `;
  printHtml(title, body);
  notify.success("Na impressão, escolha Salvar como PDF.");
}


export function clientsForProduct(mercadoriaId: string, from: string, to: string) {
  const merc = db.listMercadorias().find((m) => m.id === mercadoriaId);
  const saidas = db.listSaidas({ from, to, tipo: "saida" }).filter((s) => s.mercadoria_id === mercadoriaId);
  const by = new Map<string, { id: string; nome: string; qtd: number; vezes: number }>();
  for (const s of saidas) {
    const id = s.destino_id || "sem";
    const nome = s.destino?.nome || "Sem cliente";
    const row = by.get(id) ?? { id, nome, qtd: 0, vezes: 0 };
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
