import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpFromLine, ClipboardCheck, Download, Package, Pencil, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db, getDbGen, stockAlert } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { formatDateBR, formatDateTimeBR, formatNumber, isoDaysAgo, todayISO } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Contagem, Mercadoria } from "@/lib/types";
import { pavTitle } from "@/lib/catalog";
import { pavilhaoParaZerar } from "@/lib/zero-pav";
import { pinnedIds } from "@/lib/pins";
import { exportEstoqueDiaPdf } from "@/lib/reports";
import { PeriodFilter, periodRange, type PeriodKey } from "@/components/inventory/period-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProductIcon, ProductLabel } from "@/components/inventory/product-icon";
import { StockBadge } from "@/components/inventory/stock-badge";
import { PageStage } from "@/components/motion/page-stage";
import { ViewSwitch, useChartView } from "@/components/analytics/view-switch";
import { ScreenCharts } from "@/components/analytics/screen-charts";
import { useViewport } from "@/lib/use-viewport";
import { cn, fold } from "@/lib/utils";
import { useRowUpdates } from "@/lib/use-row-updates";

export const Route = createFileRoute("/estoque")({ component: Estoque });

type Quick = "todos" | "baixo" | "critico" | "zero" | "falta" | "sobra" | "bateu";
type CountMark = { falta: number; sobra: number; counted: boolean; ontem: number };

function Estoque() {
  const db = useDb();
  const gen = getDbGen();
  const navigate = useNavigate();
  const { isAdmin, perfil } = useSession();
  const [pinTick, setPinTick] = useState(0);
  useEffect(() => {
    const bump = () => setPinTick((n) => n + 1);
    window.addEventListener("jg-pins", bump);
    return () => window.removeEventListener("jg-pins", bump);
  }, []);
  useEffect(() => {
    if (!pinTick) return;
    setSorting([]);
    document.querySelector(".jg-main")?.scrollTo({ top: 0 });
  }, [pinTick]);
  const phone = useViewport() === "phone";
  const { vista } = useChartView("estoque");
  const list = useMemo(() => db.listMercadorias(), [gen]);
  const changed = useRowUpdates(list);
  const pavilhoes = useMemo(() => db.listPavilhoes(), [gen]);
  const stockSearchKey = `jg-estoque-busca:${perfil?.id || "local"}`;
  const [q, setQ] = useState(() => {
    try { return sessionStorage.getItem(stockSearchKey) || ""; } catch { return ""; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(stockSearchKey, q); } catch { /* quota */ }
  }, [q, stockSearchKey]);
  const [quick, setQuick] = useState<Quick>("todos");
  const [pavFilter, setPavFilter] = useState<string>("todos");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [confirmZero, setConfirmZero] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [zeroPav, setZeroPav] = useState("");
  const [autoPav, setAutoPav] = useState("");
  const [autoModo, setAutoModo] = useState<"todo_dia" | "dias">("todo_dia");
  const [autoDias, setAutoDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const autoRegras = useMemo(() => db.listAutoZeros().filter((r) => r.ativo), [gen]);
  const [view, setView] = useState<"atual" | PeriodKey>("atual");
  const [day, setDay] = useState(todayISO());
  const [editStock, setEditStock] = useState<Mercadoria | null>(null);
  const [editPav, setEditPav] = useState("");
  const [editQty, setEditQty] = useState("");
  const [fixMerc, setFixMerc] = useState<Mercadoria | null>(null);
  const [fixLines, setFixLines] = useState<{ id: string; pavId: string; pavNome: string; mode: "bateu" | "falta" | "sobra"; qtd: string }[]>([]);
  const [closeOpen, setCloseOpen] = useState(false);
  const pageSize = phone ? 16 : 20;

  const counts = useMemo(() => {
    let baixo = 0;
    let critico = 0;
    let zero = 0;
    for (const m of list) {
      const a = stockAlert(m);
      if (m.estoque <= 0) zero += 1;
      if (a === "critico") critico += 1;
      else if (a === "baixo" || a === "atencao") baixo += 1;
    }
    return { todos: list.length, baixo, critico, zero };
  }, [list]);

  const range = view === "atual" ? null : periodRange(view, day);
  const upto = range?.to;
  const snap = useMemo(() => (upto ? db.stockSnapshot(upto) : null), [gen, upto]);
  const snapById = useMemo(() => {
    const map = new Map<(NonNullable<typeof snap>)[number]["id"], NonNullable<typeof snap>[number]>();
    if (snap) for (const row of snap) map.set(row.id, row);
    return map;
  }, [snap]);
  const refDay = upto || todayISO();
  const prevDay = isoDaysAgo(1, refDay);
  const dayCounts = useMemo(() => {
    const hoje = new Map<string, Contagem>();
    const ontem = new Map<string, number>();
    for (const c of db.listContagens()) {
      const k = `${c.mercadoria_id}\t${c.pavilhao_id}`;
      if (c.data === refDay) {
        if (!hoje.has(k)) hoje.set(k, c);
        continue;
      }
      if (c.data <= prevDay && !ontem.has(k)) ontem.set(k, Number(c.contado) || 0);
    }
    return { hoje, ontem };
  }, [gen, refDay, prevDay]);

  const countMark = useCallback(
    (mercId: string): CountMark => {
      let falta = 0;
      let sobra = 0;
      let counted = false;
      let ontem = 0;
      const pavs = pavFilter === "todos" ? pavilhoes : pavilhoes.filter((p) => p.id === pavFilter);
      for (const p of pavs) {
        const key = `${mercId}\t${p.id}`;
        ontem += dayCounts.ontem.get(key) || 0;
        const c = dayCounts.hoje.get(key);
        if (!c) continue;
        counted = true;
        if (c.delta < 0) falta += -c.delta;
        else if (c.delta > 0) sobra += c.delta;
      }
      return { falta, sobra, counted, ontem };
    },
    [dayCounts, pavFilter, pavilhoes],
  );

  const countStats = useMemo(() => {
    let falta = 0;
    let sobra = 0;
    let bateu = 0;
    for (const m of list) {
      const mk = countMark(m.id);
      if (mk.falta > 0) falta += 1;
      if (mk.sobra > 0) sobra += 1;
      if (mk.counted && mk.falta <= 0 && mk.sobra <= 0) bateu += 1;
    }
    return { falta, sobra, bateu };
  }, [list, countMark]);
  const dayIds = useMemo(() => {
    if (!range) return null;
    const ids = new Set<string>();
    for (const s of db.listSaidas({ from: range.from, to: range.to })) ids.add(s.mercadoria_id);
    for (const c of db.listContagens()) {
      if (c.data >= range.from && c.data <= range.to) ids.add(c.mercadoria_id);
    }
    return ids;
  }, [gen, range?.from, range?.to]);

  function openFix(m: Mercadoria) {
    const lines = pavilhoes.flatMap((p) => {
      const c = dayCounts.hoje.get(`${m.id}\t${p.id}`);
      const tem = qtyOf(m.id, p.id) > 0;
      if (!c && !tem) return [];
      const mode = !c || c.delta === 0 ? "bateu" : c.delta < 0 ? "falta" : "sobra";
      return [{ id: c?.id || "", pavId: p.id, pavNome: pavTitle(p), mode: mode as "bateu" | "falta" | "sobra", qtd: !c || c.delta === 0 ? "" : String(Math.abs(c.delta)) }];
    });
    setFixMerc(m);
    setFixLines(lines);
  }

  function saveFix() {
    if (!fixMerc || !perfil) return;
    for (const line of fixLines) {
      const n = line.mode === "bateu" ? 0 : Number(String(line.qtd).replace(",", "."));
      if (line.mode !== "bateu" && (!Number.isFinite(n) || n <= 0)) {
        toast.error(`Informe a quantidade em ${line.pavNome}.`);
        return;
      }
      const delta = line.mode === "falta" ? -n : line.mode === "sobra" ? n : 0;
      if (line.id) {
        const atual = dayCounts.hoje.get(`${fixMerc.id}\t${line.pavId}`);
        if (atual && atual.delta === delta) continue;
        db.correctContagem(line.id, delta, perfil.id);
      } else if (delta !== 0) {
        const esperado = qtyOf(fixMerc.id, line.pavId);
        db.createContagem({
          mercadoria_id: fixMerc.id,
          pavilhao_id: line.pavId,
          contado: Math.max(0, esperado + delta),
          motivo: "ajuste",
          observacao: "Correção pela lista de estoque",
          usuario_id: perfil.id,
          contador: perfil.nome,
        });
      }
    }
    toast.success("Contagem corrigida.");
    setFixMerc(null);
  }

  function positionsOf(id: string) {
    const closed = Boolean(upto && upto < todayISO());
    if (!closed) return db.stockPositions(id);
    const row = snapById.get(id);
    const qty = new Map((row?.positions ?? []).map((p) => [p.id, p.quantidade]));
    return pavilhoes.map((p) => ({ id: p.id, nome: pavTitle(p), quantidade: qty.get(p.id) || 0 }));
  }
  function qtyOf(id: string, pavId?: string) {
    const closed = Boolean(upto && upto < todayISO());
    if (!closed) return pavId ? db.stockAt(id, pavId) : (list.find((x) => x.id === id)?.estoque ?? 0);
    const row = snapById.get(id);
    if (!row) return 0;
    if (!pavId) return row.total;
    return row.positions.find((p) => p.id === pavId)?.quantidade ?? 0;
  }

  const movedToday = useMemo(() => {
    const hoje = todayISO();
    const map = new Map<string, string>();
    const touch = (id: string, at: string) => {
      const prev = map.get(id);
      if (!prev || at > prev) map.set(id, at);
    };
    for (const s of db.listSaidas({ from: hoje, to: hoje })) touch(s.mercadoria_id, s.created_at || s.data);
    for (const c of db.listContagens()) {
      if (c.data === hoje) touch(c.mercadoria_id, c.created_at || c.data);
    }
    return map;
  }, [gen]);

  const data = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = list.filter((m) => {
      if (dayIds && !dayIds.has(m.id)) return false;
      const estoque = qtyOf(m.id);
      const a = stockAlert({ ...m, estoque });
      if (quick === "zero" && estoque > 0) return false;
      if (quick === "critico" && a !== "critico") return false;
      if (quick === "baixo" && a !== "baixo" && a !== "atencao") return false;
      if (quick === "falta" || quick === "sobra" || quick === "bateu") {
        const mk = countMark(m.id);
        if (quick === "falta" && mk.falta <= 0) return false;
        if (quick === "sobra" && mk.sobra <= 0) return false;
        if (quick === "bateu" && (!mk.counted || mk.falta > 0 || mk.sobra > 0)) return false;
      }
      if (pavFilter !== "todos" && qtyOf(m.id, pavFilter) <= 0 && quick !== "falta" && quick !== "sobra" && quick !== "bateu") return false;
      if (!term) return true;
      return m.nome.toLowerCase().includes(term) || m.codigo.toLowerCase().includes(term);
    });
    rows.sort((a, b) => {
      const ta = movedToday.get(a.id);
      const tb = movedToday.get(b.id);
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      if (ta && tb && ta !== tb) return tb.localeCompare(ta);
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
    return rows;
  }, [list, q, quick, pavFilter, gen, dayIds, upto, snapById, countMark, pinTick, perfil?.id, movedToday]);

  const pageCount = Math.max(1, Math.ceil(data.length / pageSize));
  const pageSafe = Math.min(page, pageCount - 1);
  const pageRows = phone ? data.slice(pageSafe * pageSize, pageSafe * pageSize + pageSize) : data;

  const abrir = useCallback(
    (id: string) => {
      void navigate({ to: "/produto/$id", params: { id } });
    },
    [navigate],
  );

  const columns = useMemo<ColumnDef<Mercadoria>[]>(
    () => [
      {
        accessorKey: "nome",
        header: "Produto",
        cell: ({ row }) => (
          <button type="button" className="text-left" onClick={() => abrir(row.original.id)}>
            <ProductLabel nome={row.original.nome} codigo={row.original.codigo} />
            {pinnedIds(perfil?.id).includes(row.original.id) ? (
              <span className="mt-0.5 inline-flex rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">Fixado</span>
            ) : null}
          </button>
        ),
      },
      {
        accessorKey: "estoque",
        header: "Estoque",
        cell: ({ row }) => {
          const total = qtyOf(row.original.id);
          return (
            <span data-part="qtd" data-qtd={String(total)} className="tabular-nums text-sm font-semibold text-foreground">
              {formatNumber(total)} {row.original.unidade}
            </span>
          );
        },
      },
      {
        id: "contagem",
        header: "Última contagem",
        accessorFn: (row) => countRank(countMark(row.id)),
        cell: ({ row }) => (
          <CountMarkView
            {...countMark(row.original.id)}
            unidade={row.original.unidade}
            onFix={() => openFix(row.original)}
          />
        ),
      },
      {
        id: "pavilhoes",
        header: "Onde está",
        enableSorting: false,
        cell: ({ row }) => {
          const pos = positionsOf(row.original.id).filter((p) => p.quantidade > 0);
          return <PlaceStock produtoId={row.original.id} pos={pos} unidade={row.original.unidade} />;
        },
      },
      {
        accessorKey: "minimo",
        header: "Mínimo",
        cell: ({ row }) => (
          <span className="tabular text-muted-foreground">
            {formatNumber(row.original.minimo)} {row.original.unidade}
          </span>
        ),
      },
      {
        id: "status",
        header: "Nível",
        accessorFn: (row) => stockAlert(row),
        cell: ({ row }) => <StockBadge alert={stockAlert({ ...row.original, estoque: qtyOf(row.original.id) })} />,
      },
      {
        id: "acoes",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
            {isAdmin ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const pos = positionsOf(row.original.id);
                  setEditStock(row.original);
                  setEditPav(pos.find((p) => p.quantidade > 0)?.id || pos[0]?.id || "");
                  setEditQty(String(pos.find((p) => p.quantidade > 0)?.quantidade ?? qtyOf(row.original.id)));
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
            ) : null}
            <Button asChild size="sm" variant="ghost">
              <Link to="/contagem" search={{ produto: row.original.id }}>
                Contar
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/nova-saida" search={{ produto: row.original.id }}>
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                Movimentar
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [gen, abrir, isAdmin, upto, snapById, pavilhoes, pavFilter, countMark],
  );

  const tableColumns = useMemo(
    () => (pavFilter === "todos" ? columns.filter((c) => c.id !== "contagem") : columns),
    [columns, pavFilter],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const chips: { id: Quick; label: string; n: number }[] = [
    { id: "todos", label: "Todos", n: dayIds ? list.filter((m) => dayIds.has(m.id)).length : counts.todos },
    ...(pavFilter === "todos"
      ? []
      : [
          { id: "falta" as const, label: "Em falta", n: countStats.falta },
          { id: "sobra" as const, label: "Sobra", n: countStats.sobra },
          { id: "bateu" as const, label: "Bateu", n: countStats.bateu },
        ]),
    { id: "baixo", label: "Estoque baixo", n: counts.baixo },
    { id: "critico", label: "Crítico", n: counts.critico },
    { id: "zero", label: "Sem estoque", n: counts.zero },
  ];

  const closeDay = view === "dia" ? day : todayISO();
  const dayClosed = db.diaFechado(closeDay);

  return (
    <PageStage className="space-y-4" data-vista={vista}>
      <PageHeader clip="/lottie/caixa.json" title="Estoque" description="Busque produtos e confira saldo, unidade, localização e situação.">
        <ViewSwitch page="estoque" />
        <Button
          className="hidden sm:inline-flex"
          variant="ghost"
          size="sm"
          aria-label="Baixar estoque do dia"
          onClick={() => exportEstoqueDiaPdf(upto)}
        >
          <Download />
          PDF
        </Button>
        {isAdmin ? (
          <>
            <Button
              className="hidden border-destructive/30 text-destructive hover:bg-destructive/5 sm:inline-flex"
              variant="outline"
              onClick={() => {
                setZeroPav("");
                setConfirmZero(true);
              }}
            >
              <Trash2 /> Zerar estoque
            </Button>
            {db.listStockBackups().length ? (
              <Button className="hidden sm:inline-flex" variant="outline" onClick={() => setRecoverOpen(true)}>
                Recuperar
              </Button>
            ) : null}
          </>
        ) : null}
        <Button variant="outline" onClick={() => setCloseOpen(true)}>
          {dayClosed ? "Abrir estoque" : "Fechar estoque"}
        </Button>
        <Button asChild variant="outline">
          <Link to="/contagem">
            <ClipboardCheck /> Contagem
          </Link>
        </Button>
        <Button asChild>
          <Link to="/entradas">Registrar entrada</Link>
        </Button>
      </PageHeader>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Filtrar por nome ou código"
              aria-label="Buscar no estoque por nome ou código"
              className="h-10 w-full rounded-lg border border-border bg-muted/40 pl-9 pr-3 text-sm outline-none focus:bg-card focus:ring-2 focus:ring-ring"
            />
          </div>
          <Badge variant="muted" className="hidden shrink-0 gap-1 sm:inline-flex">
            <SlidersHorizontal className="h-3 w-3" />
            {data.length} itens
          </Badge>
        </div>

        <button
          type="button"
          className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-border px-3 text-sm sm:hidden"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <span className="min-w-0 truncate text-left">
            {view === "atual" ? "Posição atual" : view === "hoje" ? "Hoje" : view === "dia" ? formatDateBR(day) : `${view} dias`}
            {" · "}
            {pavFilter === "todos" ? "Todos os lugares" : pavTitle(pavilhoes.find((p) => p.id === pavFilter) || { codigo: "" })}
            {" · "}
            {chips.find((c) => c.id === quick)?.label || "Todos"}
          </span>
          <span className="shrink-0 text-xs font-medium text-primary">{filtersOpen ? "Fechar" : "Filtros"}</span>
        </button>

        <div className={cn("grid gap-3 xl:grid-cols-2", "max-sm:hidden")}>
          <FilterGroup label="Período" flatten>
            <button
              type="button"
              onClick={() => {
                setView("atual");
                setPage(0);
              }}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium",
                view === "atual" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              Posição atual
            </button>
            <PeriodFilter
              value={view}
              day={day}
              onChange={(k, d) => {
                setView(k);
                setDay(d);
                setPage(0);
              }}
            />
          </FilterGroup>
          <FilterGroup label="Lugar">
            <button
              type="button"
              onClick={() => {
                setPavFilter("todos");
                setQuick((q) => (q === "falta" || q === "sobra" || q === "bateu" ? "todos" : q));
                setPage(0);
              }}
              className={cn(
                "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium",
                pavFilter === "todos" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              Todos os lugares
            </button>
            {pavilhoes.map((p) => {
              const title = pavTitle(p);
              const same = pavilhoes.filter((x) => pavTitle(x) === title).length > 1;
              return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPavFilter(p.id);
                  setPage(0);
                }}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium",
                  pavFilter === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {same ? `${title} · ${p.codigo}` : title}
              </button>
              );
            })}
          </FilterGroup>
        </div>

        <div className="max-sm:hidden">
        <FilterGroup label="Situação">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setQuick(c.id);
                setPage(0);
              }}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
                quick === c.id
                  ? c.id === "falta"
                    ? "border-destructive bg-destructive text-destructive-foreground"
                    : "border-primary bg-primary text-primary-foreground"
                  : c.id === "falta" && c.n > 0
                    ? "border-destructive/25 bg-destructive/5 text-destructive hover:bg-destructive/10"
                    : c.id === "sobra" && c.n > 0
                      ? "border-primary/25 bg-mint text-primary hover:bg-mint/80"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {c.label}
              <span className="tabular">{c.n}</span>
            </button>
          ))}
        </FilterGroup>
        </div>
        {filtersOpen ? (
          <div className="grid gap-2 sm:hidden">
            <select
              aria-label="Período"
              value={view}
              onChange={(e) => {
                const next = e.target.value as typeof view;
                setView(next);
                setPage(0);
              }}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="atual">Posição atual</option>
              <option value="hoje">Hoje</option>
              <option value="7">7 dias</option>
              <option value="15">15 dias</option>
              <option value="30">30 dias</option>
              <option value="dia">Um dia</option>
            </select>
            {view === "dia" ? (
              <input type="date" value={day} onChange={(e) => { setDay(e.target.value); setPage(0); }} className="h-10 rounded-xl border border-border bg-background px-3 text-sm" />
            ) : null}
            <select
              aria-label="Lugar"
              value={pavFilter}
              onChange={(e) => {
                const next = e.target.value;
                setPavFilter(next);
                if (next === "todos") setQuick((q) => (q === "falta" || q === "sobra" || q === "bateu" ? "todos" : q));
                setPage(0);
              }}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="todos">Todos os lugares</option>
              {pavilhoes.map((p) => {
                const title = pavTitle(p);
                const same = pavilhoes.filter((x) => pavTitle(x) === title).length > 1;
                return <option key={p.id} value={p.id}>{same ? `${title} · ${p.codigo}` : title}</option>;
              })}
            </select>
            <select
              aria-label="Situação"
              value={quick}
              onChange={(e) => { setQuick(e.target.value as Quick); setPage(0); }}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              {chips.map((c) => (
                <option key={c.id} value={c.id}>{c.label} ({c.n})</option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      {vista !== "lista" ? (
        <ScreenCharts screen="estoque" movs={[]} produtos={data} pavilhoes={pavilhoes} periodLabel={view === "atual" ? "Posição atual" : `Posição em ${day.split("-").reverse().join("/")}`} />
      ) : null}

      <Card className="jg-lista">
        <CardContent className="p-0">
          {list.length === 0 ? (
            <EmptyState
              icon={Package}
              clip="/lottie/caixa.json"
              title="Estoque vazio"
              description="Cadastre produtos e registre entradas para ver a posição."
            >
              <Button asChild>
                <Link to="/mercadorias">Cadastrar produto</Link>
              </Button>
            </EmptyState>
          ) : data.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto neste filtro"
              description="Tente limpar o filtro rápido ou o termo da busca."
            >
              <Button variant="outline" onClick={() => { setQuick("todos"); setPavFilter("todos"); setQ(""); }}>
                Limpar filtros
              </Button>
            </EmptyState>
          ) : phone ? (
            <>
              <ul className="divide-y divide-border">
                {pageRows.map((m) => {
                  const mk = pavFilter === "todos" ? null : countMark(m.id);
                  const lugares = positionsOf(m.id).filter((p) => p.quantidade > 0);
                  const qty = pavFilter === "todos" ? qtyOf(m.id) : qtyOf(m.id, pavFilter);
                  return (
                    <li key={m.id} className={cn("p-4", mk ? countRowTone(mk) : undefined, changed.has(m.id) && "row-updated")} data-ctx="produto" data-id={m.id} data-nome={m.nome} data-codigo={m.codigo}>
                      <button type="button" onClick={() => abrir(m.id)} className="flex w-full items-start gap-2.5 text-left">
                        <ProductIcon nome={m.nome} codigo={m.codigo} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium">{m.nome}</span>
                            <span className="shrink-0 text-base font-semibold tabular-nums text-foreground">{formatNumber(qty)} <span className="text-xs font-normal text-muted-foreground">{m.unidade}</span></span>
                          </span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">{m.codigo}</span>
                          <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                            {lugares.length ? lugares.map((p) => `${p.nome}: ${formatNumber(p.quantidade)}`).join(" · ") : "Sem saldo neste lugar"}
                          </span>
                        </span>
                      </button>
                      {mk ? (
                        <button type="button" className="mt-1 pl-11 text-left" onClick={() => openFix(m)}>
                          <CountMarkView {...mk} unidade={m.unidade} compact />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {pageCount > 1 ? (
                <div className="flex items-center justify-between border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
                  <span>
                    {pageSafe + 1} / {pageCount}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={pageSafe <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pageSafe >= pageCount - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((h) => (
                        <TableHead
                          key={h.id}
                          aria-sort={h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : undefined}
                        >
                          {h.column.getCanSort() ? <button type="button" className="flex min-h-11 items-center gap-2 text-left" onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}{h.column.getIsSorted() === "asc" ? " ↑" : h.column.getIsSorted() === "desc" ? " ↓" : " ↕"}</button> : flexRender(h.column.columnDef.header, h.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => {
                    const mk = pavFilter === "todos" ? null : countMark(row.original.id);
                    return (
                      <TableRow
                        key={row.id}
                        data-ctx="produto"
                        data-id={row.original.id}
                        data-nome={row.original.nome}
                        data-codigo={row.original.codigo}
                        className={cn("group cursor-pointer", mk ? countRowTone(mk) : undefined, changed.has(row.original.id) && "row-updated")}
                        tabIndex={0}
                        aria-label={`Abrir ${row.original.nome}`}
                        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrir(row.original.id); } }}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("[data-fix-count]")) return;
                          abrir(row.original.id);
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {table.getPageCount() > 1 ? (
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  <span>
                    Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                      Anterior
                    </Button>
                    <Button size="sm" variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                      Próxima
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmZero} onOpenChange={setConfirmZero}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zerar estoque</DialogTitle>
            <DialogDescription>Escolha um pavilhão. Só o estoque desse lugar vai para zero. Os outros permanecem como estão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="zero-pav">Selecione o pavilhão que deseja zerar</Label>
              <Select value={zeroPav || undefined} onValueChange={setZeroPav}>
                <SelectTrigger id="zero-pav">
                  <SelectValue placeholder="Selecione o pavilhão" />
                </SelectTrigger>
                <SelectContent>
                  {pavilhoes
                    .filter((p) => p.ativo !== false && !p.deleted_at)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.codigo}>
                        {pavTitle(p)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {zeroPav ? (
              <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Tem certeza de que deseja zerar todo o estoque do {pavilhoes.find((p) => p.codigo === zeroPav) ? pavTitle(pavilhoes.find((p) => p.codigo === zeroPav)!) : `Pavilhão ${zeroPav}`}?
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum estoque é zerado sem um pavilhão selecionado.</p>
            )}
            <div className="space-y-3 border-t border-border pt-3">
              <div>
                <p className="text-sm font-medium">Zeragem automática</p>
                <p className="text-xs text-muted-foreground">
                  O lugar escolhido zera sozinho depois da meia-noite. Os outros pavilhões não mudam. A primeira vez é na meia-noite seguinte, não na hora de salvar.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auto-pav">Lugar que zera sozinho</Label>
                <Select
                  value={autoPav || undefined}
                  onValueChange={(codigo) => {
                    setAutoPav(codigo);
                    const regra = db.listAutoZeros().find((r) => r.pavilhao_codigo === codigo && r.ativo);
                    if (!regra) return;
                    setAutoModo(regra.modo);
                    if (regra.modo === "dias") setAutoDias(regra.dias);
                  }}
                >
                  <SelectTrigger id="auto-pav">
                    <SelectValue placeholder="Selecione o pavilhão" />
                  </SelectTrigger>
                  <SelectContent>
                    {pavilhoes
                      .filter((p) => p.ativo !== false && !p.deleted_at)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.codigo}>
                          {pavTitle(p)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setAutoModo("todo_dia")}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm",
                    autoModo === "todo_dia" ? "border-primary bg-mint" : "border-border hover:bg-muted",
                  )}
                >
                  Todo dia após a meia-noite
                </button>
                <button
                  type="button"
                  onClick={() => setAutoModo("dias")}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm",
                    autoModo === "dias" ? "border-primary bg-mint" : "border-border hover:bg-muted",
                  )}
                >
                  Somente nos dias selecionados
                </button>
              </div>
              {autoModo === "dias" ? (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    [1, "Seg"],
                    [2, "Ter"],
                    [3, "Qua"],
                    [4, "Qui"],
                    [5, "Sex"],
                    [6, "Sáb"],
                    [0, "Dom"],
                  ].map(([n, label]) => {
                    const dia = Number(n);
                    const on = autoDias.includes(dia);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setAutoDias((curr) => (curr.includes(dia) ? curr.filter((d) => d !== dia) : [...curr, dia]))}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={!pavilhaoParaZerar(autoPav) || (autoModo === "dias" && autoDias.length === 0)}
                onClick={() => {
                  try {
                    const nome = db.saveAutoZero({ codigo: autoPav, modo: autoModo, dias: autoDias });
                    toast.success(`${nome} vai zerar sozinho depois da próxima meia-noite.`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
                  }
                }}
              >
                Salvar zeragem automática
              </Button>
              {autoRegras.length ? (
                <ul className="space-y-1.5">
                  {autoRegras.map((r) => {
                    const p = pavilhoes.find((x) => x.codigo === r.pavilhao_codigo);
                    const nome = p ? pavTitle(p) : `Pavilhão ${r.pavilhao_codigo}`;
                    const quando =
                      r.modo === "todo_dia"
                        ? "todo dia após a meia-noite"
                        : `somente ${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].filter((_, i) => r.dias.includes(i)).join(", ")}`;
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                        <p className="min-w-0 text-xs">
                          <span className="font-medium">{nome}</span>
                          <span className="text-muted-foreground"> · {quando}</span>
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            db.disableAutoZero(r.pavilhao_codigo);
                            toast.success(`Zeragem automática do ${nome} desligada.`);
                          }}
                        >
                          Desligar
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmZero(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!pavilhaoParaZerar(zeroPav)}
              onClick={() => {
                const code = pavilhaoParaZerar(zeroPav);
                if (!code) {
                  toast.error("Selecione o pavilhão antes de zerar.");
                  return;
                }
                void (async () => {
                  try {
                    const res = await fetch("/api/estoque/zerar", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ pavilhao: code }),
                    });
                    if (res.status === 400) {
                      toast.error("Pavilhão inválido. Nenhum estoque foi alterado.");
                      return;
                    }
                  } catch {
                    /* a validação local recusa zerar sem um pavilhão escolhido */
                  }
                  try {
                    const done = db.zeroPavilionStock(code, perfil?.id);
                    toast.success(
                      done.total
                        ? `Estoque do ${done.nome} zerado. ${done.total} produto(s). Os outros pavilhões não mudaram.`
                        : `${done.nome} já estava sem saldo. Os outros pavilhões não mudaram.`,
                    );
                    setConfirmZero(false);
                    setZeroPav("");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Não foi possível zerar.");
                  }
                })();
              }}
            >
              Confirmar e Zerar Estoque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recoverOpen} onOpenChange={setRecoverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar estoque</DialogTitle>
            <DialogDescription>Cada vez que alguém zera, o sistema guarda as quantidades de antes.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {db.listStockBackups().map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{b.mode === "day" ? `Dia ${b.date ? formatDateBR(b.date) : ""}` : "Estoque inteiro"}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.usuario_nome} · {formatDateTimeBR(b.created_at)}
                    {b.restored_at ? " · já recuperado" : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!b.restored_at}
                  onClick={() => {
                    db.restoreStockBackup(b.id);
                    toast.success("Estoque recuperado.");
                    setRecoverOpen(false);
                  }}
                >
                  Recuperar
                </Button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecoverOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fixMerc} onOpenChange={(o) => !o && setFixMerc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corrigir contagem</DialogTitle>
            <DialogDescription>
              {fixMerc ? `${fixMerc.codigo} · ${fixMerc.nome}` : ""} Marque se bateu, faltou ou sobrou. O estoque desse lugar acompanha a correção.
            </DialogDescription>
          </DialogHeader>
          {fixLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Esse produto não tem saldo nem contagem para corrigir.</p>
          ) : (
            <ul className="max-h-80 space-y-3 overflow-y-auto">
              {fixLines.map((line, i) => (
                <li key={`${line.pavId}-${line.id}`} className="space-y-2 rounded-xl border border-border p-3">
                  <p className="text-sm font-medium">{line.pavNome}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(["bateu", "falta", "sobra"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFixLines((rows) => rows.map((row, idx) => idx === i ? { ...row, mode } : row))}
                        className={cn("h-8 rounded-full border px-3 text-sm font-medium", line.mode === mode ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}
                      >
                        {mode === "bateu" ? "Bateu" : mode === "falta" ? "Falta" : "Sobra"}
                      </button>
                    ))}
                  </div>
                  {line.mode === "bateu" ? (
                    <p className="text-xs text-muted-foreground">A diferença sai. O número do lugar fica o que o sistema já tem.</p>
                  ) : (
                    <Input
                      inputMode="decimal"
                      value={line.qtd}
                      placeholder={line.mode === "falta" ? "Quantas faltam" : "Quantas sobram"}
                      onChange={(e) => setFixLines((rows) => rows.map((row, idx) => idx === i ? { ...row, qtd: e.target.value } : row))}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixMerc(null)}>Cancelar</Button>
            <Button onClick={saveFix} disabled={!fixLines.length}>Salvar correção</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editStock} onOpenChange={(o) => !o && setEditStock(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{upto ? `Editar estoque · ${formatDateBR(upto)}` : "Editar estoque"}</DialogTitle>
            <DialogDescription>Ajuste a quantidade neste pavilhão. Fica registrado quem editou.</DialogDescription>
          </DialogHeader>
          {editStock ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{editStock.codigo} · {editStock.nome}</p>
              <div className="space-y-1.5">
                <Label>Pavilhão</Label>
                <Select value={editPav} onValueChange={(id) => {
                  setEditPav(id);
                  setEditQty(String(qtyOf(editStock.id, id)));
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Lugar" />
                  </SelectTrigger>
                  <SelectContent>
                    {pavilhoes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {pavTitle(p)} · {formatNumber(qtyOf(editStock.id, p.id))} {editStock.unidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eq-stock">Quantidade neste lugar</Label>
                <Input id="eq-stock" type="number" min={0} step="0.01" value={editQty} onChange={(e) => setEditQty(e.target.value)} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStock(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!editStock || !perfil || !editPav) return;
                const n = Number(editQty);
                if (!Number.isFinite(n) || n < 0) {
                  toast.error("Informe uma quantidade válida.");
                  return;
                }
                db.createContagem({
                  mercadoria_id: editStock.id,
                  pavilhao_id: editPav,
                  contado: n,
                  motivo: "ajuste",
                  observacao: upto ? `Ajuste do estoque em ${formatDateBR(upto)}` : "Ajuste pela tela de estoque",
                  usuario_id: perfil.id,
                  contador: perfil.nome,
                  data: upto,
                });
                toast.success("Estoque atualizado.");
                setEditStock(null);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {closeOpen ? <FecharEstoqueDialog initialDay={closeDay} onClose={() => setCloseOpen(false)} /> : null}
    </PageStage>
  );
}

function PlaceStock({ pos, unidade, produtoId }: { pos: { id: string; nome: string; quantidade: number }[]; unidade: string; produtoId?: string }) {
  if (!pos.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <ul className="min-w-[12.5rem] space-y-0.5">
      {pos.map((p) => (
        <li
          key={p.id}
          data-ctx="pavilhao"
          data-id={p.id}
          data-nome={p.nome}
          data-part="pav"
          data-produto={produtoId || ""}
          className="flex items-baseline justify-between gap-3 text-xs"
        >
          <span className="min-w-0 truncate text-muted-foreground">{p.nome}</span>
          <span className="shrink-0 tabular-nums font-semibold text-foreground">
            {formatNumber(p.quantidade)} {unidade}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FecharEstoqueDialog({ initialDay, onClose }: { initialDay: string; onClose: () => void }) {
  const [day, setDay] = useState(initialDay);
  const [q, setQ] = useState("");
  const [fechado, setFechado] = useState(false);
  const [lines, setLines] = useState<{ mercadoriaId: string; pavilhaoId: string; qtd: string }[]>([]);
  const produtos = db.listMercadorias();
  const lugares = db.listPavilhoes();

  useEffect(() => {
    const got = db.linhasFechamento(day);
    setFechado(got.fechado);
    setLines(got.linhas.map((l) => ({ mercadoriaId: l.mercadoriaId, pavilhaoId: l.pavilhaoId, qtd: String(l.quantidade) })));
  }, [day]);

  function qtyAt(mercadoriaId: string, pavilhaoId: string) {
    return lines.find((l) => l.mercadoriaId === mercadoriaId && l.pavilhaoId === pavilhaoId)?.qtd ?? "";
  }

  function setQty(mercadoriaId: string, pavilhaoId: string, qtd: string) {
    setLines((prev) => {
      const next = prev.filter((l) => !(l.mercadoriaId === mercadoriaId && l.pavilhaoId === pavilhaoId));
      if (qtd.trim()) next.push({ mercadoriaId, pavilhaoId, qtd });
      return next;
    });
  }

  const term = fold(q.trim());
  const withQty = new Set(lines.filter((l) => Number(String(l.qtd).replace(",", ".")) > 0).map((l) => l.mercadoriaId));
  const shown = produtos.filter((m) => withQty.has(m.id) || (term && fold(`${m.nome} ${m.codigo}`).includes(term))).slice(0, 40);

  function save() {
    try {
      db.salvarFechamento(
        day,
        lines.map((l) => ({ mercadoriaId: l.mercadoriaId, pavilhaoId: l.pavilhaoId, quantidade: Number(String(l.qtd).replace(",", ".")) })),
      );
      setFechado(true);
      toast.success(day < todayISO() ? "Estoque fechado. O físico de hoje já usa este saldo." : "Estoque fechado. O dia seguinte começa por este saldo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível fechar.");
    }
  }

  function reopen() {
    try {
      db.reabrirFechamento(day);
      const got = db.linhasFechamento(day);
      setFechado(got.fechado);
      setLines(got.linhas.map((l) => ({ mercadoriaId: l.mercadoriaId, pavilhaoId: l.pavilhaoId, qtd: String(l.quantidade) })));
      toast.success("Estoque aberto. Corrija o saldo. O físico de hoje só muda quando você fechar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir.");
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fechado ? "Estoque fechado" : "Estoque aberto"}</DialogTitle>
          <DialogDescription>
            Abra o dia, corrija a quantidade e feche. O físico de hoje só muda nesse fechamento: passa a ser esse saldo, mais o que entrou e saiu hoje.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <input type="date" max={todayISO()} value={day} onChange={(e) => setDay(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm" />
          <span className="text-xs font-medium text-muted-foreground">{fechado ? "Fechado" : "Aberto"} · {formatDateBR(day)}</span>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" className="h-10 w-full rounded-xl border border-border px-3 text-sm" />
        <ul className="max-h-[46vh] space-y-3 overflow-y-auto">
          {shown.map((m) => {
            const places = term && fold(`${m.nome} ${m.codigo}`).includes(term)
              ? lugares
              : lugares.filter((p) => Number(String(qtyAt(m.id, p.id)).replace(",", ".")) > 0);
            return (
              <li key={m.id} className="rounded-xl border border-border p-2">
                <p className="text-sm font-medium">{m.nome}</p>
                <p className="font-mono text-xs text-muted-foreground">{m.codigo}</p>
                <div className="mt-1 space-y-1">
                  {places.map((p) => (
                    <label key={p.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-muted-foreground">{pavTitle(p)}</span>
                      <input
                        inputMode="decimal"
                        disabled={fechado}
                        value={qtyAt(m.id, p.id)}
                        onChange={(e) => setQty(m.id, p.id, e.target.value)}
                        className="h-9 w-28 rounded-lg border border-border px-2 text-right tabular-nums disabled:opacity-70"
                      />
                    </label>
                  ))}
                </div>
              </li>
            );
          })}
          {shown.length === 0 ? <li className="text-sm text-muted-foreground">Nenhum produto neste dia. Busque o nome para incluir.</li> : null}
        </ul>
        <DialogFooter>
          <Button variant="outline" disabled={!fechado || day > todayISO()} onClick={reopen}>Abrir estoque</Button>
          <Button disabled={fechado} onClick={save}>Salvar e fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterGroup({ label, children, flatten }: { label: string; children: ReactNode; flatten?: boolean }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className={cn("flex flex-wrap items-center gap-1.5", flatten && "[&>div]:contents")}>{children}</div>
    </div>
  );
}

function countRank(mk: CountMark) {
  if (mk.falta > 0) return -1_000_000 - mk.falta;
  if (mk.sobra > 0) return -500_000 + mk.sobra;
  if (mk.counted) return 0;
  return 1;
}

function countRowTone(mk: CountMark) {
  if (mk.falta > 0) return "bg-destructive/5";
  if (mk.sobra > 0) return "bg-mint/80";
  return undefined;
}

function CountMarkView({
  falta,
  sobra,
  counted,
  unidade,
  compact,
  onFix,
}: CountMark & {
  unidade: string;
  compact?: boolean;
  onFix?: () => void;
}) {
  const body = !counted ? (
    <span className="text-xs text-muted-foreground">Não contado hoje</span>
  ) : falta <= 0 && sobra <= 0 ? (
    <span className={cn("inline-flex items-center font-semibold text-forest", compact ? "text-xs" : "text-sm")}>Bateu</span>
  ) : (
    <span className={cn("flex flex-col font-semibold", compact ? "items-end gap-0.5" : "items-start gap-1")}>
      {falta > 0 ? (
        <span className={cn("inline-flex items-baseline gap-1 rounded-full bg-destructive/10 font-bold text-destructive", compact ? "px-1.5 py-px text-xs" : "px-2.5 py-0.5 text-sm")}>
          Falta
          <span className={cn("tabular-nums", compact ? "text-xs" : "text-base")}>{formatNumber(falta)}</span>
          {compact ? null : <span className="text-xs font-medium opacity-80">{unidade}</span>}
        </span>
      ) : null}
      {sobra > 0 ? (
        <span className={cn("inline-flex items-baseline gap-1 rounded-full bg-mint font-bold text-primary", compact ? "px-1.5 py-px text-xs" : "px-2.5 py-0.5 text-sm")}>
          Sobra
          <span className={cn("tabular-nums", compact ? "text-xs" : "text-base")}>{formatNumber(sobra)}</span>
          {compact ? null : <span className="text-xs font-medium opacity-80">{unidade}</span>}
        </span>
      ) : null}
    </span>
  );
  if (!onFix) return body;
  return (
    <button type="button" data-fix-count="true" onClick={(e) => { e.stopPropagation(); onFix(); }} className="rounded-lg text-left hover:opacity-80">
      {body}
    </button>
  );
}
