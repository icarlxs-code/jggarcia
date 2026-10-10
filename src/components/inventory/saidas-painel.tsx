import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, FileText, Search, X } from "lucide-react";
import { formatDateBR, formatNumber, formatTime, completeTime, isValidTime, isoDaysAgo, todayISO } from "@/lib/format";
import { pavTitle } from "@/lib/catalog";
import {
  agruparMercadoria,
  agruparPavilhao,
  filtrarSaidas,
  linhaDeSaida,
  mercadoriaCombina,
  pesquisaRapida,
  resumoFamilia,
  totais,
  type FiltroSaidas,
  type SaidaLinha,
} from "@/lib/saidas-consulta";
import { exportarExcelSaidas, exportarPdfSaidas } from "@/lib/saidas-export";
import { useDb } from "@/lib/use-db";
import { db, getDbGen } from "@/lib/store";
import { notify } from "@/lib/notify";
import { OpNote } from "@/components/motion/lottie-clip";
import { ViewSwitch, useChartView } from "@/components/analytics/view-switch";
import { ScreenCharts } from "@/components/analytics/screen-charts";
import type { Destino, Mercadoria, Pavilhao, Saida, Usuario } from "@/lib/types";
import { cn, fold } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "@/components/ui/action-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ProductIcon } from "@/components/inventory/product-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TimeField } from "@/components/ui/time-field";
import { CountUp } from "@/components/motion/count-up";
import { useRowUpdates } from "@/lib/use-row-updates";
import { useViewport } from "@/lib/use-viewport";

function filterKey() { return `jg-saidas-filtros:${db.getSessionUser()?.id || "local"}`; }

function savedFilter(): FiltroSaidas {
  const defaults = vazio();
  try {
    const saved = JSON.parse(sessionStorage.getItem(filterKey()) || "null");
    if (!saved || typeof saved !== "object") return defaults;
    for (const key of Object.keys(defaults) as (keyof FiltroSaidas)[]) {
      if (typeof saved[key] === "string") defaults[key] = saved[key];
    }
  } catch { /* filtros opcionais não impedem a consulta */ }
  return defaults;
}

const vazio = (): FiltroSaidas => ({
  de: todayISO(),
  ate: "",
  pav: "",
  mercadoriaId: "",
  mercadoria: "",
  destino: "",
  cliente: "",
  usuario: "",
});

function rotuloMercadoria(m: { codigo: string; nome: string }) {
  return `${m.codigo} — ${m.nome}`;
}

function num(n: number | null) {
  return n == null ? "—" : formatNumber(n);
}

function formula(g: { pallets: number | null; porPallet: number | null; total: number; unidade: string }) {
  if (g.pallets != null && g.porPallet != null) {
    return `${formatNumber(g.pallets)} × ${formatNumber(g.porPallet)} = ${formatNumber(g.total)} ${g.unidade}`;
  }
  return `${formatNumber(g.total)} ${g.unidade}`;
}

export function SaidasPainel({
  saidas,
  pavilhoes,
  destinos,
  usuarios,
  onOpen,
  onEdit,
  onDelete,
}: {
  saidas: Saida[];
  pavilhoes: Pavilhao[];
  destinos: Destino[];
  usuarios: Usuario[];
  onOpen: (s: Saida) => void;
  onEdit: (s: Saida) => void;
  onDelete: (s: Saida) => void;
}) {
  const [draft, setDraft] = useState<FiltroSaidas>(savedFilter);
  const [filtro, setFiltro] = useState<FiltroSaidas>(savedFilter);
  const [q, setQ] = useState("");
  const [grupo, setGrupo] = useState<"lista" | "mercadoria" | "pavilhao">("lista");
  const [detalhe, setDetalhe] = useState<{ titulo: string; linhas: SaidaLinha[] } | null>(null);
  const [chegada, setChegada] = useState<Saida | null>(null);
  const [horaChegada, setHoraChegada] = useState("");
  const { vista } = useChartView("saidas");
  const phone = useViewport() === "phone";
  const [filtersOpen, setFiltersOpen] = useState(false);

  const live = useDb();
  const gen = getDbGen();
  const catalogo = useMemo(
    () => live.listMercadorias().slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.codigo.localeCompare(b.codigo)),
    [live, gen],
  );
  const porId = useMemo(() => new Map(catalogo.map((m) => [m.id, m])), [catalogo]);
  const linhas = useMemo(() => saidas.map((s) => linhaDeSaida(s, pavilhoes, destinos, usuarios)), [saidas, pavilhoes, destinos, usuarios]);
  const visiveis = useMemo(() => pesquisaRapida(filtrarSaidas(linhas, filtro), q), [linhas, filtro, q]);
  const soma = totais(visiveis);
  const changed = useRowUpdates(saidas);
  const volumes = useMemo(() => {
    const units = new Map<string, number>();
    for (const row of visiveis) units.set(row.unidade, (units.get(row.unidade) || 0) + row.total);
    return [...units].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [visiveis]);

  useEffect(() => {
    try { sessionStorage.setItem(filterKey(), JSON.stringify(filtro)); } catch { /* quota */ }
  }, [filtro]);
  const porMercadoria = useMemo(() => agruparMercadoria(visiveis), [visiveis]);
  const porPavilhao = useMemo(() => agruparPavilhao(visiveis), [visiveis]);
  const familia = resumoFamilia(visiveis, q.trim());
  const pavNome = pavilhoes.find((p) => p.id === filtro.pav)?.nome ? pavTitle(pavilhoes.find((p) => p.id === filtro.pav)!) : filtro.pav ? filtro.pav : "Todos";
  const mercLabel = filtro.mercadoria.trim() || q.trim() || "Todas";

  function set<K extends keyof FiltroSaidas>(key: K, value: FiltroSaidas[K]) {
    setDraft((f) => ({ ...f, [key]: value }));
  }

  function limpar() {
    const next = vazio();
    setDraft(next);
    setFiltro(next);
    setQ("");
    setGrupo("lista");
  }

  function meta() {
    return {
      filtro,
      pavilhao: filtro.pav ? pavNome : "Todos",
      mercadoria: filtro.mercadoria.trim(),
      busca: q.trim(),
    };
  }

  function abrirGrupo(titulo: string, rows: SaidaLinha[]) {
    setDetalhe({ titulo, linhas: rows });
  }

  function abrirChegada(s: Saida) {
    setChegada(s);
    setHoraChegada((s.hora_chegada || "").slice(0, 5));
  }

  function salvarChegada() {
    if (!chegada) return;
    const hc = completeTime(horaChegada);
    if (!isValidTime(hc)) {
      notify.error("Informe o horário de chegada no formato HH:MM, tipo 14:45.");
      return;
    }
    try {
      db.markChegada(chegada.id, hc);
      notify.success("Horário de chegada registrado. O restante do lançamento não mudou.");
      setChegada(null);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível registrar a chegada.");
    }
  }

  return (
    <div className="space-y-3" data-vista={vista}>
      <div className="flex justify-end">
        <ViewSwitch page="saidas" />
      </div>
      <section aria-label="Filtros de saídas" className="relative z-20 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <details open={!phone || filtersOpen} onToggle={(e) => { if (phone) setFiltersOpen(e.currentTarget.open); }}>
          <summary className={cn("min-h-11 cursor-pointer items-center text-sm font-semibold", phone ? "flex" : "hidden")}>Filtros e exportações · {formatDateBR(filtro.de)}</summary>
          <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Select value={["hoje", "7", "15", "30"].find((id) => filtro.de === (id === "hoje" ? todayISO() : isoDaysAgo(Number(id) - 1)) && (filtro.ate === todayISO() || (id === "hoje" && !filtro.ate))) ?? "custom"} onValueChange={(id) => {
          if (id === "custom") return;
          const ate = todayISO(); const de = id === "hoje" ? ate : isoDaysAgo(Number(id) - 1);
          setDraft((f) => ({ ...f, de, ate })); setFiltro((f) => ({ ...f, de, ate }));
        }}>
          <SelectTrigger className="w-44" aria-label="Período rápido"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="hoje">Hoje</SelectItem><SelectItem value="7">7 dias</SelectItem><SelectItem value="15">15 dias</SelectItem><SelectItem value="30">30 dias</SelectItem><SelectItem value="custom">Personalizado</SelectItem></SelectContent>
        </Select>
        <Campo label="Data inicial" className="w-40">
          <Input
            type="date"
            value={filtro.de}
            onChange={(e) => {
              const de = e.target.value;
              setDraft((f) => ({ ...f, de }));
              setFiltro((f) => ({ ...f, de }));
            }}
          />
        </Campo>
        <Campo label="Data final" className="w-40">
          <Input
            type="date"
            value={filtro.ate}
            onChange={(e) => {
              const ate = e.target.value;
              setDraft((f) => ({ ...f, ate }));
              setFiltro((f) => ({ ...f, ate }));
            }}
          />
        </Campo>
        <BuscaMercadoria
          catalogo={catalogo}
          linhas={linhas}
          value={q}
          onChange={setQ}
        />
        <Select value={grupo} onValueChange={(value) => setGrupo(value as typeof grupo)}>
          <SelectTrigger className="w-52" aria-label="Agrupar saídas"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="lista">Sem agrupamento</SelectItem><SelectItem value="mercadoria">Por mercadoria</SelectItem><SelectItem value="pavilhao">Por pavilhão</SelectItem></SelectContent>
        </Select>
        <ActionMenu label="Exportar">
          <DropdownMenuItem onSelect={() => exportarPdfSaidas(visiveis, meta())}><FileText />PDF e impressão</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exportarExcelSaidas(visiveis, meta())}><Download />Excel</DropdownMenuItem>
        </ActionMenu>
      </div>
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-semibold">Filtros detalhados · origem, produto, destino e responsável</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-12">
          <Campo label="Pavilhão / galpão de origem" className="xl:col-span-6">
            <Select value={draft.pav || "todos"} onValueChange={(v) => set("pav", v === "todos" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {pavilhoes
                  .filter((p) => p.ativo !== false && !p.deleted_at)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {pavTitle(p)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Mercadoria / produto" className="xl:col-span-6">
            <MercadoriaFiltro
              items={catalogo}
              valueId={draft.mercadoriaId}
              onChange={(id, label) => setDraft((f) => ({ ...f, mercadoriaId: id, mercadoria: label }))}
            />
          </Campo>
          <Campo label="Destino" className="xl:col-span-4">
            <Select value={draft.destino || "todos"} onValueChange={(v) => set("destino", v === "todos" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {destinos.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
                {pavilhoes
                  .filter((p) => p.ativo !== false && !p.deleted_at)
                  .map((p) => (
                    <SelectItem key={`d-${p.id}`} value={p.id}>
                      {pavTitle(p)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Cliente" className="xl:col-span-4">
            <Input value={draft.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Nome do cliente" list="saidas-clientes" />
          </Campo>
          <Campo label="Usuário responsável" className="sm:col-span-2 xl:col-span-4">
            <Select value={draft.usuario || "todos"} onValueChange={(v) => set("usuario", v === "todos" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
        </div>
        <datalist id="saidas-clientes">
          {[...new Set(linhas.map((r) => r.cliente).filter(Boolean))].map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={() => setFiltro(draft)}>
            Filtrar
          </Button>
          <Button type="button" variant="outline" onClick={limpar}>
            <X /> Limpar filtros
          </Button>
        </div>
        </details>
          </div>
        </details>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <CardKpi label="Total de saídas" value={soma.saidas} />
        <CardKpi label="Total de pallets" value={soma.pallets ?? "—"} hint={soma.pallets == null ? "Só soma quando o lançamento tem pallet" : undefined} />
        <div className="col-span-2 rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-1"><p className="text-xs text-muted-foreground">Volumes por unidade</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-3xl font-semibold">{volumes.map(([unit, amount]) => <CountUp key={unit} value={amount} decimals={Number.isInteger(amount) ? 0 : 3} suffix={unit} />)}{!volumes.length ? "—" : null}</div></div>
      </div>
      <p className="text-xs text-muted-foreground">Origem: {pavNome} · Produto: {mercLabel}</p>

      {familia ? (
        <section className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total geral de {familia.nome}</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {familia.variedades.map((v) => (
              <li key={v.nome}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left text-sm"
                  onClick={() =>
                    abrirGrupo(
                      `${familia.nome} ${v.nome}`.trim(),
                      visiveis.filter((r) => r.familia === familia.nome && (r.variedade || r.mercadoria) === v.nome),
                    )
                  }
                >
                  <span>{v.nome}</span>
                  <span className="font-semibold tabular-nums">
                    {formatNumber(v.total)} {v.unidade}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm font-semibold">
            Total de {familia.nome}: {formatNumber(familia.total)} {familia.unidade}
          </p>
        </section>
      ) : null}

      {vista !== "lista" ? (
        <ScreenCharts
          screen="saidas"
          movs={visiveis.map((linha) => linha.raw)}
          pavilhoes={pavilhoes}
          periodLabel={filtro.de && filtro.ate ? `${filtro.de.split("-").reverse().join("/")} a ${filtro.ate.split("-").reverse().join("/")}` : "Filtro atual das saídas"}
        />
      ) : null}

      <div className="jg-lista space-y-3">
      {visiveis.length === 0 ? (
        <OpNote src="/lottie/caminhao.json" title="Nenhuma saída neste filtro" detail="Ajuste o período ou o produto para ver as cargas que saíram." />
      ) : grupo === "mercadoria" ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {porMercadoria.map((g) => (
            <li key={g.key}>
              <button type="button" className="w-full rounded-2xl border border-border bg-card p-3 text-left shadow-card" onClick={() => abrirGrupo(g.nome, g.linhas)}>
                <span className="flex items-center gap-2">
                  <ProductIcon nome={g.nome} codigo={g.linhas[0]?.codigo} foto={porId.get(g.key)?.foto || porId.get(g.key)?.foto_original} size="sm" />
                  <span className="min-w-0">
                    <p className="truncate font-medium">{g.nome}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formula(g)}</p>
                  </span>
                </span>
                <p className="text-xs text-muted-foreground">
                  {g.linhas.length} saída(s)
                  {g.pallets != null ? ` · ${formatNumber(g.pallets)} pallets` : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : grupo === "pavilhao" ? (
        <div className="space-y-3">
          {porPavilhao.map((p) => (
            <section key={p.key} className="rounded-2xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{p.nome}</h3>
                <p className="text-sm font-semibold tabular-nums">
                  Total: {formatNumber(p.total)} {p.unidade}
                </p>
              </div>
              <ul className="mt-2 divide-y divide-border">
                {p.produtos.map((g) => (
                  <li key={g.key}>
                    <button type="button" className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm" onClick={() => abrirGrupo(`${g.nome} · ${p.nome}`, g.linhas)}>
                      <span className="flex min-w-0 items-center gap-2">
                        <ProductIcon nome={g.nome} codigo={g.linhas[0]?.codigo} foto={porId.get(g.key)?.foto || porId.get(g.key)?.foto_original} size="xs" />
                        <span className="truncate">{g.nome}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatNumber(g.total)} {g.unidade}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <>
          <ul className="space-y-2 sm:hidden">
            {visiveis.map((r) => (
              <li key={r.id} className={changed.has(r.id) ? "row-updated rounded-2xl" : undefined}>
                <article
                  data-ctx="saida"
                  data-id={r.id}
                  data-produto={r.mercadoriaId}
                  data-nome={r.mercadoria}
                  data-codigo={r.codigo}
                  className="rounded-2xl border border-border bg-card p-3 shadow-card"
                >
                  <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => onOpen(r.raw)}>
                    <ProductIcon nome={r.mercadoria} codigo={r.codigo} foto={porId.get(r.mercadoriaId)?.foto || porId.get(r.mercadoriaId)?.foto_original} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.mercadoria}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.variedade || "Sem variedade"}</span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      {formatNumber(r.total)} {r.unidade}
                    </span>
                  </button>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <Info label="Data" value={formatDateBR(r.data)} />
                    <Info label="Origem" value={r.pavilhao} />
                    <Info label="Horário de saída" value={formatTime(r.raw.hora_saida)} />
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Horário de chegada</dt>
                      <dd className="mt-0.5">
                        <ChegadaBtn s={r.raw} onChegada={abrirChegada} />
                      </dd>
                    </div>
                    <Info label="Destino" value={r.destino} />
                    <Info label="Cliente" value={r.cliente || "—"} />
                    <Info label="Usuário" value={r.usuario || "—"} />
                  </dl>
                  <div className="mt-2 flex justify-end gap-2 border-t border-border pt-2">
                    <button type="button" className="px-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onEdit(r.raw)}>
                      Editar
                    </button>
                    <button type="button" className="px-1 text-xs text-destructive" onClick={() => onDelete(r.raw)}>
                      Excluir
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
          <div role="region" aria-label="Histórico de saídas" tabIndex={0} className="jg-table-wrap hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-card sm:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-[1%] whitespace-nowrap px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Origem</th>
                  <th className="px-3 py-2 font-medium">Mercadoria</th>
                  <th className="px-3 py-2 font-medium">Variedade</th>
                  <th className="w-[1%] whitespace-nowrap px-3 py-2 font-medium">Horário de saída</th>
                  <th className="w-[1%] whitespace-nowrap px-3 py-2 font-medium">Horário de chegada</th>
                  <th className="w-[1%] whitespace-nowrap px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Destino</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Usuário</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {visiveis.map((r) => (
                  <tr
                    key={r.id}
                    data-ctx="saida"
                    data-id={r.id}
                    data-produto={r.mercadoriaId}
                    data-nome={r.mercadoria}
                    data-codigo={r.codigo}
                    className={cn("cursor-pointer border-b border-border last:border-0", changed.has(r.id) && "row-updated")}
                    tabIndex={0}
                    aria-label={`Abrir saída de ${r.mercadoria}`}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(r.raw); } }}
                    onClick={() => onOpen(r.raw)}
                  >
                    <td className="whitespace-nowrap px-3 py-2">{formatDateBR(r.data)}</td>
                    <td className="px-3 py-2">{r.pavilhao}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <ProductIcon nome={r.mercadoria} codigo={r.codigo} foto={porId.get(r.mercadoriaId)?.foto || porId.get(r.mercadoriaId)?.foto_original} size="xs" />
                        <span className="font-medium">{r.mercadoria}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.variedade || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatTime(r.raw.hora_saida)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <ChegadaBtn s={r.raw} onChegada={abrirChegada} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                      {formatNumber(r.total)} {r.unidade}
                    </td>
                    <td className="px-3 py-2">{r.destino}</td>
                    <td className="px-3 py-2">{r.cliente || "—"}</td>
                    <td className="px-3 py-2">{r.usuario || "—"}</td>
                    <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="px-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onEdit(r.raw)}>
                        Editar
                      </button>
                      <button type="button" className="px-1 text-xs text-destructive" onClick={() => onDelete(r.raw)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      </div>

      <Dialog open={!!chegada} onOpenChange={(o) => !o && setChegada(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Horário de chegada</DialogTitle>
          </DialogHeader>
          {chegada ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {chegada.mercadoria?.nome || "Mercadoria"} · {formatDateBR(chegada.data)}. Só este horário é gravado. Quantidade, origem e destino ficam como estão.
              </p>
              <TimeField id="saida-hora-chegada" value={horaChegada} onChange={setHoraChegada} aria-label="Horário de chegada" />
              <p className="text-xs text-muted-foreground">Formato HH:MM. Exemplo: 14:45. Digite 1445 que vira 14:45.</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setChegada(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={salvarChegada}>
              Salvar chegada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalhe?.titulo}</DialogTitle>
          </DialogHeader>
          {detalhe ? <Detalhe linhas={detalhe.linhas} onOpen={onOpen} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function ChegadaBtn({ s, onChegada }: { s: Saida; onChegada: (s: Saida) => void }) {
  const tem = Boolean(s.hora_chegada);
  return (
    <button
      type="button"
      className={cn(
        "text-left tabular-nums underline-offset-2 hover:underline sm:whitespace-nowrap",
        tem ? "font-medium" : "chegada-wait text-xs",
      )}
      title={tem ? "Alterar só o horário de chegada" : "Registrar horário de chegada"}
      onClick={(e) => {
        e.stopPropagation();
        onChegada(s);
      }}
    >
      {tem ? formatTime(s.hora_chegada) : "Aguardando chegada"}
    </button>
  );
}

function Detalhe({ linhas, onOpen }: { linhas: SaidaLinha[]; onOpen: (s: Saida) => void }) {
  const total = linhas.reduce((a, r) => a + r.total, 0);
  const unidade = linhas[0]?.unidade || "";
  const pallets = linhas.every((r) => r.pallets != null) ? linhas.reduce((a, r) => a + (r.pallets || 0), 0) : null;
  const por = linhas.every((r) => r.porPallet != null) && new Set(linhas.map((r) => r.porPallet)).size === 1 ? linhas[0]?.porPallet : null;
  return (
    <div className="space-y-2">
      {pallets != null && por != null ? (
        <p className="text-sm text-muted-foreground">
          {formatNumber(pallets)} pallets × {formatNumber(por)} = {formatNumber(pallets * por)} {unidade}
        </p>
      ) : null}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {linhas.map((r) => (
          <li key={r.id}>
            <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm" onClick={() => onOpen(r.raw)}>
              <span>
                {formatDateBR(r.data)} · {r.pavilhao}
                {r.pallets != null ? ` · ${formatNumber(r.pallets)} pallets` : ""}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatNumber(r.total)} {r.unidade}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm font-semibold">
        Total: {formatNumber(total)} {unidade}
      </p>
    </div>
  );
}

function BuscaMercadoria({
  catalogo,
  linhas,
  value,
  onChange,
}: {
  catalogo: Mercadoria[];
  linhas: SaidaLinha[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const sugestoes = useMemo(() => {
    const termo = value.trim();
    const vistos = new Set<string>();
    const itens: { id: string; rotulo: string }[] = [];
    for (const m of catalogo) {
      if (termo && !mercadoriaCombina(m, termo)) continue;
      const rotulo = rotuloMercadoria(m);
      if (vistos.has(rotulo)) continue;
      vistos.add(rotulo);
      itens.push({ id: m.id, rotulo });
      if (itens.length >= 12) return itens;
    }
    for (const linha of linhas) {
      if (itens.length >= 12) break;
      const rotulo = linha.codigo ? `${linha.codigo} — ${linha.mercadoria}` : linha.mercadoria;
      if (!rotulo || vistos.has(rotulo)) continue;
      if (termo && !fold(`${linha.codigo} ${linha.mercadoria}`).includes(fold(termo))) continue;
      vistos.add(rotulo);
      itens.push({ id: linha.id, rotulo });
    }
    return itens;
  }, [catalogo, linhas, value]);

  return (
    <div className="relative min-w-[16rem] flex-1">
      <Label className="mb-1 block text-xs text-muted-foreground">Pesquisar mercadoria</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={value}
          placeholder="Código ou nome"
          autoComplete="off"
          onFocus={() => setAberto(true)}
          onBlur={() => window.setTimeout(() => setAberto(false), 160)}
          onChange={(e) => {
            onChange(e.target.value);
            setAberto(true);
          }}
        />
        {value ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground"
            aria-label="Limpar pesquisa"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange("")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {aberto && value.trim() ? (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-card">
          {sugestoes.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">Nenhuma mercadoria com esse nome ou código.</li>
          ) : (
            sugestoes.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(item.rotulo);
                    setAberto(false);
                  }}
                >
                  {item.rotulo}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function Campo({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function MercadoriaFiltro({
  items,
  valueId,
  onChange,
}: {
  items: Mercadoria[];
  valueId: string;
  onChange: (id: string, label: string) => void;
}) {
  const selected = items.find((m) => m.id === valueId);
  const [busca, setBusca] = useState(selected ? rotuloMercadoria(selected) : "");
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const digitando = useRef(false);

  useEffect(() => {
    if (digitando.current) {
      digitando.current = false;
      return;
    }
    if (!valueId) {
      setBusca("");
      return;
    }
    const sel = items.find((m) => m.id === valueId);
    if (sel) setBusca(rotuloMercadoria(sel));
  }, [valueId, items]);

  const filtradas = useMemo(() => {
    const termo = selected && fold(busca) === fold(rotuloMercadoria(selected)) ? "" : busca;
    return items.filter((m) => mercadoriaCombina(m, termo)).slice(0, 24);
  }, [items, busca, selected]);

  function escolher(m: Mercadoria) {
    setBusca(rotuloMercadoria(m));
    setAberto(false);
    onChange(m.id, rotuloMercadoria(m));
  }

  function limparEscolha() {
    setBusca("");
    setAberto(true);
    setDestaque(0);
    onChange("", "");
  }

  return (
    <div className="relative">
      <Input
        value={busca}
        placeholder="Código ou nome"
        autoComplete="off"
        role="combobox"
        aria-expanded={aberto}
        aria-controls="saidas-mercadorias"
        className={valueId ? "pr-8" : undefined}
        onChange={(e) => {
          const next = e.target.value;
          setBusca(next);
          setAberto(true);
          setDestaque(0);
          if (valueId) {
            digitando.current = true;
            onChange("", "");
          }
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => window.setTimeout(() => setAberto(false), 140)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setAberto(false);
            return;
          }
          if (!aberto || filtradas.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setDestaque((n) => Math.min(n + 1, filtradas.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setDestaque((n) => Math.max(n - 1, 0));
          } else if (e.key === "Enter" && aberto) {
            e.preventDefault();
            escolher(filtradas[destaque] ?? filtradas[0]);
          }
        }}
      />
      {valueId ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Limpar mercadoria"
          onMouseDown={(e) => e.preventDefault()}
          onClick={limparEscolha}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {aberto ? (
        <ul id="saidas-mercadorias" role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-card">
          {filtradas.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhuma mercadoria cadastrada com esse código ou nome.</li>
          ) : (
            filtradas.map((m, i) => (
              <li key={m.id} role="option" aria-selected={m.id === valueId}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left text-sm",
                    i === destaque || m.id === valueId ? "bg-mint text-foreground" : "",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setDestaque(i)}
                  onClick={() => escolher(m)}
                >
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{m.codigo}</span>
                  <ProductIcon nome={m.nome} codigo={m.codigo} foto={m.foto || m.foto_original} size="xs" />
                  <span className="min-w-0 truncate font-medium">{m.nome}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function CardKpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-semibold tabular-nums", typeof value === "number" ? "text-4xl" : "text-lg break-words")}>{typeof value === "number" ? <CountUp value={value} decimals={Number.isInteger(value) ? 0 : 3} /> : value}</p>
      {hint ? <p className="text-xs leading-tight text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
