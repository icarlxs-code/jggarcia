import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { FileText, Search } from "lucide-react";
import { useSession } from "@/lib/session";
import { useDb } from "@/lib/use-db";
import { pavTitle } from "@/lib/catalog";
import { formatDateBR, formatMinutes, formatNumber, formatTime, todayISO } from "@/lib/format";
import { forkliftRanking, forkliftTrips } from "@/lib/forklift";
import {
  collectReport,
  exportDiaCompletoPdf,
  exportForkliftPdf,
  exportProdutoMovimentoPdf,
  exportReportPdf,
  exportSaidasClientesPdf,
  type ReportKind,
} from "@/lib/reports";
import { fold, cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { ActionButton } from "@/components/motion/action-button";
import { CountUp } from "@/components/motion/count-up";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { ProductLabel } from "@/components/inventory/product-icon";

export const Route = createFileRoute("/relatorios")({ component: Relatorios });

type TabId = "movimento" | "produto" | "lugar" | "empilhador" | "clientes";

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "movimento", label: "Movimento", hint: "Tudo, entradas, saídas ou contagens" },
  { id: "produto", label: "Por produto", hint: "Ex.: uva no pavilhão 13" },
  { id: "lugar", label: "Por pavilhão", hint: "PDF de cada lugar" },
  { id: "empilhador", label: "Empilhadeiras", hint: "Tempo e ranking" },
  { id: "clientes", label: "Clientes", hint: "Saídas agrupadas" },
];

function Relatorios() {
  const { isAdmin } = useSession();
  const live = useDb();
  const pavilhoes = live.listPavilhoes();
  const destinos = live.listDestinos();
  const mercadorias = live.listMercadorias(true);
  const hoje = todayISO();
  const [tab, setTab] = useState<TabId>("movimento");
  const [from, setFrom] = useState(hoje);
  const [to, setTo] = useState(hoje);
  const [pav, setPav] = useState("todos");
  const [kind, setKind] = useState<ReportKind>("tudo");
  const [busca, setBusca] = useState("");
  const [prodQuery, setProdQuery] = useState("");
  const [prodId, setProdId] = useState("");
  const [prodKind, setProdKind] = useState<ReportKind>("tudo");
  const [prodPav, setProdPav] = useState("todos");
  const [empNome, setEmpNome] = useState("");
  const [cliId, setCliId] = useState("");
  const [cliQuery, setCliQuery] = useState("");

  const rows = collectReport({ from, to, pavilhaoId: pav, kind });
  const saidasRank = live.listSaidas({ from, to, tipo: "saida" });
  const lift = forkliftRanking(forkliftTrips(saidasRank, pavilhoes));

  const prodRows = collectReport({
    from,
    to,
    pavilhaoId: prodPav,
    kind: prodKind === "contagem" ? "tudo" : prodKind,
    mercadoriaId: prodId || undefined,
    produtoQuery: prodId ? undefined : prodQuery,
  });
  const prodIns = prodRows.filter((r) => r.kind === "entrada");
  const prodOuts = prodRows.filter((r) => r.kind === "saida");

  const ins = rows.filter((r) => r.kind === "entrada");
  const outs = rows.filter((r) => r.kind === "saida");
  const counts = rows.filter((r) => r.kind === "contagem");
  const sum = (list: typeof rows) => list.reduce((a, r) => a + r.quantidade, 0);
  const term = fold(busca.trim());
  const filtered = term
    ? rows.filter(
        (r) =>
          fold(r.produto).includes(term) ||
          fold(r.codigo).includes(term) ||
          fold(r.lugar).includes(term) ||
          fold(r.cliente).includes(term) ||
          fold(r.usuario).includes(term),
      )
    : rows;

  const matches = useMemo(() => {
    const q = fold(prodQuery.trim());
    if (!q) return mercadorias.slice(0, 12);
    return mercadorias
      .filter((m) => fold(m.nome).includes(q) || fold(m.codigo).includes(q) || fold(m.codigo).replace(/^0+/, "").includes(q.replace(/^0+/, "")))
      .slice(0, 16);
  }, [mercadorias, prodQuery]);

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

  const selectedProd = mercadorias.find((m) => m.id === prodId);

  return (
    <PageStage className="space-y-4">
      <PageHeader
        icon="chart"
        title="Relatórios"
        description="Abas por tipo de recorte. Dá para baixar o dia inteiro ou só a entrada e a saída de um produto, de um pavilhão."
      />

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex h-11 shrink-0 flex-col justify-center rounded-xl border px-3.5 text-left transition-colors",
              tab === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
            )}
          >
            <span className="text-sm font-semibold leading-none">{t.label}</span>
            <span className={cn("mt-1 text-[10px] leading-none", tab === t.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {t.hint}
            </span>
          </button>
        ))}
      </div>

      <SpotlightCard className="p-4 sm:p-5">
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
      </SpotlightCard>

      {tab === "movimento" ? (
        <>
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

          <button
            type="button"
            onClick={() => {
              setPav("todos");
              pdf("todos");
            }}
            className="w-full rounded-2xl border border-primary bg-primary px-4 py-4 text-left text-primary-foreground shadow-card"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Todos de uma vez</p>
            <p className="mt-1 text-base font-semibold">O que aconteceu no período · {kinds.find((k) => k.id === kind)?.label}</p>
            <p className="text-xs opacity-80">Pavilhões 11, 13, 23, 44 e Galpão 74 juntos</p>
          </button>
          <button
            type="button"
            onClick={() => exportDiaCompletoPdf(from === to ? from : to)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-4 text-left shadow-card hover:bg-muted"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Encerrar o dia</p>
            <p className="mt-1 text-base font-semibold">PDF completo · entradas, saídas, quem lançou, quem contou, empilhador e estoque</p>
            <p className="mt-1 text-xs text-muted-foreground">{from === to ? formatDateBR(from) : `${formatDateBR(from)} — ${formatDateBR(to)} (usa o último dia)`}</p>
          </button>

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

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar na lista: produto, pavilhão, cliente…"
              className="pl-10"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nada neste filtro. Mude o dia, o pavilhão ou a busca.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.slice(0, 80).map((r) => (
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
        </>
      ) : null}

      {tab === "produto" ? (
        <section className="space-y-3">
          <SpotlightCard className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Produto específico</p>
            <p className="mt-1 text-sm">Escreva o nome — uva, tomate, maçã — ou toque numa variedade. Depois escolha o pavilhão.</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={prodQuery}
                onChange={(e) => {
                  setProdQuery(e.target.value);
                  setProdId("");
                }}
                placeholder="Ex.: uva  ·  pavilhão 13"
                className="pl-10"
              />
            </div>
            {selectedProd ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Variedade pinada: <span className="font-medium text-foreground">{selectedProd.nome}</span>. Apague a busca para voltar à família inteira.
              </p>
            ) : prodQuery.trim() ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Relatório da família “{prodQuery.trim()}” — todas as variedades que batem com a busca.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Digite para filtrar. Sem busca, o PDF pega todos os produtos do pavilhão.</p>
            )}
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setProdId(m.id);
                      setProdQuery(m.nome);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-xl border px-2 py-1.5 text-left",
                      prodId === m.id ? "border-primary bg-mint" : "border-border hover:bg-muted",
                    )}
                  >
                    <ProductLabel nome={m.nome} codigo={m.codigo} extra={m.unidade} />
                  </button>
                </li>
              ))}
            </ul>
          </SpotlightCard>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lugar</p>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Chip on={prodPav === "todos"} onClick={() => setProdPav("todos")}>
                Todos
              </Chip>
              {pavilhoes.map((p) => (
                <Chip key={p.id} on={prodPav === p.id} onClick={() => setProdPav(p.id)}>
                  {pavTitle(p)}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">O que entra</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["tudo", "Entradas e saídas"],
                ["entrada", "Só entradas"],
                ["saida", "Só saídas"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setProdKind(id)}
                  className={cn(
                    "min-h-12 rounded-xl border px-3 text-sm font-medium",
                    prodKind === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Lançamentos" value={prodRows.length} />
            <Kpi label="Entrou" value={sum(prodIns)} />
            <Kpi label="Saiu" value={sum(prodOuts)} />
            <Kpi label="Variedades" value={new Set(prodRows.map((r) => r.codigo || r.produto)).size} />
          </div>

          <ActionButton
            className="h-12 w-full"
            idleLabel="Baixar PDF deste produto"
            pendingLabel="Montando PDF"
            doneLabel="PDF pronto"
            onAction={() => {
              exportProdutoMovimentoPdf({
                from,
                to,
                pavilhaoId: prodPav,
                mercadoriaId: prodId || undefined,
                produtoQuery: prodId ? undefined : prodQuery.trim() || undefined,
                kind: prodKind,
              });
              return true;
            }}
          >
            <FileText /> Baixar PDF deste produto
          </ActionButton>

          <Card>
            <CardContent className="p-0">
              {prodRows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nada neste recorte. Tente “uva” + Pavilhão 13, ou mude o período.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {prodRows.slice(0, 80).map((r) => (
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
                          {r.operador ? ` · Empilhador ${r.operador}` : ""}
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
        </section>
      ) : null}

      {tab === "lugar" ? (
        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold">PDF por lugar</h2>
            <p className="text-xs text-muted-foreground">Cada cartão abre a impressão daquele pavilhão. Na caixa, escolha Salvar como PDF.</p>
          </div>
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
      ) : null}

      {tab === "empilhador" ? (
        <section className="space-y-3">
          <SpotlightCard className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Empilhadeiras</p>
            <p className="mt-1 text-sm">Ranking da equipe ou PDF de um empilhador só.</p>
            {lift.fastest ? (
              <p className="mt-2 text-sm">
                Mais rápido no período: <span className="font-semibold">{lift.fastest.nome}</span> · média {formatMinutes(lift.fastest.avg)} em {lift.fastest.trips} viagens.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Ainda sem empilhador nas saídas deste filtro. O nome na nota de saída não é obrigatório.</p>
            )}
            {lift.rank.length > 0 ? (
              <ol className="mt-3 space-y-1.5">
                {lift.rank.slice(0, 12).map((r, i) => (
                  <li key={r.nome}>
                    <button
                      type="button"
                      onClick={() => setEmpNome(r.nome)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm",
                        empNome === r.nome ? "border-primary bg-mint" : "border-transparent hover:bg-muted",
                      )}
                    >
                      <span>
                        {i + 1}. {r.nome}
                        <span className="text-muted-foreground"> · {r.trips} viagens</span>
                      </span>
                      <span className="tabular-nums font-medium">{formatMinutes(r.avg)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
              <ActionButton
                variant="outline"
                className="h-12 w-full"
                idleLabel={empNome ? `PDF de ${empNome}` : "PDF individual"}
                pendingLabel="Montando PDF"
                doneLabel="PDF pronto"
                onAction={() => {
                  if (!empNome) {
                    notify.error("Toque num empilhador da lista para baixar só o dele.");
                    return false;
                  }
                  exportForkliftPdf({ from, to, operador: empNome });
                  return true;
                }}
              >
                <FileText /> {empNome ? `PDF de ${empNome}` : "PDF de um empilhador"}
              </ActionButton>
            </div>
          </SpotlightCard>
        </section>
      ) : null}

      {tab === "clientes" ? (
        <section className="space-y-3">
          <SpotlightCard className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente específico</p>
            <p className="mt-1 text-sm">Escolha um cliente e veja entradas e saídas só dele. Pode cruzar com produto.</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={cliQuery}
                onChange={(e) => {
                  setCliQuery(e.target.value);
                  setCliId("");
                }}
                placeholder="Nome do cliente"
                className="pl-10"
              />
            </div>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {destinos
                .filter((d) => !cliQuery.trim() || fold(d.nome).includes(fold(cliQuery)))
                .slice(0, 12)
                .map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCliId(d.id);
                        setCliQuery(d.nome);
                      }}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2 text-left text-sm",
                        cliId === d.id ? "border-primary bg-mint" : "border-border hover:bg-muted",
                      )}
                    >
                      {d.nome}
                    </button>
                  </li>
                ))}
            </ul>
          </SpotlightCard>
          {(() => {
            const cliRows = collectReport({
              from,
              to,
              pavilhaoId: pav,
              kind: "tudo",
              destinoId: cliId || undefined,
              mercadoriaId: prodId || undefined,
              produtoQuery: prodId ? undefined : prodQuery.trim() || undefined,
            }).filter((r) => r.kind !== "contagem");
            const selectedCli = destinos.find((d) => d.id === cliId);
            return (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Kpi label="Lançamentos" value={cliRows.length} />
                  <Kpi label="Entrou" value={cliRows.filter((r) => r.kind === "entrada").reduce((a, r) => a + r.quantidade, 0)} />
                  <Kpi label="Saiu" value={cliRows.filter((r) => r.kind === "saida").reduce((a, r) => a + r.quantidade, 0)} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ActionButton
                    className="h-12 w-full"
                    idleLabel={selectedCli ? `PDF de ${selectedCli.nome}` : "PDF deste cliente"}
                    pendingLabel="Montando PDF"
                    doneLabel="PDF pronto"
                    onAction={() => {
                      if (!cliId) {
                        notify.error("Escolha um cliente.");
                        return false;
                      }
                      exportReportPdf({
                        from,
                        to,
                        pavilhaoId: pav,
                        kind: "tudo",
                        destinoId: cliId,
                        mercadoriaId: prodId || undefined,
                        produtoQuery: prodId ? undefined : prodQuery.trim() || undefined,
                      });
                      return true;
                    }}
                  >
                    <FileText /> PDF deste cliente
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    className="h-12 w-full"
                    idleLabel="PDF saídas por cliente"
                    pendingLabel="Montando PDF"
                    doneLabel="PDF pronto"
                    onAction={() => {
                      exportSaidasClientesPdf({ from, to, pavilhaoId: pav === "todos" ? undefined : pav, destinoId: cliId || undefined });
                      return true;
                    }}
                  >
                    <FileText /> PDF saídas agrupadas
                  </ActionButton>
                </div>
                <Card>
                  <CardContent className="p-0">
                    {cliRows.length === 0 ? (
                      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                        {cliId ? "Nada neste cliente no período." : "Escolha um cliente para ver o movimento."}
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {cliRows.slice(0, 80).map((r) => (
                          <li key={`${r.kind}-${r.id}`} className="flex items-start gap-3 px-4 py-3">
                            <span
                              className={cn(
                                "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                r.kind === "entrada" ? "bg-mint text-primary" : "bg-secondary text-secondary-foreground",
                              )}
                            >
                              {r.kind === "entrada" ? "Entrou" : "Saiu"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{r.produto}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatDateBR(r.data)} · {r.lugar}
                                {r.cliente ? ` → ${r.cliente}` : ""}
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
              </>
            );
          })()}
        </section>
      ) : null}
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
