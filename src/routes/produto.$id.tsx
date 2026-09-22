import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, FileText, Package } from "lucide-react";
import { useDb } from "@/lib/use-db";
import { stockAlert } from "@/lib/store";
import { formatDateTimeBR, formatNumber, todayISO } from "@/lib/format";
import { destinoDaSaida, lugarDaSaida, pavTitle } from "@/lib/catalog";
import { tipoMovimentacaoOf } from "@/lib/movement";
import { motivoContagemLabel } from "@/lib/constants";
import { exportReportPdf, productTimeline } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { CountUp } from "@/components/motion/count-up";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { ProductStage } from "@/components/motion/product-stage";
import { StockSplit } from "@/components/inventory/stock-split";
import { StockBadge } from "@/components/inventory/stock-badge";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produto/$id")({ component: ProdutoPerfil });

function ProdutoPerfil() {
  const { id } = Route.useParams();
  const live = useDb();
  const merc = live.listMercadorias().find((m) => m.id === id || m.codigo === id);
  const timeline = merc ? productTimeline(merc.id) : [];
  const hoje = todayISO();
  const pavilhoes = live.listPavilhoes(true);
  const diffs = merc
    ? live
        .listContagens()
        .filter((c) => c.mercadoria_id === merc.id && c.delta !== 0)
        .slice(0, 12)
    : [];

  if (!merc) {
    return (
      <PageStage>
        <EmptyState icon={Package} title="Produto não encontrado" description="Ele pode ter sido removido do catálogo.">
          <Button asChild>
            <Link to="/estoque">Voltar ao estoque</Link>
          </Button>
        </EmptyState>
      </PageStage>
    );
  }

  return (
    <PageStage className="mx-auto max-w-3xl space-y-4">
      <PageHeader icon="package" title={merc.nome} description={`Código ${merc.codigo} · histórico, estoque por pavilhão e diferenças de contagem`}>
        <StockBadge alert={stockAlert(merc)} />
      </PageHeader>

      <SpotlightCard className="overflow-hidden p-0">
        <ProductStage nome={merc.nome} codigo={merc.codigo} />
        <div className="flex items-end justify-between gap-3 px-5 pb-5 pt-2">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-bold tabular-nums">{merc.codigo}</p>
            <p className="truncate font-medium">{merc.nome}</p>
            <p className="text-xs text-muted-foreground">{merc.categoria || merc.unidade}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums leading-none">
              <CountUp value={merc.estoque} />
            </p>
            <p className="text-[11px] text-muted-foreground">{merc.unidade} no total</p>
          </div>
        </div>
      </SpotlightCard>

      <StockSplit mercadoriaId={merc.id} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button asChild variant="outline" className="h-11">
          <Link to="/entradas" search={{ produto: merc.id }}>
            <ArrowDownToLine /> Entrada
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link to="/nova-saida" search={{ produto: merc.id }}>
            <ArrowUpFromLine /> Saída
          </Link>
        </Button>
        <Button asChild className="h-11">
          <Link to="/contagem" search={{ produto: merc.id }}>
            <ClipboardCheck /> Contar
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() =>
            exportReportPdf({
              from: "2000-01-01",
              to: hoje,
              pavilhaoId: "todos",
              kind: "tudo",
              mercadoriaId: merc.id,
            })
          }
        >
          <FileText /> PDF do produto
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Sobra e falta</h2>
        {diffs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma diferença registrada. As contagens bateram, ou ainda não houve conferência.
          </p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {diffs.map((c) => {
                  const pav = pavilhoes.find((p) => p.id === c.pavilhao_id);
                  const sobra = c.delta > 0;
                  return (
                    <li key={c.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{c.contador || c.usuario_nome}</span> contou {formatNumber(c.contado)} {c.unidade}
                            {pav ? ` no ${pavTitle(pav)}` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Sistema tinha {formatNumber(c.esperado)}
                            {c.motivo && c.motivo !== "conferencia" ? ` · ${motivoContagemLabel(c.motivo)}` : ""}
                            {c.observacao ? ` · ${c.observacao}` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{formatDateTimeBR(c.created_at)}</p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                            sobra ? "bg-mint text-primary" : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {sobra ? "Sobrou" : "Faltou"} {formatNumber(Math.abs(c.delta))}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Histórico deste produto</h2>
        {timeline.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Ainda não há entrada, saída ou contagem neste item.
          </p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {timeline.slice(0, 80).map((ev) => (
                  <li key={`${ev.kind}-${ev.id}`} className="flex items-start gap-3 px-4 py-3">
                    <span
                      className={cn(
                        "mt-0.5 w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide",
                        ev.kind === "entrada" && "bg-mint text-primary",
                        ev.kind === "saida" && "bg-secondary text-secondary-foreground",
                        ev.kind === "transferencia" && "bg-gold/20 text-gold-ink",
                        ev.kind === "contagem" && "bg-muted text-foreground",
                        ev.kind === "log" && "bg-card text-muted-foreground ring-1 ring-border",
                      )}
                    >
                      {ev.title}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {ev.kind === "entrada" && (
                          <>
                            <span className="font-medium">{ev.who}</span> lançou {formatNumber(ev.qty)} {ev.unidade} no {ev.lugar}
                          </>
                        )}
                        {ev.kind === "saida" && (
                          <>
                            <span className="font-medium">{ev.who}</span> saiu com {formatNumber(ev.qty)} {ev.unidade} do {ev.lugar}
                            {ev.extra ? ` → ${ev.extra}` : ""}
                            {"desconta" in ev && ev.desconta === false ? " · somente registro" : ""}
                          </>
                        )}
                        {ev.kind === "transferencia" && (
                          <>
                            <span className="font-medium">{ev.who}</span> transferiu {formatNumber(ev.qty)} {ev.unidade} {ev.lugar}
                            {ev.extra ? ` → ${ev.extra}` : ""}
                            {"desconta" in ev && ev.desconta === false ? " · somente registro" : ""}
                          </>
                        )}
                        {ev.kind === "contagem" && (
                          <>
                            <span className="font-medium">{ev.who}</span> contou {formatNumber(ev.qty)} {ev.unidade} no {ev.lugar}
                          </>
                        )}
                        {ev.kind === "log" && <>{ev.extra}</>}
                      </p>
                      {ev.kind === "contagem" && ev.extra ? <p className="text-[11px] text-muted-foreground">{ev.extra}</p> : null}
                      <p className="text-[11px] text-muted-foreground">{formatDateTimeBR(ev.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </PageStage>
  );
}
