import { useMemo } from "react";
import { loteStatus, stockAlert } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { formatNumber, todayISO } from "@/lib/format";
import { statusOf, tipoMovimentacaoOf } from "@/lib/movement";
import { NovaKpi, PERIODOS, Sparkline, bucketize, pctChange, periodRange, periodoComDados } from "@/components/analytics/nova-dash";
import type { Saida } from "@/lib/types";

export function unitShort(unidade: string) {
  const n = (unidade || "").trim().toLowerCase();
  if (n === "kg" || n.startsWith("quilo")) return "kg";
  if (n.startsWith("caixa")) return "cx";
  if (n.startsWith("bandeja")) return "bdj";
  if (n.startsWith("unidade") || n === "un") return "un";
  if (n.startsWith("saco")) return "sc";
  if (n.startsWith("pacote")) return "pct";
  if (n.startsWith("litro") || n === "l") return "L";
  if (n.startsWith("dúzia") || n.startsWith("duzia")) return "dz";
  if (n.startsWith("maço") || n.startsWith("maco")) return "maço";
  return unidade || "un";
}

function daysSince(iso: string) {
  const a = new Date(`${iso}T00:00:00`).getTime();
  const b = new Date(`${todayISO()}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Four headline cards for a movement module (entradas or saídas), from real launches. */
export function MovStrip({ kind }: { kind: "entrada" | "saida" }) {
  const db = useDb();
  const all = db.listSaidas();
  const data = useMemo(() => {
    const movs = all.filter((m) => (kind === "entrada" ? tipoMovimentacaoOf(m) === "entrada" : tipoMovimentacaoOf(m) !== "entrada"));
    const p = periodoComDados(movs);
    const r = periodRange(p);
    const cur = movs.filter((m) => m.data >= r.from && m.data <= r.to);
    const prev = movs.filter((m) => m.data >= r.prevFrom && m.data <= r.prevTo);
    const units = new Map<string, number>();
    for (const m of cur) units.set(m.unidade || "Unidade", (units.get(m.unidade || "Unidade") || 0) + (Number(m.quantidade) || 0));
    const main = [...units.entries()].sort((a, b) => b[1] - a[1])[0];
    const prevMain = main ? prev.filter((m) => (m.unidade || "Unidade") === main[0]).reduce((a, m) => a + (Number(m.quantidade) || 0), 0) : 0;
    const buckets = bucketize(movs, p);
    const vol = buckets.map((b) => (main ? cur.filter((m) => m.data >= b.from && m.data <= b.to && (m.unidade || "Unidade") === main[0]).reduce((a, m) => a + (Number(m.quantidade) || 0), 0) : 0));
    const porProduto = new Map<string, number>();
    for (const m of cur) porProduto.set(m.mercadoria_id, (porProduto.get(m.mercadoria_id) || 0) + 1);
    const topId = [...porProduto.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const topNome = cur.find((m) => m.mercadoria_id === topId)?.mercadoria?.nome;
    const last = movs.reduce<Saida | null>((a, m) => (!a || m.data > a.data || (m.data === a.data && (m.hora_saida || "") > (a.hora_saida || "")) ? m : a), null);
    return { p, cur, prev, main, prevMain, buckets, vol, produtos: porProduto.size, topNome, last };
  }, [all, kind]);

  const longo = PERIODOS.find((x) => x.id === data.p)!.longo;
  const tone = kind === "entrada" ? "primary" : "warm";
  const mod = kind === "entrada" ? "entradas" : "saidas";
  const verbo = kind === "entrada" ? "recebido" : "expedido";
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <NovaKpi
        label={kind === "entrada" ? "Entradas" : "Saídas"}
        module={mod}
        value={data.cur.length}
        unit={data.cur.length === 1 ? "lançamento" : "lançamentos"}
        delta={pctChange(data.cur.length, data.prev.length)}
        extra={longo}
        spark={<Sparkline values={data.buckets.map((b) => (kind === "entrada" ? b.entradas : b.saidas))} tone={tone} />}
        tone={tone}
        foot="vs período anterior"
      />
      <NovaKpi
        label={`Volume ${verbo}`}
        module="estoque"
        value={data.main?.[1] ?? 0}
        decimals={Number.isInteger(data.main?.[1] ?? 0) ? 0 : 3}
        unit={data.main ? unitShort(data.main[0]) : undefined}
        delta={data.main ? pctChange(data.main[1], data.prevMain) : undefined}
        extra={data.main ? `na unidade mais usada · ${longo}` : `Nada ${verbo} no período`}
        spark={<Sparkline values={data.vol} tone={tone} />}
        tone={tone}
        foot="vs período anterior"
      />
      <NovaKpi
        label="Produtos diferentes"
        module="produtos"
        value={data.produtos}
        unit={data.produtos === 1 ? "produto" : "produtos"}
        extra={data.topNome ? `Mais frequente: ${data.topNome}` : "—"}
        foot={longo}
      />
      <NovaKpi
        label="Último lançamento"
        module={mod}
        value={data.last ? daysSince(data.last.data) : 0}
        unit={data.last ? (daysSince(data.last.data) === 0 ? "hoje" : daysSince(data.last.data) === 1 ? "dia atrás" : "dias atrás") : undefined}
        extra={data.last ? `${data.last.mercadoria?.nome ?? "—"} · ${formatNumber(data.last.quantidade)} ${unitShort(data.last.unidade)}` : "Nenhum lançamento ainda"}
        foot={data.last ? `${data.last.data.slice(8, 10)}/${data.last.data.slice(5, 7)}/${data.last.data.slice(0, 4)}` : "—"}
      />
    </div>
  );
}

/** Movimentações: one card per kind of movement plus what is still on the road. */
export function FlowStrip() {
  const db = useDb();
  const all = db.listSaidas();
  const d = useMemo(() => {
    const p = periodoComDados(all);
    const r = periodRange(p);
    const by = (rows: Saida[], t: string) => rows.filter((m) => tipoMovimentacaoOf(m) === t).length;
    const cur = all.filter((m) => m.data >= r.from && m.data <= r.to);
    const prev = all.filter((m) => m.data >= r.prevFrom && m.data <= r.prevTo);
    const buckets = bucketize(all, p);
    const transfB = buckets.map((b) => all.filter((m) => m.data >= b.from && m.data <= b.to && tipoMovimentacaoOf(m) === "transferencia").length);
    const transito = all.filter((m) => statusOf(m) === "em_transito").length;
    return { p, cur, prev, by, buckets, transfB, transito };
  }, [all]);
  const longo = PERIODOS.find((x) => x.id === d.p)!.longo;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <NovaKpi label="Entradas" module="entradas" value={d.by(d.cur, "entrada")} unit="lançamentos" delta={pctChange(d.by(d.cur, "entrada"), d.by(d.prev, "entrada"))} spark={<Sparkline values={d.buckets.map((b) => b.entradas)} />} extra={longo} foot="vs período anterior" />
      <NovaKpi label="Saídas" module="saidas" value={d.by(d.cur, "saida")} unit="lançamentos" delta={pctChange(d.by(d.cur, "saida"), d.by(d.prev, "saida"))} spark={<Sparkline values={d.buckets.map((b) => b.saidas)} tone="warm" />} tone="warm" extra={longo} foot="vs período anterior" />
      <NovaKpi label="Transferências" module="movimentacoes" value={d.by(d.cur, "transferencia")} unit="entre pavilhões" delta={pctChange(d.by(d.cur, "transferencia"), d.by(d.prev, "transferencia"))} spark={<Sparkline values={d.transfB} />} extra={longo} foot="vs período anterior" />
      <NovaKpi label="Em trânsito" module="movimentacoes" value={d.transito} unit={d.transito === 1 ? "carga" : "cargas"} warn={d.transito > 0} extra={d.transito ? "Transferências sem chegada marcada" : "Nenhuma carga na estrada"} foot="agora" />
    </div>
  );
}

/** Estoque: position right now. */
export function StockStrip() {
  const db = useDb();
  const produtos = db.listMercadorias();
  const lotes = db.listLotes();
  const d = useMemo(() => {
    const ativos = produtos.filter((p) => p.status);
    const units = new Map<string, number>();
    for (const p of ativos) if (p.estoque > 0) units.set(p.unidade || "Unidade", (units.get(p.unidade || "Unidade") || 0) + p.estoque);
    const mix = [...units.entries()].sort((a, b) => b[1] - a[1]);
    const comSaldo = ativos.filter((p) => p.estoque > 0).length;
    const criticos = ativos.filter((p) => stockAlert(p) === "critico").length;
    const zerados = ativos.filter((p) => p.estoque <= 0).length;
    const vencendo = lotes.filter((l) => loteStatus(l.validade) !== "ok").length;
    const vencidos = lotes.filter((l) => loteStatus(l.validade) === "vencido").length;
    return { ativos: ativos.length, mix, comSaldo, criticos, zerados, vencendo, vencidos };
  }, [produtos, lotes]);
  const main = d.mix[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <NovaKpi label="Estoque total" module="estoque" value={main?.[1] ?? 0} decimals={Number.isInteger(main?.[1] ?? 0) ? 0 : 3} unit={main ? unitShort(main[0]) : undefined} extra={d.mix.slice(1).map(([u, q]) => `${formatNumber(q)} ${unitShort(u)}`).join(" · ") || "Uma unidade só"} foot="saldo somado por unidade" />
      <NovaKpi label="Com saldo" module="produtos" value={d.comSaldo} unit={`de ${d.ativos}`} extra={`${d.ativos ? Math.round((d.comSaldo / d.ativos) * 100) : 0}% dos produtos ativos`} foot="produtos com estoque > 0" />
      <NovaKpi label="Em alerta" module="estoque" value={d.criticos + d.zerados} unit="produtos" warn={d.criticos + d.zerados > 0} tone="danger" extra={`${d.criticos} críticos · ${d.zerados} zerados`} foot="abaixo do mínimo ou sem saldo" />
      <NovaKpi label="Lotes a vencer" module="lotes" value={d.vencendo} unit="lotes" warn={d.vencidos > 0} extra={d.vencidos ? `${d.vencidos} já vencidos` : "Nenhum vencido"} foot="validade próxima ou passada" />
    </div>
  );
}
