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
import { ArrowUpFromLine, ClipboardCheck, Package, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { stockAlert } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { formatNumber } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Mercadoria } from "@/lib/types";
import { pavTitle } from "@/lib/catalog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProductLabel } from "@/components/inventory/product-icon";
import { StockBadge } from "@/components/inventory/stock-badge";
import { PageStage } from "@/components/motion/page-stage";
import { useViewport } from "@/lib/use-viewport";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estoque")({ component: Estoque });

type Quick = "todos" | "baixo" | "critico" | "zero";

function Estoque() {
  const db = useDb();
  const navigate = useNavigate();
  const { isAdmin } = useSession();
  const phone = useViewport() === "phone";
  const list = useMemo(() => db.listMercadorias(), [db]);
  const pavilhoes = db.listPavilhoes();
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState<Quick>("todos");
  const [pavFilter, setPavFilter] = useState<string>("todos");
  const [sorting, setSorting] = useState<SortingState>([{ id: "nome", desc: false }]);
  const [page, setPage] = useState(0);
  const [confirmZero, setConfirmZero] = useState(false);
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

  const data = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter((m) => {
      const a = stockAlert(m);
      if (quick === "zero" && m.estoque > 0) return false;
      if (quick === "critico" && a !== "critico") return false;
      if (quick === "baixo" && a !== "baixo" && a !== "atencao") return false;
      if (pavFilter !== "todos" && db.stockAt(m.id, pavFilter) <= 0) return false;
      if (!term) return true;
      return m.nome.toLowerCase().includes(term) || m.codigo.toLowerCase().includes(term);
    });
  }, [list, q, quick, pavFilter, db]);

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
          <span className="tabular font-medium">
            {formatNumber(row.original.estoque)} {row.original.unidade}
          </span>
        ),
      },
      {
        id: "pavilhoes",
        header: "Por pavilhão",
        enableSorting: false,
        cell: ({ row }) => {
          const pos = db.stockPositions(row.original.id).filter((p) => p.quantidade > 0);
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
        header: "Status",
        accessorFn: (row) => stockAlert(row),
        cell: ({ row }) => <StockBadge alert={stockAlert(row.original)} />,
      },
      {
        id: "acoes",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
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
    [db, abrir],
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
    { id: "baixo", label: "Estoque baixo", n: counts.baixo },
    { id: "critico", label: "Crítico", n: counts.critico },
    { id: "zero", label: "Sem estoque", n: counts.zero },
  ];

  return (
    <PageStage className="space-y-4">
      <PageHeader icon="stock" title="Estoque" description="Toque no produto para abrir o perfil, o histórico e quanto tem em cada pavilhão.">
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
              quick === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
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
                {pageRows.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => abrir(m.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-muted">
                      <ProductLabel
                        nome={m.nome}
                        codigo={m.codigo}
                        className="flex-1"
                        extra={
                          db
                            .stockPositions(m.id)
                            .filter((p) => p.quantidade > 0)
                            .map((p) => `${p.nome.replace(/^Pavilhão |^Galpão |^Pav\. /, "")} ${formatNumber(p.quantidade)}`)
                            .join(" · ") || undefined
                        }
                      />
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums leading-tight">
                          {formatNumber(pavFilter === "todos" ? m.estoque : db.stockAt(m.id, pavFilter))} {m.unidade}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {pavFilter === "todos" ? "total" : pavTitle(pavilhoes.find((p) => p.id === pavFilter) ?? { codigo: "" })}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
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
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="group cursor-pointer" onClick={() => abrir(row.original.id)}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))}
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

      <ConfirmDialog
        open={confirmZero}
        onOpenChange={setConfirmZero}
        title="Zerar todo o estoque?"
        description="Isso coloca a quantidade de todos os produtos em 0. O histórico de entradas e saídas permanece, mas o estoque atual some. Essa ação não dá para desfazer."
        confirmLabel="Sim, zerar estoque"
        mark="store"
        onConfirm={() => {
          db.zeroAllStock();
          toast.success("Estoque zerado.");
        }}
      />
    </PageStage>
  );
}