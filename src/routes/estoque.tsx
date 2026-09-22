import { useCallback, useMemo, useState } from "react";
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
import { getDbGen, stockAlert } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { formatDateBR, formatNumber, todayISO } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Contagem, Mercadoria } from "@/lib/types";
import { pavTitle } from "@/lib/catalog";
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
import { ProductLabel } from "@/components/inventory/product-icon";
import { StockBadge } from "@/components/inventory/stock-badge";
import { PageStage } from "@/components/motion/page-stage";
import { useViewport } from "@/lib/use-viewport";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estoque")({ component: Estoque });

type Quick = "todos" | "baixo" | "critico" | "zero" | "falta" | "sobra" | "bateu";
type CountMark = { falta: number; sobra: number; counted: boolean };

function Estoque() {
  const db = useDb();
  const gen = getDbGen();
  const navigate = useNavigate();
  const { isAdmin, perfil } = useSession();
  const phone = useViewport() === "phone";
  const list = useMemo(() => db.listMercadorias(), [gen]);
  const pavilhoes = useMemo(() => db.listPavilhoes(), [gen]);
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState<Quick>("todos");
  const [pavFilter, setPavFilter] = useState<string>("todos");
  const [sorting, setSorting] = useState<SortingState>([{ id: "contagem", desc: false }]);
  const [page, setPage] = useState(0);
  const [confirmZero, setConfirmZero] = useState(false);
  const [zeroMode, setZeroMode] = useState<"all" | "day">("day");
  const [zeroDay, setZeroDay] = useState(todayISO());
  const [view, setView] = useState<"atual" | PeriodKey>("atual");
  const [day, setDay] = useState(todayISO());
  const [editStock, setEditStock] = useState<Mercadoria | null>(null);
  const [editPav, setEditPav] = useState("");
  const [editQty, setEditQty] = useState("");
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
  const lastByKey = useMemo(() => {
    const map = new Map<string, Contagem>();
    for (const c of db.listContagens()) {
      if (upto && c.data > upto) continue;
      const k = `${c.mercadoria_id}\t${c.pavilhao_id}`;
      if (!map.has(k)) map.set(k, c);
    }
    return map;
  }, [gen, upto]);

  const countMark = useCallback(
    (mercId: string): CountMark => {
      let falta = 0;
      let sobra = 0;
      let counted = false;
      const pavs = pavFilter === "todos" ? pavilhoes : pavilhoes.filter((p) => p.id === pavFilter);
      for (const p of pavs) {
        const c = lastByKey.get(`${mercId}\t${p.id}`);
        if (!c) continue;
        counted = true;
        if (c.delta < 0) falta += -c.delta;
        else if (c.delta > 0) sobra += c.delta;
      }
      return { falta, sobra, counted };
    },
    [lastByKey, pavFilter, pavilhoes],
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

  function positionsOf(id: string) {
    if (!upto) return db.stockPositions(id);
    const row = snapById.get(id);
    const qty = new Map((row?.positions ?? []).map((p) => [p.id, p.quantidade]));
    return pavilhoes.map((p) => ({ id: p.id, nome: pavTitle(p), quantidade: qty.get(p.id) || 0 }));
  }
  function qtyOf(id: string, pavId?: string) {
    if (!upto) return pavId ? db.stockAt(id, pavId) : (list.find((x) => x.id === id)?.estoque ?? 0);
    const row = snapById.get(id);
    if (!row) return 0;
    if (!pavId) return row.total;
    return row.positions.find((p) => p.id === pavId)?.quantidade ?? 0;
  }

  const data = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = list.filter((m) => {
      if (upto) {
        const had = (dayIds && dayIds.has(m.id)) || snapById.has(m.id);
        if (!had) return false;
      } else if (dayIds && !dayIds.has(m.id)) {
        return false;
      }
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
      const ra = countRank(countMark(a.id));
      const rb = countRank(countMark(b.id));
      if (ra !== rb) return ra - rb;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
    return rows;
  }, [list, q, quick, pavFilter, gen, dayIds, upto, snapById, lastByKey, countMark]);

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
          </button>
        ),
      },
      {
        accessorKey: "estoque",
        header: "Estoque",
        cell: ({ row }) => (
          <span className="tabular font-medium text-forest">
            {formatNumber(qtyOf(row.original.id))} {row.original.unidade}
          </span>
        ),
      },
      {
        id: "contagem",
        header: "Última contagem",
        accessorFn: (row) => countRank(countMark(row.id)),
        cell: ({ row }) => <CountMarkView {...countMark(row.original.id)} unidade={row.original.unidade} />,
      },
      {
        id: "pavilhoes",
        header: "Por pavilhão",
        enableSorting: false,
        cell: ({ row }) => {
          const pos = positionsOf(row.original.id).filter((p) => p.quantidade > 0);
          if (!pos.length) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <span className="text-xs tabular-nums text-muted-foreground">
              {pos.map((p) => `${p.nome.replace(/^Pavilhão |^Galpão |^Pav\. /, "")} ${formatNumber(p.quantidade)}`).join(" · ")}
            </span>
          );
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
    [gen, abrir, isAdmin, upto, snapById, pavilhoes, lastByKey, pavFilter, countMark],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const chips: { id: Quick; label: string; n: number }[] = [
    { id: "todos", label: "Todos", n: counts.todos },
    { id: "falta", label: "Em falta", n: countStats.falta },
    { id: "sobra", label: "Sobra", n: countStats.sobra },
    { id: "bateu", label: "Bateu", n: countStats.bateu },
    { id: "baixo", label: "Estoque baixo", n: counts.baixo },
    { id: "critico", label: "Crítico", n: counts.critico },
    { id: "zero", label: "Sem estoque", n: counts.zero },
  ];

  return (
    <PageStage className="space-y-4">
      <PageHeader icon="stock" title="Estoque" description="Toque no produto para abrir o perfil, o histórico e quanto tem em cada pavilhão.">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Baixar estoque do dia"
          onClick={() => exportEstoqueDiaPdf(upto)}
        >
          <Download />
          PDF
        </Button>
        {isAdmin ? (
          <Button variant="outline" onClick={() => setConfirmZero(true)}>
            <Trash2 /> Zerar estoque
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link to="/contagem">
            <ClipboardCheck /> Contagem
          </Link>
        </Button>
        <Button asChild>
          <Link to="/entradas">Registrar entrada</Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setView("atual");
            setPage(0);
          }}
          className={cn(
            "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium",
            view === "atual" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
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
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  : c.id === "sobra"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary bg-primary text-primary-foreground"
                : c.id === "falta" && c.n > 0
                  ? "border-destructive/25 bg-destructive/5 text-destructive hover:bg-destructive/10"
                  : c.id === "sobra" && c.n > 0
                    ? "border-primary/25 bg-mint text-primary hover:bg-mint/80"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {c.label}
            <span className="tabular">{c.n}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => {
            setPavFilter("todos");
            setPage(0);
          }}
          className={cn(
            "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium",
            pavFilter === "todos" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          Todos os lugares
        </button>
        {pavilhoes.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPavFilter(p.id);
              setPage(0);
            }}
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium",
              pavFilter === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {pavTitle(p)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="Filtrar por nome ou código"
                className="h-10 w-full rounded-lg border border-border bg-muted/50 pl-9 pr-3 text-sm outline-none focus:bg-card focus:ring-2 focus:ring-ring"
              />
            </div>
            <Badge variant="muted" className="hidden gap-1 sm:inline-flex">
              <SlidersHorizontal className="h-3 w-3" />
              {data.length} itens
            </Badge>
          </div>

          {list.length === 0 ? (
            <EmptyState
              icon={Package}
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
                  const mk = countMark(m.id);
                  return (
                    <li key={m.id} className={cn("flex items-center", countRowTone(mk))}>
                      <button type="button" onClick={() => abrir(m.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-muted">
                        <ProductLabel
                          nome={m.nome}
                          codigo={m.codigo}
                          className="flex-1"
                          extra={
                            positionsOf(m.id)
                              .filter((p) => p.quantidade > 0)
                              .map((p) => `${p.nome.replace(/^Pavilhão |^Galpão |^Pav\. /, "")} ${formatNumber(p.quantidade)}`)
                              .join(" · ") || undefined
                          }
                        />
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums leading-tight text-forest">
                            {formatNumber(pavFilter === "todos" ? qtyOf(m.id) : qtyOf(m.id, pavFilter))} {m.unidade}
                          </p>
                          <CountMarkView {...mk} unidade={m.unidade} compact />
                        </div>
                      </button>
                      {isAdmin ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Editar estoque"
                          onClick={() => {
                            const pos = positionsOf(m.id);
                            setEditStock(m);
                            setEditPav(pos.find((p) => p.quantidade > 0)?.id || pos[0]?.id || "");
                            setEditQty(String(pos.find((p) => p.quantidade > 0)?.quantidade ?? qtyOf(m.id)));
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
                          className={h.column.getCanSort() ? "cursor-pointer select-none" : undefined}
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getIsSorted() === "asc" ? " ↑" : h.column.getIsSorted() === "desc" ? " ↓" : ""}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => {
                    const mk = countMark(row.original.id);
                    return (
                      <TableRow
                        key={row.id}
                        className={cn("group cursor-pointer", countRowTone(mk))}
                        onClick={() => abrir(row.original.id)}
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
            <DialogDescription>O histórico permanece. Escolha se zera só um dia ou tudo da empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setZeroMode("day")}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left text-sm",
                  zeroMode === "day" ? "border-primary bg-mint" : "border-border hover:bg-muted",
                )}
              >
                <span className="font-medium">Só o estoque de um dia</span>
                <span className="mt-1 block text-xs text-muted-foreground">As entradas, saídas e contagens daquele dia deixam de contar no saldo.</span>
              </button>
              <button
                type="button"
                onClick={() => setZeroMode("all")}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left text-sm",
                  zeroMode === "all" ? "border-primary bg-mint" : "border-border hover:bg-muted",
                )}
              >
                <span className="font-medium">Todo o estoque da empresa</span>
                <span className="mt-1 block text-xs text-muted-foreground">Todas as quantidades voltam para 0. Não dá para desfazer.</span>
              </button>
            </div>
            {zeroMode === "day" ? (
              <div className="space-y-1.5">
                <Label htmlFor="zero-dia">Dia</Label>
                <Input id="zero-dia" type="date" value={zeroDay} onChange={(e) => setZeroDay(e.target.value)} />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmZero(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (zeroMode === "all") {
                  db.zeroAllStock();
                  toast.success("Todo o estoque foi zerado.");
                } else {
                  if (!zeroDay) return;
                  db.zeroStockDay(zeroDay);
                  toast.success("Estoque daquele dia foi zerado. O histórico continua visível.");
                }
                setConfirmZero(false);
              }}
            >
              Zerar
            </Button>
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
    </PageStage>
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
}: CountMark & {
  unidade: string;
  compact?: boolean;
}) {
  if (!counted) {
    return <span className="text-xs text-muted-foreground">Sem contagem</span>;
  }
  if (falta <= 0 && sobra <= 0) {
    return (
      <span className={cn("inline-flex items-center font-semibold text-forest", compact ? "text-xs" : "text-sm")}>
        Bateu
      </span>
    );
  }
  return (
    <span className={cn("flex flex-col font-semibold", compact ? "items-end gap-0.5" : "items-start gap-1")}>
      {falta > 0 ? (
        <span
          className={cn(
            "inline-flex items-baseline gap-1 rounded-full bg-destructive/10 font-bold text-destructive",
            compact ? "px-1.5 py-px text-xs" : "px-2.5 py-0.5 text-sm",
          )}
        >
          Falta
          <span className={cn("tabular-nums", compact ? "text-xs" : "text-base")}>{formatNumber(falta)}</span>
          {compact ? null : <span className="text-xs font-medium opacity-80">{unidade}</span>}
        </span>
      ) : null}
      {sobra > 0 ? (
        <span
          className={cn(
            "inline-flex items-baseline gap-1 rounded-full bg-mint font-bold text-primary",
            compact ? "px-1.5 py-px text-xs" : "px-2.5 py-0.5 text-sm",
          )}
        >
          Sobra
          <span className={cn("tabular-nums", compact ? "text-xs" : "text-base")}>{formatNumber(sobra)}</span>
          {compact ? null : <span className="text-xs font-medium opacity-80">{unidade}</span>}
        </span>
      ) : null}
    </span>
  );
}
