import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bookmark,
  FileText,
  Hash,
  LogOut,
  MapPin,
  Moon,
  Package,
  Search,
  Store,
  Truck,
  TriangleAlert,
  User,
} from "lucide-react";
import { globalSearch, type SearchHit } from "@/lib/search";
import { db } from "@/lib/store";
import { formatNumber } from "@/lib/format";
import { toggleUserTheme } from "@/lib/ui-prefs";
import { useSession } from "@/lib/session";
import { ProductIcon } from "@/components/inventory/product-icon";
import { AtalhoDialog } from "@/components/search/atalho-dialog";
import { cn } from "@/lib/utils";
import { Glyph } from "@/components/brand/glyph";
import { moduleForPath, moduleStyle } from "@/lib/modules";

const ICONS: Record<SearchHit["kind"], typeof Package> = {
  pagina: FileText,
  acao: Hash,
  produto: Package,
  lote: Hash,
  destino: MapPin,
  fornecedor: Truck,
  pavilhao: Store,
  alerta: TriangleAlert,
  comando: Hash,
  movimento: ArrowUpFromLine,
  usuario: User,
};

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { signOut } = useSession();
  const [q, setQ] = useState("");
  const [atalhoOpen, setAtalhoOpen] = useState(false);
  const hits = useMemo(() => globalSearch(q), [q, open]);
  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      const list = map.get(hit.group) ?? [];
      list.push(hit);
      map.set(hit.group, list);
    }
    return [...map.entries()];
  }, [hits]);
  const featured = hits.find((h) => h.kind === "produto" && (h.positions?.length || (h.total ?? 0) >= 0) && q.trim().length >= 2) ?? null;

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function goProduto(to: "/entradas" | "/nova-saida" | "/contagem", produtoId: string) {
    onOpenChange(false);
    void navigate({ to, search: { produto: produtoId } });
  }

  function run(hit: SearchHit) {
    if (hit.run === "theme") {
      toggleUserTheme();
      onOpenChange(false);
      return;
    }
    if (hit.run === "logout") {
      signOut();
      onOpenChange(false);
      return;
    }
    if (hit.run === "atalho") {
      onOpenChange(false);
      setAtalhoOpen(true);
      return;
    }
    if (hit.atalhoId) {
      db.touchAtalho(hit.atalhoId);
      onOpenChange(false);
      void navigate({ to: hit.to, search: hit.search } as never);
      return;
    }
    const produtoId = featured?.id ?? hits.find((h) => h.kind === "produto")?.id;
    if (produtoId && (hit.to === "/entradas" || hit.to === "/nova-saida" || hit.to === "/contagem")) {
      goProduto(hit.to, produtoId);
      return;
    }
    if (hit.kind === "pavilhao") {
      onOpenChange(false);
      void navigate({ to: "/contagem", search: { pav: hit.id } });
      return;
    }
    if (hit.kind === "produto" || (hit.kind === "alerta" && hit.codigo)) {
      onOpenChange(false);
      void navigate({ to: "/produto/$id", params: { id: hit.id } });
      return;
    }
    if (hit.kind === "destino") {
      onOpenChange(false);
      void navigate({ to: "/clientes/$id", params: { id: hit.id } });
      return;
    }
    onOpenChange(false);
    void navigate({ to: hit.to });
  }

  return (
    <>
      <Command.Dialog
        open={open}
        onOpenChange={onOpenChange}
        label="Busca"
        overlayClassName="fixed inset-0 z-[70] bg-forest/40"
        contentClassName="fixed left-1/2 top-3 z-[71] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 sm:top-[10vh]"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-card"
        shouldFilter={false}
        loop
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Command.Input
            value={q}
            onValueChange={setQ}
            placeholder="Produto, código, pavilhão, página ou ação…"
            aria-label="Buscar produto, código, pavilhão, página ou ação"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">ESC</kbd>
        </div>
        <Command.List className="max-h-[min(70vh,32rem)] overflow-y-auto p-1">
          <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nada encontrado. Tente o nome, o código ou uma ação.
          </Command.Empty>
          {featured ? (
            <div className="m-1 mb-2 rounded-xl border border-border bg-muted/50 p-3">
              <div className="flex items-start gap-3">
                <ProductIcon nome={featured.title} codigo={featured.codigo} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-bold tabular-nums">{featured.codigo}</p>
                  <p className="font-normal leading-tight">{featured.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold tabular-nums leading-none">{formatNumber(featured.total ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">{featured.unidade ?? "un"} no total</p>
                </div>
              </div>
              {featured.positions && featured.positions.length > 0 ? (
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {featured.positions.map((p) => (
                    <li key={p.nome} className="flex items-center justify-between rounded-lg bg-card px-2.5 py-1.5 text-xs">
                      <span className="truncate text-muted-foreground">{p.nome}</span>
                      <span className="tabular-nums font-medium">
                        {formatNumber(p.quantidade)} {featured.unidade}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Sem saldo por pavilhão ainda. Lance uma entrada para posicionar.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
                  onClick={() => {
                    onOpenChange(false);
                    void navigate({ to: "/produto/$id", params: { id: featured.id } });
                  }}
                >
                  Ver perfil
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium"
                  onClick={() => goProduto("/entradas", featured.id)}
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" /> Entrada
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium"
                  onClick={() => goProduto("/nova-saida", featured.id)}
                >
                  <ArrowUpFromLine className="h-3.5 w-3.5" /> Saída
                </button>
              </div>
            </div>
          ) : null}
          {grouped.map(([group, items]) => (
            <Command.Group key={group} heading={group} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground">
              {items.map((hit) => {
                const Icon =
                  hit.run === "theme"
                    ? Moon
                    : hit.run === "logout"
                      ? LogOut
                      : hit.run === "atalho" || hit.atalhoId
                        ? Bookmark
                      : hit.kind === "acao" && hit.to === "/entradas"
                        ? ArrowDownToLine
                        : hit.kind === "acao" && hit.to === "/nova-saida"
                          ? ArrowUpFromLine
                          : ICONS[hit.kind];
                return (
                  <Command.Item
                    key={`${hit.kind}-${hit.id}`}
                    value={`${hit.kind}-${hit.id}-${hit.title}`}
                    onSelect={() => run(hit)}
                    className={cn(
                      "cmd-item glyph-host flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                      "data-[selected=true]:bg-muted",
                    )}
                  >
                    {hit.kind === "produto" || hit.kind === "alerta" ? (
                      <ProductIcon nome={hit.title} size="sm" />
                    ) : (hit.kind === "pagina" || hit.kind === "acao") && hit.to && !hit.run ? (
                      <span className="cmd-glyph" data-module={moduleForPath(hit.to)} style={moduleStyle(moduleForPath(hit.to))}>
                        <Glyph name={moduleForPath(hit.to)} />
                      </span>
                    ) : (
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      {hit.kind === "produto" || hit.kind === "alerta" ? (
                        <>
                          <span className="block truncate font-mono text-xs font-bold tabular-nums">{hit.codigo}</span>
                          <span className="block truncate font-normal">{hit.title}</span>
                          {hit.total != null ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {formatNumber(hit.total)} {hit.unidade ?? ""}
                              {hit.positions?.length ? ` · ${hit.positions.map((p) => `${formatNumber(p.quantidade)} ${p.nome}`).join(" · ")}` : ""}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <span className="block truncate font-medium">{hit.title}</span>
                          {hit.hint ? <span className="block truncate text-xs text-muted-foreground">{hit.hint}</span> : null}
                        </>
                      )}
                    </span>
                    {hit.kind === "produto" && hit.total != null ? (
                      <span className="shrink-0 tabular-nums text-xs font-medium">{formatNumber(hit.total)}</span>
                    ) : null}
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
      </Command.Dialog>
    <AtalhoDialog open={atalhoOpen} onOpenChange={setAtalhoOpen} />
    </>
  );
}
