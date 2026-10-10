import { useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useDb } from "@/lib/use-db";
import { useSession } from "@/lib/session";
import { isoDaysAgo, monthStartISO, todayISO, formatPeriodo } from "@/lib/format";
import { fold } from "@/lib/utils";
import { tipoMovimentacaoOf } from "@/lib/movement";
import { PAINEL_WIDGETS, readUiPrefs, writeUiPrefs, type PainelWidgetId } from "@/lib/ui-prefs";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScreenCharts } from "@/components/analytics/screen-charts";

export const Route = createFileRoute("/analises")({ component: Analises });

type Periodo = "hoje" | "ontem" | "7" | "15" | "30" | "mes" | "custom";

function Analises() {
  const { isAdmin, perfil } = useSession();
  const live = useDb();
  const [periodo, setPeriodo] = useState<Periodo>("7");
  const [from, setFrom] = useState(isoDaysAgo(6));
  const [to, setTo] = useState(todayISO());
  const [q, setQ] = useState("");
  const [pav, setPav] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [unidade, setUnidade] = useState("todas");
  const prefs = readUiPrefs(perfil?.id);
  const hoje = todayISO();
  const range = rangeOf(periodo, from, to, hoje);
  const pavilhoes = live.listPavilhoes();
  const produtos = live.listMercadorias(true);
  const unidades = [...new Set(produtos.map((m) => m.unidade).filter(Boolean))];
  const movs = useMemo(() => {
    const term = fold(q.trim());
    return live.listSaidas({ from: range.from, to: range.to }).filter((s) => {
      if (tipo !== "todos" && tipoMovimentacaoOf(s) !== tipo) return false;
      if (unidade !== "todas" && s.unidade !== unidade) return false;
      if (pav !== "todos" && s.pavilhao_id !== pav && s.destino_pavilhao_id !== pav) return false;
      if (!term) return true;
      return fold(`${s.mercadoria?.nome ?? ""} ${s.mercadoria?.codigo ?? ""}`).includes(term);
    });
  }, [live, range.from, range.to, q, pav, tipo, unidade]);
  const contagens = live.listContagens().filter((c) => c.data >= range.from && c.data <= range.to);
  const anterior = previous(range.from, range.to);
  const antes = live.listSaidas({ from: anterior.from, to: anterior.to });

  function toggle(id: PainelWidgetId) {
    writeUiPrefs(perfil?.id, { painel: { [id]: prefs.painel[id] === false } });
  }

  if (!isAdmin) return <Navigate to="/" />;

  return (
    <PageStage className="space-y-4">
      <PageHeader icon="chart" title="Gráficos e análises" description="Os mesmos lançamentos das listas, só que em leitura visual. A posição do estoque não se mistura com o movimento do período." />
      <div className="flex flex-wrap gap-2">
        {(["hoje", "ontem", "7", "15", "30", "mes", "custom"] as Periodo[]).map((id) => (
          <button key={id} type="button" className={`h-8 rounded-full border px-3 text-xs font-medium ${periodo === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`} onClick={() => setPeriodo(id)}>
            {labelPeriodo(id)}
          </button>
        ))}
        {periodo === "custom" ? (
          <>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" aria-label="De" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" aria-label="Até" />
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Produto ou código" className="h-8 w-48" aria-label="Produto" />
        <select className="h-8 rounded-lg border border-border bg-card px-2 text-xs" value={pav} onChange={(e) => setPav(e.target.value)} aria-label="Local">
          <option value="todos">Todos os locais</option>
          {pavilhoes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select className="h-8 rounded-lg border border-border bg-card px-2 text-xs" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
          <option value="todos">Todos os tipos</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
          <option value="transferencia">Transferência</option>
        </select>
        <select className="h-8 rounded-lg border border-border bg-card px-2 text-xs" value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade">
          <option value="todas">Todas as unidades</option>
          {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <Button type="button" variant="ghost" className="h-8" onClick={() => { setQ(""); setPav("todos"); setTipo("todos"); setUnidade("todas"); setPeriodo("7"); }}>Limpar filtros</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Recorte {formatPeriodo(range.from, range.to)}. Período anterior de mesma duração: {antes.length} lançamentos.
      </p>
      <div className="flex flex-wrap gap-2">
        {PAINEL_WIDGETS.map((w) => {
          const on = prefs.painel[w.id] !== false;
          return (
            <button key={w.id} type="button" onClick={() => toggle(w.id)} className={`h-8 rounded-full border px-3 text-xs ${on ? "border-primary bg-mint" : "border-border bg-card text-muted-foreground"}`}>
              {w.label}
            </button>
          );
        })}
      </div>
      <ScreenCharts
        screen="painel"
        movs={movs}
        contagens={contagens}
        produtos={produtos}
        pavilhoes={pavilhoes}
        periodLabel={formatPeriodo(range.from, range.to)}
        show={prefs.painel}
      />
    </PageStage>
  );
}

function labelPeriodo(id: Periodo) {
  if (id === "hoje") return "Hoje";
  if (id === "ontem") return "Ontem";
  if (id === "7") return "7 dias";
  if (id === "15") return "15 dias";
  if (id === "30") return "30 dias";
  if (id === "mes") return "Mês atual";
  return "Personalizado";
}

function rangeOf(periodo: Periodo, from: string, to: string, hoje: string) {
  if (periodo === "hoje") return { from: hoje, to: hoje };
  if (periodo === "ontem") return { from: isoDaysAgo(1), to: isoDaysAgo(1) };
  if (periodo === "7") return { from: isoDaysAgo(6), to: hoje };
  if (periodo === "15") return { from: isoDaysAgo(14), to: hoje };
  if (periodo === "30") return { from: isoDaysAgo(29), to: hoje };
  if (periodo === "mes") return { from: monthStartISO(), to: hoje };
  return { from, to: to < from ? from : to };
}

function previous(from: string, to: string) {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  const end = new Date(a);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}
