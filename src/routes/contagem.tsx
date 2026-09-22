import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, Search, Undo2 } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { useSession } from "@/lib/session";
import { MOTIVOS_CONTAGEM } from "@/lib/constants";
import { formatDateTimeBR, formatNumber } from "@/lib/format";
import { notify } from "@/lib/notify";
import { fold, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { EmptyState } from "@/components/empty-state";
import { ProductIcon, ProductLabel } from "@/components/inventory/product-icon";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ActionButton } from "@/components/motion/action-button";

export const Route = createFileRoute("/contagem")({
  validateSearch: (s: Record<string, unknown>): { pav?: string; produto?: string } => ({
    pav: typeof s.pav === "string" ? s.pav : undefined,
    produto: typeof s.produto === "string" ? s.produto : undefined,
  }),
  component: ContagemPage,
});

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

  const recentes = historico.filter((c) => !pav || c.pavilhao_id === pav.id).slice(0, 24);

  return (
    <PageStage className="mx-auto max-w-3xl space-y-4">
      <PageHeader icon="count" title="Contagem" description="Conferir o que realmente tem em cada pavilhão. Motivo é opcional. A diferença fica no perfil do produto." />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => escolher(m.id)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted"
                        >
                          <ProductLabel nome={m.nome} codigo={m.codigo} className="min-w-0 flex-1" />
                          <span className="shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                            {formatNumber(qtd)} {m.unidade}
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
                      No sistema neste pavilhão: <span className="font-medium tabular-nums text-foreground">{formatNumber(esperado)} {merc.unidade}</span>
                    </p>
                  </div>
                </div>

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
                  <p className="text-xs text-muted-foreground">
                    O nome fica salvo e aparece na lista da próxima vez.
                  </p>
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Histórico neste pavilhão</h2>
          <span className="text-xs text-muted-foreground">{recentes.length} registros</span>
        </div>
        {recentes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma contagem neste pavilhão ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {recentes.map((c) => {
              const prod = produtos.find((m) => m.id === c.mercadoria_id);
              return (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  {prod ? (
                    <Link to="/produto/$id" params={{ id: prod.id }} className="min-w-0 flex-1">
                      <ProductLabel nome={prod.nome} codigo={prod.codigo} className="min-w-0" />
                    </Link>
                  ) : (
                    <span className="flex-1 text-sm">Produto</span>
                  )}
                  <div className="shrink-0 text-right">
                    <p className="text-sm tabular-nums font-medium">
                      {formatNumber(c.contado)} {c.unidade}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.contador || c.usuario_nome} · {formatDateTimeBR(c.created_at)}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="Desfazer" onClick={() => setUndoId(c.id)}>
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
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
