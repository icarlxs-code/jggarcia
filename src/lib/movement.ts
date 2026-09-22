import { destinoDaSaida, isPavTransfer, lugarDaSaida } from "./catalog";
import { calcTransportTime, formatDateBR, formatMinutes, formatNumber, formatTime } from "./format";
import type { Contagem, Mercadoria, MovimentoStatus, Pavilhao, Saida, TipoMovimentacao } from "./types";

export function nextMovCodigo(existing: { codigo?: string | null }[], dateISO: string) {
  const day = dateISO.replace(/-/g, "");
  const prefix = `MOV-${day}-`;
  let max = 0;
  for (const row of existing) {
    const code = row.codigo || "";
    if (!code.startsWith(prefix)) continue;
    const n = Number(code.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(6, "0")}`;
}

export function tipoMovimentacaoOf(s: Pick<Saida, "tipo" | "destino_pavilhao_id">): TipoMovimentacao {
  if ((s.tipo ?? "saida") === "entrada") return "entrada";
  if (isPavTransfer(s)) return "transferencia";
  return "saida";
}

export function statusOf(s: Pick<Saida, "tipo" | "destino_pavilhao_id" | "hora_chegada" | "data_hora_chegada" | "status">): MovimentoStatus {
  if (s.status) return s.status;
  if (tipoMovimentacaoOf(s) === "transferencia") {
    return s.data_hora_chegada || s.hora_chegada ? "entregue" : "em_transito";
  }
  return "registrada";
}

export function tipoMovLabel(tipo: TipoMovimentacao) {
  if (tipo === "entrada") return "Entrada";
  if (tipo === "transferencia") return "Transferência";
  if (tipo === "contagem") return "Contagem";
  return "Saída";
}

export function statusLabel(status: MovimentoStatus) {
  if (status === "em_transito") return "Em trânsito";
  if (status === "entregue") return "Entregue";
  return "Registrada";
}

export function estoqueLabel(s: Pick<Saida, "desconta_estoque" | "destino_pavilhao_id" | "tipo">) {
  if ((s.tipo ?? "saida") === "entrada") return "Entrou no estoque";
  if (s.desconta_estoque === false) return "Somente registro";
  if (isPavTransfer(s)) return "Baixa realizada";
  return "Baixa realizada";
}

export function combineLocalDateTime(dateISO: string, hhmm: string) {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const digits = (hhmm || "").replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  const h = Number(digits.slice(0, 2)) || 0;
  const m = Number(digits.slice(2, 4)) || 0;
  return new Date(y, (mo || 1) - 1, d || 1, h, m, 0, 0);
}

export function toLocalStamp(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export function arrivalStamp(saidaDate: string, saidaHora: string, chegadaHora: string, chegadaDate?: string) {
  const start = combineLocalDateTime(saidaDate, saidaHora);
  const end = combineLocalDateTime(chegadaDate || saidaDate, chegadaHora);
  if (end.getTime() < start.getTime()) end.setDate(end.getDate() + 1);
  return { start, end, stampSaida: toLocalStamp(start), stampChegada: toLocalStamp(end) };
}

export type TimelineItem = {
  id: string;
  at: string;
  hora: string;
  data: string;
  tipo: TipoMovimentacao;
  titulo: string;
  detalhe: string;
  quantidade?: number;
  unidade?: string;
  produto?: string;
  codigo?: string;
  origem?: string;
  destino?: string;
  usuario?: string;
  empilhador?: string;
  status?: MovimentoStatus;
  desconta?: boolean;
  saida?: Saida;
  contagem?: Contagem;
};

export function buildTimeline(
  saidas: Saida[],
  contagens: Contagem[],
  pavilhoes: Pavilhao[],
  mercadorias: Mercadoria[],
): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const s of saidas) {
    if (s.deleted_at) continue;
    const tipo = tipoMovimentacaoOf(s);
    const origem = lugarDaSaida(pavilhoes, s);
    const destino = destinoDaSaida(pavilhoes, s);
    const nome = s.mercadoria?.nome ?? mercadorias.find((m) => m.id === s.mercadoria_id)?.nome ?? "Produto";
    items.push({
      id: s.id,
      at: s.data_hora_saida || s.created_at,
      hora: formatTime(s.hora_saida || s.created_at?.slice(11, 16)),
      data: s.data,
      tipo,
      titulo: nome,
      detalhe:
        tipo === "entrada"
          ? `Entrou no ${origem}`
          : `${origem} → ${destino}`,
      quantidade: s.quantidade,
      unidade: s.unidade,
      produto: nome,
      codigo: s.codigo || s.mercadoria?.codigo,
      origem,
      destino: tipo === "entrada" ? origem : destino,
      usuario: s.usuario?.nome,
      empilhador: s.operador_nome,
      status: statusOf(s),
      desconta: s.desconta_estoque !== false,
      saida: s,
    });
  }
  for (const c of contagens) {
    if (c.deleted_at) continue;
    const merc = mercadorias.find((m) => m.id === c.mercadoria_id);
    const pav = pavilhoes.find((p) => p.id === c.pavilhao_id);
    items.push({
      id: c.id,
      at: c.created_at,
      hora: c.created_at.slice(11, 16),
      data: c.data,
      tipo: "contagem",
      titulo: merc?.nome ?? "Contagem",
      detalhe: `${c.esperado} → ${c.contado} ${c.unidade}${pav ? ` · ${pav.nome}` : ""}`,
      quantidade: c.contado,
      unidade: c.unidade,
      produto: merc?.nome,
      origem: pav?.nome,
      usuario: c.usuario_nome || c.contador,
      contagem: c,
    });
  }
  return items.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

export function movementSearchBlob(item: TimelineItem) {
  return [
    item.titulo,
    item.detalhe,
    item.produto,
    item.codigo,
    item.origem,
    item.destino,
    item.usuario,
    item.empilhador,
    item.saida?.id,
    item.saida?.codigo,
    tipoMovLabel(item.tipo),
  ]
    .filter(Boolean)
    .join(" ");
}

export function qtyLine(qtd?: number, unidade?: string) {
  if (qtd == null) return "—";
  return `${formatNumber(qtd)} ${unidade || ""}`.trim();
}

export function tempoLine(s: Pick<Saida, "hora_saida" | "hora_chegada" | "tempo_transporte">) {
  const mins = s.tempo_transporte ?? (s.hora_saida && s.hora_chegada ? calcTransportTime(s.hora_saida, s.hora_chegada) : null);
  return `${formatTime(s.hora_saida)} → ${formatTime(s.hora_chegada)}${mins != null ? ` · ${formatMinutes(mins)}` : ""}`;
}

export function dataHoraLine(dateISO: string, hhmm?: string | null) {
  return `${formatDateBR(dateISO)}${hhmm ? ` — ${formatTime(hhmm)}` : ""}`;
}
