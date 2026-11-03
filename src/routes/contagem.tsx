import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClipboardCheck, Search, Undo2, X } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { useSession } from "@/lib/session";
import { MOTIVOS_CONTAGEM, motivoContagemLabel } from "@/lib/constants";
import { formatDateTimeBR, formatNumber, isoDaysAgo, todayISO, unitShort } from "@/lib/format";
import { pavTitle, pavilhaoNome } from "@/lib/catalog";
import { notify } from "@/lib/notify";
import { fold, cn } from "@/lib/utils";
import type { Contagem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { ViewSwitch, useChartView } from "@/components/analytics/view-switch";
import { ScreenCharts } from "@/components/analytics/screen-charts";
import { EmptyState } from "@/components/empty-state";
import { OpNote } from "@/components/motion/lottie-clip";
import { ProductIcon, ProductLabel } from "@/components/inventory/product-icon";
import { StockSplit } from "@/components/inventory/stock-split";
import { CountCalc } from "@/components/inventory/count-calc";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ActionButton } from "@/components/motion/action-button";

function lugarNoCard(p: { codigo: string; nome?: string; tipo?: string }) {
  const tipo = (p.tipo || "").trim() || (p.codigo === "74" ? "Galpão" : "Pavilhão");
  const nome = (p.nome || "").trim();
  const padrao = `${tipo} ${p.codigo}`.trim().toLowerCase();
  if (nome && nome.toLowerCase() !== padrao && nome.toLowerCase() !== tipo.toLowerCase()) return nome;
  return p.codigo;
}

export const Route = createFileRoute("/contagem")({
  validateSearch: (s: Record<string, unknown>): { pav?: string; produto?: string } => ({
    pav: typeof s.pav === "string" ? s.pav : undefined,
    produto: typeof s.produto === "string" ? s.produto : undefined,
  }),
  component: ContagemPage,
});

function LocalClock() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="relative flex h-1.5 w-1.5">
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      Horário local · {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

function ContagemPage() {
  const { pav: pavParam, produto: produtoParam } = Route.useSearch();
  const navigate = useNavigate();
  const live = useDb();
  const { perfil } = useSession();
  const pavilhoes = live.listPavilhoes();
  const produtos = live.listMercadorias(true);
  const historico = live.listContagens();

  const [pavId, setPavId] = useState(() => pavParam || pavilhoes[0]?.id || "p74");
  const [verTodos, setVerTodos] = useState(false);
  const [busca, setBusca] = useState("");
  const [mercId, setMercId] = useState(produtoParam || "");
  const [aberto, setAberto] = useState(true);
  const [contado, setContado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [saved, setSaved] = useState("");
  const [undoId, setUndoId] = useState<string | null>(null);
  const [escopo, setEscopo] = useState<"pav" | "todos">("pav");
  const [periodo, setPeriodo] = useState<"hoje" | "7d" | "15d" | "30d" | "tudo">("tudo");
  const { vista } = useChartView("contagem");
  const nomesSalvos = live.listContadores();
  const [contador, setContador] = useState(() => {
    try {
      return localStorage.getItem("jg-garcia-last-contador") || "";
    } catch {
      return "";
    }
  });
  const [contadorNovo, setContadorNovo] = useState("");
  const quem = (contadorNovo.trim() || contador).trim();

  useEffect(() => {
    if (pavParam) setPavId(pavParam);
  }, [pavParam]);

  useEffect(() => {
    if (!produtoParam) return;
    const m = db.listMercadorias(true).find((x) => x.id === produtoParam || x.codigo === produtoParam);
    if (!m) return;
    setMercId(m.id);
    setBusca(`${m.codigo} · ${m.nome}`);
    setAberto(false);
  }, [produtoParam]);

  const pav = pavilhoes.find((p) => p.id === pavId) ?? pavilhoes[0];
  const merc = produtos.find((m) => m.id === mercId) ?? null;
  const totalLugar = useMemo(() => {
    if (!pav) return 0;
    let qtd = 0;
    for (const m of produtos) qtd += live.stockAt(m.id, pav.id);
    return Math.round(qtd * 1000) / 1000;
  }, [pav, produtos, live]);
  const esperado = merc && pav ? live.stockAt(merc.id, pav.id) : 0;
  const nContado = contado === "" ? null : Number(contado.replace(",", "."));
  const validNum = nContado != null && Number.isFinite(nContado) && nContado >= 0;
  const delta = merc && validNum ? nContado - esperado : 0;
  const bateu = validNum && delta === 0;
  const divergiu = validNum && delta !== 0;

  const contadosHoje = useMemo(() => {
    const ids = new Set<string>();
    const hoje = todayISO();
    for (const c of historico) {
      if (c.data !== hoje) continue;
      if (!verTodos && c.pavilhao_id !== pav?.id) continue;
      ids.add(`${c.mercadoria_id}\t${c.pavilhao_id}`);
    }
    return ids;
  }, [historico, pav, verTodos]);

  const alvos = new Set(contadosHoje);
  for (const product of produtos) {
    for (const place of verTodos ? pavilhoes : pav ? [pav] : []) {
      if (live.stockAt(product.id, place.id) > 0) alvos.add(`${product.id}\t${place.id}`);
    }
  }

  const sugeridos = useMemo(() => {
    const term = fold(busca.trim());
    const lugares = verTodos ? pavilhoes : pav ? [pav] : [];
    const rows: { id: string; mercId: string; pavId: string; pavNome: string }[] = [];
    for (const m of produtos) {
      if (term) {
        const codigo = fold(m.codigo);
        const curto = term.replace(/^0+/, "");
        const ok = fold(m.nome).includes(term) || codigo.includes(term) || (curto.length > 0 && codigo.replace(/^0+/, "").includes(curto));
        if (!ok) continue;
      }
      for (const lugar of lugares) {
        if (!(live.stockAt(m.id, lugar.id) > 0)) continue;
        rows.push({ id: `${m.id}\t${lugar.id}`, mercId: m.id, pavId: lugar.id, pavNome: pavTitle(lugar) });
      }
    }
    return rows
      .map((row) => ({ ...row, merc: produtos.find((m) => m.id === row.mercId) }))
      .filter((row): row is typeof row & { merc: NonNullable<typeof row.merc> } => Boolean(row.merc))
      .sort((a, b) => {
        const ca = contadosHoje.has(a.id) ? 1 : 0;
        const cb = contadosHoje.has(b.id) ? 1 : 0;
        if (ca !== cb) return ca - cb;
        const nome = a.merc.nome.localeCompare(b.merc.nome, "pt-BR");
        if (nome !== 0) return nome;
        return a.pavNome.localeCompare(b.pavNome, "pt-BR");
      });
  }, [produtos, busca, live, pavilhoes, pav, verTodos, contadosHoje]);

  const catalogo = useMemo(() => {
    const term = fold(busca.trim());
    if (!term || (merc && term === fold(`${merc.codigo} · ${merc.nome}`))) return [];
    return produtos
      .filter((m) => {
        const codigo = fold(m.codigo);
        const curto = term.replace(/^0+/, "");
        return fold(m.nome).includes(term) || codigo.includes(term) || (curto.length > 0 && codigo.replace(/^0+/, "").includes(curto));
      })
      .slice(0, 40);
  }, [produtos, busca, merc]);

  function escolher(id: string, placeId?: string) {
    const m = produtos.find((x) => x.id === id);
    if (!m) return;
    if (placeId) setPavId(placeId);
    setMercId(m.id);
    setBusca(`${m.codigo} · ${m.nome}`);
    setAberto(false);
    setContado("");
    setMotivo("");
    setObs("");
    const nextPav = placeId || pavId;
    if (m.id !== produtoParam || (placeId && placeId !== pavParam)) {
      void navigate({ to: "/contagem", search: { pav: nextPav, produto: m.id }, replace: true });
    }
  }

  function limparProduto() {
    setMercId("");
    setBusca("");
    setContado("");
    setMotivo("");
    setObs("");
    setAberto(true);
    if (produtoParam) {
      void navigate({ to: "/contagem", search: { pav: pavId || pavParam, produto: undefined }, replace: true });
    }
  }

  function salvar() {
    if (!pav || !merc || !perfil) return false;
    if (!validNum) {
      notify.error("Informe a quantidade que você contou.");
      return false;
    }
    if (!quem) {
      notify.error("Informe quem fez a contagem.");
      return false;
    }
    try {
      db.createContagem({
        mercadoria_id: merc.id,
        pavilhao_id: pav.id,
        contado: Number(nContado),
        motivo: divergiu ? motivo : "conferencia",
        observacao: obs,
        usuario_id: perfil.id,
        contador: quem,
      });
      try {
        localStorage.setItem("jg-garcia-last-contador", quem);
      } catch {
        /* ignore */
      }
      setContador(quem);
      setSaved(`${merc.nome}: ${formatNumber(Number(nContado))} ${merc.unidade} registrados em ${pavTitle(pav)}.`);
      setContadorNovo("");
      let total = 0;
      for (const m of db.listMercadorias(true)) total += db.stockAt(m.id, pav.id);
      notify.success(`Contagem registrada. Total do ${pavTitle(pav)}: ${formatNumber(Math.round(total * 1000) / 1000)}.`);
      setContado("");
      setMotivo("");
      setObs("");
      return true;
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível salvar a contagem.");
      return false;
    }
  }

  const recentes = useMemo(() => {
    const hoje = todayISO();
    const from = periodo === "hoje" ? hoje : periodo === "7d" ? isoDaysAgo(6) : periodo === "15d" ? isoDaysAgo(14) : periodo === "30d" ? isoDaysAgo(29) : "";
    let rows = escopo === "pav" && pav ? historico.filter((c) => c.pavilhao_id === pav.id) : historico;
    if (from) rows = rows.filter((c) => c.data >= from && c.data <= hoje);
    return rows.slice(0, 80);
  }, [historico, escopo, pav, periodo]);

  const posicoes = useMemo(() => {
    const ids = new Set(recentes.map((c) => c.mercadoria_id));
    if (merc) ids.add(merc.id);
    for (const row of sugeridos) ids.add(row.mercId);
    const map = new Map<string, { id: string; nome: string; quantidade: number }[]>();
    for (const id of ids) map.set(id, live.stockPositions(id));
    return map;
  }, [live, recentes, merc, sugeridos]);

  function abrirDoHistorico(c: Contagem) {
    if (c.pavilhao_id !== pavId) setPavId(c.pavilhao_id);
    escolher(c.mercadoria_id);
  }

  return (
    <PageStage className="space-y-4">
      <PageHeader
        clip="/lottie/prancheta.json"
        title="Contagem"
        description="Confira o saldo físico por produto e local. Consulte as contagens anteriores no histórico."
      >
        <ViewSwitch page="contagem" />
        <CountCalc />
      </PageHeader>

      <section className="count-card rounded-xl border border-border bg-card p-4" aria-label="Progresso da contagem">
        <p className="text-sm font-medium">{contadosHoje.size} de {alvos.size} produtos / locais conferidos hoje {verTodos ? "na empresa" : `em ${pav?.nome || "seu local"}`}</p>
        <div className="mt-3 flex items-center gap-3">
          <progress className="count-progress" max={Math.max(1, alvos.size)} value={contadosHoje.size} aria-label="Produtos e locais conferidos hoje" />
          <span className="kpi-figure text-lg leading-none tabular-nums">{alvos.size ? Math.round((contadosHoje.size / alvos.size) * 100) : 0}%</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">A lista prioriza os produtos que ainda precisam ser contados.</p>
        {saved ? <p role="status" className="mt-2 text-sm font-medium text-primary">Contagem salva · {saved}</p> : null}
      </section>

      {vista !== "lista" ? (
        <ScreenCharts
          screen="contagem"
          movs={[]}
          contagens={recentes}
          pavilhoes={pavilhoes}
          periodLabel="Mesmo recorte do histórico ao lado"
        />
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => {
                setVerTodos(true);
                setEscopo("todos");
                limparProduto();
                setAberto(true);
              }}
              className={cn(
                "min-h-16 rounded-xl border px-3 py-2.5 text-left transition-colors col-span-2 sm:col-span-1 sm:row-span-2 sm:flex sm:flex-col sm:justify-end",
                verTodos ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Lugares</p>
              <p className="text-xl font-semibold leading-tight">Todos</p>
            </button>
            {pavilhoes.map((p) => {
              const active = !verTodos && pav?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-ctx="pavilhao"
                  data-id={p.id}
                  data-nome={p.nome || p.codigo}
                  onClick={() => {
                    setVerTodos(false);
                    setEscopo("pav");
                    setPavId(p.id);
                    limparProduto();
                    setAberto(true);
                  }}
                  className={cn(
                    "min-h-16 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{(p.tipo || "").trim() || (p.codigo === "74" ? "Galpão" : "Pavilhão")}</p>
                  <p className="text-xl font-semibold leading-tight">{lugarNoCard(p)}</p>
                  {active ? <p className="text-xs font-medium tabular-nums opacity-80">Total {formatNumber(totalLugar)}</p> : null}
                </button>
              );
            })}
          </div>

          {!pav ? (
            <EmptyState icon={ClipboardCheck} clip="/lottie/prancheta.json" title="Cadastre um pavilhão" description="A contagem precisa de um local." />
          ) : (
            <Card>
              <CardContent className="space-y-4 pt-5">
                <div className="space-y-1.5">
                  <Label htmlFor="busca-contagem">{verTodos ? "O que tem na empresa" : "O que tem neste lugar"}</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="busca-contagem"
                      value={busca}
                      onChange={(e) => {
                        setBusca(e.target.value);
                        setAberto(true);
                        setMercId("");
                        setContado("");
                        setMotivo("");
                      }}
                      onFocus={() => setAberto(true)}
                      placeholder={verTodos ? "Nome ou código do que entrou hoje em qualquer lugar" : "Nome ou código do produto"}
                      autoComplete="off"
                      className={cn("h-12 pl-9", busca ? "pr-10" : "")}
                    />
                    {busca ? (
                      <button
                        type="button"
                        aria-label="Limpar produto"
                        onClick={limparProduto}
                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sugeridos.length === 0
                      ? verTodos
                        ? "Nenhum produto com estoque na empresa."
                        : "Nenhum produto com estoque neste lugar."
                      : `${sugeridos.length} ${sugeridos.length === 1 ? "produto com estoque" : "produtos com estoque"}${verTodos ? " na empresa" : " neste lugar"}. O que ainda não foi contado fica primeiro.`}
                  </p>
                  {aberto && catalogo.length > 0 ? (
                    <ul className="max-h-72 overflow-y-auto rounded-xl border border-border bg-card shadow-card">
                      {catalogo.map((m) => {
                        const qtd = pav ? live.stockAt(m.id, pav.id) : 0;
                        const total = (posicoes.get(m.id) ?? live.stockPositions(m.id)).reduce((a, p) => a + p.quantidade, 0);
                        return (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => escolher(m.id)}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted"
                            >
                              <ProductLabel nome={m.nome} codigo={m.codigo} className="min-w-0 flex-1" />
                              <span className="shrink-0 text-right text-sm tabular-nums">
                                <span className="block font-medium">
                                  {formatNumber(qtd)} {m.unidade}
                                </span>
                                <span className="block text-xs text-muted-foreground">empresa {formatNumber(total)}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : aberto ? (
                    sugeridos.length === 0 ? (
                      <OpNote
                        src={busca.trim() ? "/lottie/prancheta.json" : "/lottie/conferencia.json"}
                        clipClassName={busca.trim() ? undefined : "lottie-clip h-24 w-32 shrink-0"}
                        title={busca.trim() ? "Nenhum produto com esse nome ou código" : verTodos ? "Nenhum produto com estoque na empresa" : "Nenhum produto com estoque neste lugar"}
                        detail="A conferência só lista o que já tem saldo."
                      />
                    ) : (
                    <ul className="max-h-72 overflow-y-auto rounded-xl border border-border bg-card shadow-card">
                      {sugeridos.map((row) => {
                        const m = row.merc;
                        const qtd = live.stockAt(m.id, row.pavId);
                        const total = (posicoes.get(m.id) ?? []).reduce((a, p) => a + p.quantidade, 0);
                        return (
                          <li key={row.id}>
                            <button
                              type="button"
                              onClick={() => escolher(m.id, row.pavId)}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted"
                            >
                              <ProductLabel nome={m.nome} codigo={m.codigo} className="min-w-0 flex-1" extra={verTodos ? row.pavNome : undefined} />
                              <span className="shrink-0 text-right text-sm tabular-nums">
                                <span className="block font-medium">
                                  {formatNumber(qtd)} {m.unidade}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {contadosHoje.has(row.id) ? "já contado hoje" : `empresa ${formatNumber(total)}`}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    )
                  ) : null}
                </div>

                {merc ? (
                  <>
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3">
                      <ProductIcon nome={merc.nome} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-bold tabular-nums">{merc.codigo}</p>
                        <p className="truncate text-sm">{merc.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          No sistema neste pavilhão:{" "}
                          <span className="font-medium tabular-nums text-foreground">
                            {formatNumber(esperado)} {merc.unidade}
                          </span>
                        </p>
                      </div>
                    </div>

                    <StockSplit mercadoriaId={merc.id} highlightId={pav.id} delta={validNum ? delta : 0} />

                    <div className="space-y-1.5">
                      <Label htmlFor="qtd-contado">Quantidade contada · {merc.unidade}</Label>
                      <Input
                        id="qtd-contado"
                        inputMode="decimal"
                        value={contado}
                        onChange={(e) => {
                          setContado(e.target.value);
                          if (e.target.value !== "" && Number(e.target.value.replace(",", ".")) === esperado) {
                            setMotivo("");
                            setObs("");
                          }
                        }}
                        placeholder="0"
                        className="h-14 text-center text-2xl font-semibold tabular-nums"
                      />
                    </div>

                    <dl className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-muted/40 p-4">
                      <div><dt className="text-xs text-muted-foreground">Registrado</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(esperado)}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Contado</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{validNum ? formatNumber(Number(nContado)) : "—"}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Diferença</dt><dd className={cn("mt-1 text-xl font-semibold tabular-nums", divergiu && "text-destructive")}>{validNum ? `${delta > 0 ? "+" : ""}${formatNumber(delta)}` : "—"}</dd></div>
                    </dl>

                    {divergiu ? (
                      <div className="space-y-2">
                        <Label>Motivo (opcional)</Label>
                        <div className="flex flex-wrap gap-2">
                          {MOTIVOS_CONTAGEM.map((m) => {
                            const on = motivo === m.id;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setMotivo(on ? "" : m.id)}
                                className={cn(
                                  "min-h-10 rounded-full border px-3 text-sm font-medium transition-colors",
                                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                                )}
                              >
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                        {motivo === "outro" ? (
                          <textarea
                            value={obs}
                            onChange={(e) => setObs(e.target.value)}
                            rows={3}
                            placeholder="Se quiser, escreva o que aconteceu"
                            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                          />
                        ) : null}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label htmlFor="quem-contou">Quem contou</Label>
                      {nomesSalvos.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {nomesSalvos.map((n) => {
                            const on = !contadorNovo.trim() && contador.toLowerCase() === n.toLowerCase();
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => {
                                  setContador(n);
                                  setContadorNovo("");
                                }}
                                className={cn(
                                  "min-h-10 rounded-full border px-3 text-sm font-medium transition-colors",
                                  on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                                )}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      <Input
                        id="quem-contou"
                        value={contadorNovo || (!nomesSalvos.includes(contador) ? contador : "")}
                        onChange={(e) => {
                          setContadorNovo(e.target.value);
                          if (e.target.value.trim()) setContador("");
                        }}
                        placeholder={nomesSalvos.length ? "Ou escreva um nome novo" : "Nome de quem está contando"}
                        autoComplete="name"
                        className="h-12"
                      />
                      <p className="text-xs text-muted-foreground">O nome fica salvo e aparece na lista da próxima vez.</p>
                    </div>

                    <ActionButton
                      className="h-12 w-full"
                      idleLabel={bateu ? "Confirmar que bateu" : "Registrar contagem"}
                      pendingLabel="Salvando"
                      doneLabel="Contagem salva"
                      onAction={salvar}
                      disabled={!validNum || !quem}
                    >
                      <ClipboardCheck />
                      {bateu ? "Confirmar que bateu" : "Registrar contagem"}
                    </ActionButton>
                  </>
                ) : (
                  <p className="pb-2 text-sm text-muted-foreground">Escolha o produto e digite o que você contou no {pav.nome}.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]">
          <div className="shrink-0 space-y-3 border-b border-border px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">Histórico de contagens</h2>
                <LocalClock />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{recentes.length} registros</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["hoje", "Hoje"],
                  ["7d", "7 dias"],
                  ["15d", "15 dias"],
                  ["30d", "30 dias"],
                  ["tudo", "Tudo"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPeriodo(id)}
                  className={cn(
                    "min-h-8 rounded-full border px-3 text-xs font-medium",
                    periodo === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setEscopo("pav")}
                className={cn(
                  "min-h-8 rounded-full border px-3 text-xs font-medium",
                  escopo === "pav" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
                )}
              >
                {pav ? pavTitle(pav) : "Neste pavilhão"}
              </button>
              <button
                type="button"
                onClick={() => setEscopo("todos")}
                className={cn(
                  "min-h-8 rounded-full border px-3 text-xs font-medium",
                  escopo === "todos" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
                )}
              >
                Todos
              </button>
            </div>
          </div>

          {recentes.length === 0 ? (
            <p className="m-4 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhuma contagem neste período{escopo === "pav" ? " neste lugar" : ""}.
            </p>
          ) : (
            <ol className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
              {recentes.map((c, i) => {
                const prod = produtos.find((m) => m.id === c.mercadoria_id);
                const pos = posicoes.get(c.mercadoria_id) ?? [];
                const agoraPav = pos.find((p) => p.id === c.pavilhao_id)?.quantidade ?? 0;
                const total = pos.reduce((a, p) => a + p.quantidade, 0);
                const un = prod?.unidade || c.unidade;
                const short = unitShort(un);
                const pavRow = pavilhoes.find((x) => x.id === c.pavilhao_id);
                const pavLabel = pavRow ? pavTitle(pavRow) : pavilhaoNome(c.pavilhao_id);
                return (
                  <li key={c.id} className="px-3 py-3">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 shrink-0 pt-1 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                      <button type="button" onClick={() => abrirDoHistorico(c)} className="min-w-0 flex-1 text-left">
                        {prod ? (
                          <ProductLabel nome={prod.nome} codigo={prod.codigo} extra={pavLabel} className="min-w-0" />
                        ) : (
                          <span className="text-sm">{pavLabel}</span>
                        )}
                      </button>
                      <Button size="icon" variant="ghost" aria-label="Desfazer" onClick={() => setUndoId(c.id)}>
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <dl className="mt-2 grid grid-cols-3 gap-1.5 pl-7">
                      <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Sistema</dt>
                        <dd className="text-sm font-medium tabular-nums">
                          {formatNumber(c.esperado)} <span className="text-xs font-normal text-muted-foreground">{short}</span>
                        </dd>
                      </div>
                      <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Contado</dt>
                        <dd className="text-sm font-semibold tabular-nums">
                          {formatNumber(c.contado)} <span className="text-xs font-normal text-muted-foreground">{short}</span>
                        </dd>
                      </div>
                      <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Diferença</dt>
                        <dd className="text-sm font-semibold tabular-nums">
                          {c.delta === 0 ? "Bateu" : c.delta > 0 ? `+${formatNumber(c.delta)}` : formatNumber(c.delta)}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-2 space-y-1.5 pl-7">
                      <p className="text-xs">
                        <span className="text-muted-foreground">Neste lugar </span>
                        <span className="font-semibold tabular-nums">
                          {formatNumber(agoraPav)} {un}
                        </span>
                        <span className="text-muted-foreground"> · na empresa </span>
                        <span className="font-semibold tabular-nums">
                          {formatNumber(total)} {un}
                        </span>
                      </p>
                      {pos.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {pos
                            .filter((p) => p.quantidade > 0 || p.id === c.pavilhao_id)
                            .map((p) => (
                              <span
                                key={p.id}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs leading-tight",
                                  p.id === c.pavilhao_id ? "border-primary/40 bg-primary/10" : "border-border bg-muted/40",
                                )}
                              >
                                <span className={p.id === c.pavilhao_id ? "font-medium" : "text-muted-foreground"}>{p.nome}</span>
                                <span className="tabular-nums font-semibold">
                                  {formatNumber(p.quantidade)} {short}
                                </span>
                              </span>
                            ))}
                        </div>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {c.contador || c.usuario_nome} · {formatDateTimeBR(c.created_at)}
                        {c.motivo ? ` · ${motivoContagemLabel(c.motivo)}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={!!undoId}
        onOpenChange={(v) => {
          if (!v) setUndoId(null);
        }}
        title="Desfazer esta contagem?"
        description="O estoque do pavilhão volta para o número de antes deste lançamento. O registro permanece no log."
        confirmLabel="Desfazer"
        mark="store"
        onConfirm={() => {
          if (undoId) db.undoContagem(undoId);
          setUndoId(null);
          notify.success("Contagem desfeita.");
        }}
      />
    </PageStage>
  );
}
