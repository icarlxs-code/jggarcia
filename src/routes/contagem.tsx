import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Search, Undo2 } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { useSession } from "@/lib/session";
import { MOTIVOS_CONTAGEM, motivoContagemLabel } from "@/lib/constants";
import { formatDateTimeBR, formatNumber, unitShort } from "@/lib/format";
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
import { EmptyState } from "@/components/empty-state";
import { ProductIcon, ProductLabel } from "@/components/inventory/product-icon";
import { StockSplit } from "@/components/inventory/stock-split";
import { CountCalc } from "@/components/inventory/count-calc";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ActionButton } from "@/components/motion/action-button";

export const Route = createFileRoute("/contagem")({
  validateSearch: (s: Record<string, unknown>): { pav?: string; produto?: string } => ({
    pav: typeof s.pav === "string" ? s.pav : undefined,
    produto: typeof s.produto === "string" ? s.produto : undefined,
  }),
  component: ContagemPage,
});

function LiveClock() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      Ao vivo · {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

function ContagemPage() {
  const { pav: pavParam, produto: produtoParam } = Route.useSearch();
  const live = useDb();
  const { perfil } = useSession();
  const pavilhoes = live.listPavilhoes();
  const produtos = live.listMercadorias(true);
  const historico = live.listContagens();

  const [pavId, setPavId] = useState(() => pavParam || pavilhoes[0]?.id || "p74");
  const [busca, setBusca] = useState("");
  const [mercId, setMercId] = useState(produtoParam || "");
  const [aberto, setAberto] = useState(false);
  const [contado, setContado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [undoId, setUndoId] = useState<string | null>(null);
  const [escopo, setEscopo] = useState<"pav" | "todos">("pav");
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
    const m = produtos.find((x) => x.id === produtoParam || x.codigo === produtoParam);
    if (m) {
      setMercId(m.id);
      setBusca(`${m.codigo} · ${m.nome}`);
    }
  }, [produtoParam, produtos]);

  const pav = pavilhoes.find((p) => p.id === pavId) ?? pavilhoes[0];
  const merc = produtos.find((m) => m.id === mercId) ?? null;
  const esperado = merc && pav ? live.stockAt(merc.id, pav.id) : 0;
  const nContado = contado === "" ? null : Number(contado.replace(",", "."));
  const validNum = nContado != null && Number.isFinite(nContado) && nContado >= 0;
  const delta = merc && validNum ? nContado - esperado : 0;
  const bateu = validNum && delta === 0;
  const divergiu = validNum && delta !== 0;

  const sugeridos = useMemo(() => {
    const term = fold(busca.trim());
    return produtos
      .filter((m) => {
        if (!term) return true;
        const codigo = fold(m.codigo);
        return fold(m.nome).includes(term) || codigo.includes(term) || codigo.replace(/^0+/, "").includes(term.replace(/^0+/, ""));
      })
      .slice(0, 16);
  }, [produtos, busca]);

  function escolher(id: string) {
    const m = produtos.find((x) => x.id === id);
    if (!m) return;
    setMercId(m.id);
    setBusca(`${m.codigo} · ${m.nome}`);
    setAberto(false);
    setContado("");
    setMotivo("");
    setObs("");
  }

  function limparProduto() {
    setMercId("");
    setBusca("");
    setContado("");
    setMotivo("");
    setObs("");
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
      setContadorNovo("");
      notify.success(divergiu ? "Estoque do pavilhão corrigido." : "Contagem conferida. Quantidade bateu.");
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
    const rows = escopo === "pav" && pav ? historico.filter((c) => c.pavilhao_id === pav.id) : historico;
    return rows.slice(0, 80);
  }, [historico, escopo, pav]);

  const posicoes = useMemo(() => {
    const ids = new Set(recentes.map((c) => c.mercadoria_id));
    if (merc) ids.add(merc.id);
    for (const m of sugeridos) ids.add(m.id);
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
        icon="count"
        title="Contagem"
        description="Conferir o que realmente tem em cada pavilhão. O histórico ao lado atualiza na hora e já mostra o estoque completo — sem precisar abrir o Estoque."
      >
        <CountCalc />
      </PageHeader>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {pavilhoes.map((p) => {
              const active = pav?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPavId(p.id);
                    limparProduto();
                  }}
                  className={cn(
                    "min-h-16 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{p.codigo === "74" ? "Galpão" : "Pavilhão"}</p>
                  <p className="text-xl font-semibold tabular-nums leading-tight">{p.codigo}</p>
                </button>
              );
            })}
          </div>

          {!pav ? (
            <EmptyState icon={ClipboardCheck} title="Cadastre um pavilhão" description="A contagem precisa de um local." />
          ) : (
            <Card>
              <CardContent className="space-y-4 pt-5">
                <div className="space-y-1.5">
                  <Label htmlFor="busca-contagem">Produto</Label>
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
                      placeholder="Nome ou código"
                      autoComplete="off"
                      className="h-12 pl-9"
                    />
                  </div>
                  {aberto && sugeridos.length > 0 ? (
                    <ul className="max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-card">
                      {sugeridos.map((m) => {
                        const qtd = live.stockAt(m.id, pav.id);
                        const total = (posicoes.get(m.id) ?? []).reduce((a, p) => a + p.quantidade, 0);
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
                                <span className="block text-[11px] text-muted-foreground">empresa {formatNumber(total)}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>

                {merc ? (
                  <>
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3">
                      <ProductIcon nome={merc.nome} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[11px] font-bold tabular-nums">{merc.codigo}</p>
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
                      <Label htmlFor="qtd-contado">Quanto tem de verdade</Label>
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

                    {validNum ? (
                      <p className="text-center text-3xl font-semibold tabular-nums leading-none">
                        {formatNumber(nContado)} <span className="text-base font-normal text-muted-foreground">{merc.unidade}</span>
                      </p>
                    ) : null}

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
                <h2 className="text-sm font-semibold">Histórico ao vivo</h2>
                <LiveClock />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{recentes.length} registros</span>
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
              Nenhuma contagem {escopo === "pav" ? "neste pavilhão" : ""} ainda. Ao registrar, a linha aparece aqui na hora.
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
                      <span className="w-5 shrink-0 pt-1 text-right text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
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
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Sistema</dt>
                        <dd className="text-sm font-medium tabular-nums">
                          {formatNumber(c.esperado)} <span className="text-[11px] font-normal text-muted-foreground">{short}</span>
                        </dd>
                      </div>
                      <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Contado</dt>
                        <dd className="text-sm font-semibold tabular-nums">
                          {formatNumber(c.contado)} <span className="text-[11px] font-normal text-muted-foreground">{short}</span>
                        </dd>
                      </div>
                      <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Diferença</dt>
                        <dd className="text-sm font-semibold tabular-nums">
                          {c.delta === 0 ? "Bateu" : c.delta > 0 ? `+${formatNumber(c.delta)}` : formatNumber(c.delta)}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-2 space-y-1 pl-7">
                      <p className="text-xs tabular-nums">
                        <span className="text-muted-foreground">Agora neste pavilhão </span>
                        <span className="font-semibold">
                          {formatNumber(agoraPav)} {un}
                        </span>
                        <span className="text-muted-foreground"> · empresa </span>
                        <span className="font-semibold">
                          {formatNumber(total)} {un}
                        </span>
                      </p>
                      {pos.length > 0 ? (
                        <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] tabular-nums">
                          {pos.map((p) => (
                            <span
                              key={p.id}
                              className={cn(
                                p.id === c.pavilhao_id ? "font-semibold text-foreground" : p.quantidade ? "text-foreground/80" : "text-muted-foreground",
                              )}
                            >
                              {p.nome.replace(/Pavilhão |Galpão /, "")} {formatNumber(p.quantidade)}
                            </span>
                          ))}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground">
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
