import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { Check, Settings2, Trophy } from "lucide-react";
import { useDb } from "@/lib/use-db";
import { useSession } from "@/lib/session";
import { dailySeries, productFlow } from "@/lib/dashboard-stats";
import { formatMinutes, formatNumber, formatPeriodo, painelRange, todayISO, type PainelPeriodo } from "@/lib/format";
import { forkliftRanking, forkliftTrips } from "@/lib/forklift";
import { CHART_WIDGETS, DEFAULT_CHARTS, readUiPrefs, writeUiPrefs, type ChartFlags, type ChartWidgetId } from "@/lib/ui-prefs";
import { notify } from "@/lib/notify";
import { ProductIcon } from "@/components/inventory/product-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { cn } from "@/lib/utils";

const PERIODS: { id: PainelPeriodo; label: string }[] = [
  { id: "dia", label: "Dia" },
  { id: "semana", label: "Semana" },
  { id: "quinzena", label: "Quinzena" },
  { id: "mes", label: "Mês" },
];

export function HojeCharts() {
  const live = useDb();
  const { perfil } = useSession();
  const [period, setPeriod] = useState<PainelPeriodo>("dia");
  const [day, setDay] = useState(todayISO());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const [setup, setSetup] = useState(false);
  const [draft, setDraft] = useState<ChartFlags>(() => readUiPrefs(perfil?.id).charts);
  const [saved, setSaved] = useState<ChartFlags>(() => readUiPrefs(perfil?.id).charts);

  useEffect(() => {
    const next = readUiPrefs(perfil?.id).charts;
    setDraft(next);
    setSaved(next);
  }, [perfil?.id]);

  const range = painelRange(period, day);
  const movs = live.listSaidas({ from: range.from, to: range.to });
  const pavilhoes = live.listPavilhoes();
  const flow = useMemo(() => productFlow(movs), [movs]);
  const series = useMemo(() => dailySeries(movs, range.from, range.to), [movs, range.from, range.to]);
  const lift = useMemo(
    () => forkliftRanking(forkliftTrips(movs.filter((s) => (s.tipo ?? "saida") === "saida"), pavilhoes)),
    [movs, pavilhoes],
  );

  function toggle(id: ChartWidgetId) {
    setDraft((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function savePanel() {
    writeUiPrefs(perfil?.id, { charts: draft });
    setSaved(draft);
    notify.success(`Painel salvo em ${perfil?.nome ? perfil.nome.split(" ")[0] : "este perfil"}. As outras contas não mudam.`);
    setSetup(false);
  }

  function show(id: ChartWidgetId) {
    return saved[id] !== false;
  }

  const anyOn = CHART_WIDGETS.some((w) => show(w.id));

  return (
    <section className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Painel do dia</h2>
          <p className="text-xs text-muted-foreground">
            Ao vivo · {formatPeriodo(range.from, range.to)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveClock now={now} />
          <Button variant={setup ? "default" : "outline"} size="sm" onClick={() => setSetup((v) => !v)}>
          <Settings2 className="h-4 w-4" />
          {setup ? "Fechar" : "Personalizar"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={cn(
              "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
              period === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {p.label}
          </button>
        ))}
        <Input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          aria-label="Dia de referência"
          className="h-8 w-[10.5rem]"
        />
      </div>

      {setup ? (
        <SpotlightCard className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Este perfil</p>
          <p className="mt-1 text-sm">
            {perfil?.nome || "Sua conta"} escolhe o que aparece. Outro login não herda nem altera estes gráficos.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {CHART_WIDGETS.map((w) => {
              const on = draft[w.id] !== false;
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => toggle(w.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      on ? "border-primary bg-mint" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                      )}
                    >
                      {on ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{w.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{w.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraft({ ...DEFAULT_CHARTS })}
            >
              Ativar todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDraft({
                  destaques: false,
                  topEntrada: false,
                  topSaida: false,
                  comparativo: false,
                  empilhador: false,
                  movimento: false,
                })
              }
            >
              Desativar todos
            </Button>
            <Button size="sm" onClick={savePanel}>
              Salvar painel
            </Button>
          </div>
        </SpotlightCard>
      ) : null}

      {!anyOn ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum gráfico ativo neste perfil. Toque em Personalizar gráficos para ligar o que quiser.
        </p>
      ) : null}

      {show("destaques") ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <HeroStat
            kicker="Mais entrou"
            item={flow.maisEntrou}
            empty="Nenhuma entrada neste recorte."
            tone="in"
          />
          <HeroStat
            kicker="Mais saiu"
            item={flow.maisSaiu}
            empty="Nenhuma saída neste recorte."
            tone="out"
          />
        </div>
      ) : null}

      {(show("topEntrada") || show("topSaida")) ? (
      <div className="grid gap-2 lg:grid-cols-2">
        {show("topEntrada") ? <RankCard title="Produtos que mais entrou" rows={flow.topEntrada} tone="in" empty="Nada entrou neste recorte." /> : null}
        {show("topSaida") ? <RankCard title="Produtos que mais saiu" rows={flow.topSaida} tone="out" empty="Nada saiu neste recorte." /> : null}
      </div>
      ) : null}

      {show("movimento") ? (
        <SpotlightCard className="p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Movimento</p>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-sm bg-primary" /> Entrou</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-sm bg-gold" /> Saiu</span>
            </div>
          </div>
          <div className="h-28">
            {series.every((d) => !d.entradas && !d.saidas) ? (
              <p className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem movimento neste recorte.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="jgIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="jgOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={28} axisLine={false} tickLine={false} />
                  <ChartTooltip content={<FlowTooltip />} />
                  <Area type="monotone" dataKey="entradas" name="Entrou" stroke="var(--color-primary)" fill="url(#jgIn)" strokeWidth={2} />
                  <Area type="monotone" dataKey="saidas" name="Saiu" stroke="var(--color-gold)" fill="url(#jgOut)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </SpotlightCard>
      ) : null}

      {(show("comparativo") || show("empilhador")) ? (
      <div className="grid gap-2 lg:grid-cols-2">
      {show("comparativo") ? (
        <SpotlightCard className="p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entrada × saída</p>
          {flow.comparativo.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Sem lançamentos para comparar.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {flow.comparativo.slice(0, 6).map((row) => {
                const max = Math.max(row.entradas, row.saidas, 1);
                return (
                  <li key={row.id} className="flex items-center gap-2">
                    <ProductIcon nome={row.nome} codigo={row.codigo} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium leading-tight">{row.nome}</p>
                      <div className="mt-0.5 space-y-0.5">
                        <MiniBar value={row.entradas} max={max} className="bg-primary" label={`Entrou ${formatNumber(row.entradas)}`} />
                        <MiniBar value={row.saidas} max={max} className="bg-gold" label={`Saiu ${formatNumber(row.saidas)}`} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SpotlightCard>
      ) : null}

      {show("empilhador") ? (
        <SpotlightCard className="p-3">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Empilhadores</p>
          </div>
          {lift.fastest ? (
            <p className="mt-1.5 truncate text-[13px]">
              <span className="font-semibold">{lift.fastest.nome}</span>
              <span className="text-muted-foreground"> · {formatMinutes(lift.fastest.avg)} · {lift.fastest.trips} {lift.fastest.trips === 1 ? "viagem" : "viagens"}</span>
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Escreva o empilhador na saída — com duas viagens o ranking já mede o tempo.
            </p>
          )}
          {lift.rank.length > 0 ? (
            <ol className="mt-2 space-y-1.5">
              {lift.rank.slice(0, 6).map((r, i) => {
                const max = lift.rank[lift.rank.length - 1]?.avg || r.avg || 1;
                const pct = Math.max(8, Math.round((r.avg / max) * 100));
                return (
                  <li key={r.nome}>
                    <div className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className="min-w-0 truncate">
                        <span className="mr-1.5 inline-block w-3.5 text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                        {r.nome}
                        <span className="text-muted-foreground"> · {r.trips}</span>
                      </span>
                      <span className={cn("shrink-0 tabular-nums font-semibold", i === 0 && "text-primary")}>{formatMinutes(r.avg)}</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-primary/40")} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </SpotlightCard>
      ) : null}
      </div>
      ) : null}
    </section>
  );
}

function LiveClock({ now }: { now: Date }) {
  const clock = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-card px-2.5 text-[11px] text-muted-foreground">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      Ao vivo · {clock}
    </span>
  );
}

function rankUnit(unidade?: string) {
  const u = (unidade || "").trim();
  if (!u) return "";
  const low = u.toLowerCase();
  if (low === "cx" || low.startsWith("caixa")) return "Caixa";
  if (low === "un" || low.startsWith("unidade")) return "Un";
  if (low === "sc" || low.startsWith("saco")) return "Saco";
  if (low === "bdj" || low.startsWith("band")) return "Bandeja";
  if (low === "pct" || low.startsWith("pacote")) return "Pct";
  if (low === "mç" || low.startsWith("maço") || low.startsWith("maco")) return "Maço";
  if (low === "kg" || low.startsWith("quilo")) return "kg";
  return u;
}

function HeroStat({
  kicker,
  item,
  empty,
  tone,
}: {
  kicker: string;
  item: { nome: string; codigo: string; unidade: string; qtd: number; vezes: number } | null;
  empty: string;
  tone: "in" | "out";
}) {
  return (
    <SpotlightCard className="px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{kicker}</p>
      {item ? (
        <div className="mt-1.5 flex items-center gap-2">
          <ProductIcon nome={item.nome} codigo={item.codigo} size="xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight">{item.nome}</p>
            <p className={cn("text-base font-semibold tabular-nums leading-tight", tone === "out" && "text-gold-ink")}>
              {formatNumber(item.qtd)} <span className="text-[10px] font-medium text-muted-foreground">{rankUnit(item.unidade)}</span>
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">{empty}</p>
      )}
    </SpotlightCard>
  );
}

function RankCard({
  title,
  rows,
  tone,
  empty,
}: {
  title: string;
  rows: { id: string; nome: string; codigo: string; unidade: string; qtd: number; vezes: number }[];
  tone: "in" | "out";
  empty: string;
}) {
  const max = rows[0]?.qtd || 1;
  return (
    <SpotlightCard className="p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {rows.slice(0, 8).map((r, i) => (
            <li key={r.id} className="flex items-center gap-2">
              <span className="w-3.5 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
              <ProductIcon nome={r.nome} codigo={r.codigo} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-medium leading-tight">{r.nome}</p>
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums leading-tight">
                    {formatNumber(r.qtd)} <span className="text-[10px] font-medium text-muted-foreground">{rankUnit(r.unidade)}</span>
                  </p>
                </div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", tone === "in" ? "bg-primary" : "bg-gold")}
                    style={{ width: `${Math.max(6, Math.round((r.qtd / max) * 100))}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </SpotlightCard>
  );
}

function MiniBar({ value, max, className, label }: { value: number; max: number; className: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", className)} style={{ width: `${Math.max(value ? 6 : 0, Math.round((value / max) * 100))}%` }} />
      </div>
      <span className="w-[4.6rem] shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{label}</span>
    </div>
  );
}

function FlowTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="tabular-nums text-muted-foreground">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-sm" style={{ background: p.color }} />
          {p.name}: {formatNumber(p.value)}
        </p>
      ))}
    </div>
  );
}
