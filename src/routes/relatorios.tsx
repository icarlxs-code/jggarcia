import { useState, type ReactNode } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useSession } from "@/lib/session";
import { useDb } from "@/lib/use-db";
import { pavTitle } from "@/lib/catalog";
import { formatDateBR, formatMinutes, formatNumber, formatTime, todayISO } from "@/lib/format";
import { forkliftRanking, forkliftTrips } from "@/lib/forklift";
import { collectReport, exportForkliftPdf, exportReportPdf, exportSaidasClientesPdf, type ReportKind } from "@/lib/reports";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { ActionButton } from "@/components/motion/action-button";
import { CountUp } from "@/components/motion/count-up";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/relatorios")({ component: Relatorios });

function Relatorios() {
  const { isAdmin } = useSession();
  const live = useDb();
  const pavilhoes = live.listPavilhoes();
  const hoje = todayISO();
  const [from, setFrom] = useState(hoje);
  const [to, setTo] = useState(hoje);
  const [pav, setPav] = useState("todos");
  const [kind, setKind] = useState<ReportKind>("tudo");

  const rows = collectReport({ from, to, pavilhaoId: pav, kind });
  const saidasRank = live.listSaidas({ from, to, tipo: "saida" });
  const lift = forkliftRanking(forkliftTrips(saidasRank, pavilhoes));

  const ins = rows.filter((r) => r.kind === "entrada");
  const outs = rows.filter((r) => r.kind === "saida");
  const counts = rows.filter((r) => r.kind === "contagem");
  const sum = (list: typeof rows) => list.reduce((a, r) => a + r.quantidade, 0);

  if (!isAdmin) return <Navigate to="/" />;

  const kinds: { id: ReportKind; label: string; hint: string }[] = [
    { id: "tudo", label: "Tudo", hint: "Entrou, saiu e contou" },
    { id: "entrada", label: "Só entradas", hint: "O que chegou" },
    { id: "saida", label: "Só saídas", hint: "O que saiu" },
    { id: "contagem", label: "Só contagens", hint: "Conferências" },
  ];

  function pdf(pavilhaoId: string, k: ReportKind = kind) {
    exportReportPdf({ from, to, pavilhaoId, kind: k });
    return true;
  }

  return (
    <PageStage className="space-y-4">
      <PageHeader
        icon="chart"
        title="Relatórios"
        description="PDF separado por pavilhão, ou tudo de uma vez. Só entrada, só saída ou o dia inteiro."
      />

      <SpotlightCard className="p-4 sm:p-5">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="from">De</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">Até</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">O que entra no PDF</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {kinds.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "min-h-16 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                    kind === k.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <p className="text-sm font-semibold">{k.label}</p>
                  <p className={cn("text-[11px]", kind === k.id ? "text-primary-foreground/80" : "text-muted-foreground")}>{k.hint}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </SpotlightCard>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold">Gerar PDF por lugar</h2>
          <p className="text-xs text-muted-foreground">Cada cartão abre a impressão daquele pavilhão. Na caixa, escolha Salvar como PDF.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPav("todos");
            pdf("todos");
          }}
          className="w-full rounded-2xl border border-primary bg-primary px-4 py-4 text-left text-primary-foreground shadow-card"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Todos de uma vez</p>
          <p className="mt-1 text-base font-semibold">O que aconteceu no dia · {kinds.find((k) => k.id === kind)?.label}</p>
          <p className="mt-1 text-xs opacity-80">Pavilhões 11, 13, 23, 44 e Galpão 74 juntos</p>
        </button>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {pavilhoes.map((p) => {
            const on = pav === p.id;
            return (
              <SpotlightCard key={p.id} className={cn("overflow-hidden", on && "ring-1 ring-primary")}>
                <button
                  type="button"
                  onClick={() => {
                    setPav(p.id);
                    pdf(p.id);
                  }}
                  className="flex min-h-[5.5rem] w-full flex-col items-start px-4 py-3 text-left"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {p.codigo === "74" ? "Galpão" : "Pavilhão"}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums leading-tight">{p.codigo}</p>
                  <p className="mt-auto pt-1 text-xs text-muted-foreground">PDF só daqui</p>
                </button>
              </SpotlightCard>
            );
          })}
        </div>
      </section>

      <SpotlightCard className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Empilhadeiras</p>
        <p className="mt-1 text-sm">
          Tempo médio de cada empilhador, rota mais rápida e mais lenta, e quem chegou primeiro.
        </p>
        {lift.fastest ? (
          <p className="mt-2 text-sm">
            Mais rápido no período: <span className="font-semibold">{lift.fastest.nome}</span> · média {formatMinutes(lift.fastest.avg)} em {lift.fastest.trips} viagens.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Ainda sem empilhador nas saídas deste filtro. O nome na nota de saída não é obrigatório.</p>
        )}
        {lift.rank.length > 0 ? (
          <ol className="mt-3 space-y-1.5">
            {lift.rank.slice(0, 5).map((r, i) => (
              <li key={r.nome} className="flex items-center justify-between text-sm">
                <span>
                  {i + 1}. {r.nome}
                  <span className="text-muted-foreground"> · {r.trips} viagens</span>
                </span>
                <span className="tabular-nums font-medium">{formatMinutes(r.avg)}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="mt-3">
          <ActionButton
            className="h-12 w-full"
            idleLabel="PDF do ranking"
            pendingLabel="Montando PDF"
            doneLabel="PDF pronto"
            onAction={() => {
              exportForkliftPdf({ from, to });
              return true;
            }}
          >
            <FileText /> PDF do ranking
          </ActionButton>
        </div>
      </SpotlightCard>

      <SpotlightCard className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Saídas para clientes</p>
        <p className="mt-1 text-sm">PDF só do que saiu, agrupado por quem recebeu.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ActionButton
            className="h-12 w-full"
            idleLabel="PDF saídas por cliente"
            pendingLabel="Montando PDF"
            doneLabel="PDF pronto"
            onAction={() => {
              exportSaidasClientesPdf({ from, to, pavilhaoId: pav === "todos" ? undefined : pav });
              return true;
            }}
          >
            <FileText /> PDF saídas por cliente
          </ActionButton>
          <ActionButton
            variant="outline"
            className="h-12 w-full"
            idleLabel="PDF deste filtro"
            pendingLabel="Montando PDF"
            doneLabel="PDF pronto"
            onAction={() => pdf(pav)}
          >
            <FileText /> PDF deste filtro
          </ActionButton>
        </div>
      </SpotlightCard>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Lançamentos" value={rows.length} />
        <Kpi label="Entrou" value={sum(ins)} />
        <Kpi label="Saiu" value={sum(outs)} />
        <Kpi label="Contagens" value={counts.length} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip on={pav === "todos"} onClick={() => setPav("todos")}>
          Todos
        </Chip>
        {pavilhoes.map((p) => (
          <Chip key={p.id} on={pav === p.id} onClick={() => setPav(p.id)}>
            {pavTitle(p)}
          </Chip>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nada neste filtro. Mude o dia ou o pavilhão.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.slice(0, 80).map((r) => (
                <li key={`${r.kind}-${r.id}`} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      r.kind === "entrada" && "bg-mint text-primary",
                      r.kind === "saida" && "bg-secondary text-secondary-foreground",
                      r.kind === "contagem" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {r.kind === "entrada" ? "Entrou" : r.kind === "saida" ? "Saiu" : "Contou"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.produto}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateBR(r.data)} · {formatTime(r.hora) !== "—" ? formatTime(r.hora) : ""} {r.lugar}
                      {r.cliente ? ` → ${r.cliente}` : ""} · {r.usuario}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatNumber(r.quantidade)} {r.unidade}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Ranking de clientes e produto que mais sai ficam em{" "}
        <Link to="/clientes" className="font-medium text-foreground underline-offset-2 hover:underline">
          Clientes
        </Link>
        .
      </p>
    </PageStage>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-medium",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums leading-none">
        <CountUp value={value} />
      </p>
    </div>
  );
}
