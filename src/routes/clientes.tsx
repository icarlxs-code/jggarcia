import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { FileText, Pencil, Plus, Search, Users, X } from "lucide-react";
import { db } from "@/lib/store";
import { useSession } from "@/lib/session";
import { useDb } from "@/lib/use-db";
import { formatNumber, monthStartISO, todayISO } from "@/lib/format";
import { clientStats, clientsForProduct, exportReportPdf, exportSaidasClientesPdf } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { EmptyState } from "@/components/empty-state";
import { ActionButton } from "@/components/motion/action-button";
import { CountUp } from "@/components/motion/count-up";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { notify } from "@/lib/notify";
import { playCeremony, ceremonyDock, initialsOf } from "@/lib/ceremony";
import { cn, fold } from "@/lib/utils";
import { ClientMark } from "@/components/clients/client-mark";
import { useQueuedEdit } from "@/lib/ctx-edit";
import type { Destino } from "@/lib/types";

export const Route = createFileRoute("/clientes")({ component: Clientes });

function Clientes() {
  const { isAdmin } = useSession();
  const live = useDb();
  const list = live.listDestinos();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const from = monthStartISO();
  const to = todayISO();
  const stats = clientStats(from, to);
  const [prodId, setProdId] = useState("");
  const [prodBusca, setProdBusca] = useState("");
  const [prodCleared, setProdCleared] = useState(false);
  const [cliFiltro, setCliFiltro] = useState("");
  const [edit, setEdit] = useState<Destino | null>(null);
  const [eNome, setENome] = useState("");
  const [eTelefone, setETelefone] = useState("");
  const [eCnpj, setECnpj] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [eEndereco, setEEndereco] = useState("");
  const selectedProd = prodCleared ? "" : prodId || stats.topSaida[0]?.id || "";
  const byProd = selectedProd ? clientsForProduct(selectedProd, from, to) : null;
  const mercadorias = live.listMercadorias(true);

  const filtered = list.filter((d) => {
    const term = fold(q);
    if (!term) return true;
    return fold(d.nome).includes(term) || fold(d.contato || "").includes(term) || fold(d.telefone || "").includes(term) || fold(d.cnpj || "").includes(term);
  });

  useQueuedEdit("cliente", (id) => {
    const d = list.find((x) => x.id === id);
    if (!d) return;
    setEdit(d);
    setENome(d.nome);
    setETelefone(d.telefone || d.contato || "");
    setECnpj(d.cnpj || "");
    setEEmail(d.email || "");
    setEEndereco(d.endereco || "");
  });

  if (!isAdmin) return <Navigate to="/" />;

  function resetForm() {
    setNome("");
    setTelefone("");
    setCnpj("");
    setEmail("");
    setEndereco("");
  }

  return (
    <PageStage className="space-y-4">
      <PageHeader clip="/lottie/pin.json" title="Clientes" description={`${list.length} cadastrados · ranking do mês, ficha com logomarca, telefone e CNPJ`}>
        <Button variant="outline" onClick={() => exportSaidasClientesPdf({ from, to })}>
          <FileText /> PDF do mês
        </Button>
        <Button onClick={() => setOpen(true)}>
          <Plus /> Novo cliente
        </Button>
      </PageHeader>

      <div className="grid gap-2 sm:grid-cols-3">
        <StatCard label="Clientes" value={list.length} />
        <StatCard label="Saídas no mês" value={stats.totalSaidas} />
        <StatCard label="Entradas no mês" value={stats.totalEntradas} />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar cliente, telefone ou CNPJ" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid items-stretch gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <h2 className="border-b border-border px-3 py-2.5 text-sm font-semibold">Quem mais retirou neste mês</h2>
          {stats.rankClients.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Ainda não há saída para montar o ranking.</p>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
              {stats.rankClients.slice(0, 12).map((c, i) => (
                <li key={c.id} data-ctx="rank-cliente" data-id={c.id} data-nome={c.nome}>
                  <Link to="/clientes/$id" params={{ id: c.id }} className="flex items-center gap-2 px-3 py-2 hover:bg-muted">
                    <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.nome}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {c.vezes} saídas{c.topProduto ? ` · mais ${c.topProduto.nome}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatNumber(c.qtd)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SpotlightCard className="flex h-full min-h-0 flex-col space-y-2 p-3">
          <div>
            <h2 className="text-sm font-semibold">Quem mais retirou cada produto</h2>
            <p className="text-[11px] text-muted-foreground">O PDF sai só desse recorte.</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-10 pr-10"
              placeholder="Buscar produto"
              value={prodBusca}
              onChange={(e) => {
                setProdBusca(e.target.value);
                setProdId("");
                setProdCleared(false);
              }}
            />
            {prodBusca || prodId ? (
              <button
                type="button"
                aria-label="Apagar pesquisa"
                className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  setProdBusca("");
                  setProdId("");
                  setProdCleared(true);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {(() => {
            const qProd = fold(prodBusca.trim());
            const prodOptions = qProd
              ? mercadorias.filter((m) => fold(m.nome).includes(qProd) || fold(m.codigo).includes(qProd)).slice(0, 8)
              : stats.topSaida.slice(0, 8).map((p) => mercadorias.find((m) => m.id === p.id) || { id: p.id, nome: p.nome, codigo: "" });
            return (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {prodOptions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    data-ctx="rank-produto"
                    data-id={p.id}
                    data-nome={p.nome}
                    data-extra="saida"
                    onClick={() => {
                      setProdId(p.id);
                      setProdBusca(p.nome);
                      setProdCleared(false);
                    }}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-medium",
                      selectedProd === p.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
            );
          })()}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-10"
              placeholder="Filtrar um cliente (opcional)"
              value={cliFiltro}
              onChange={(e) => setCliFiltro(e.target.value)}
            />
          </div>
          {(() => {
            const term = fold(cliFiltro.trim());
            const rank = (byProd?.rank ?? []).filter((c) => !term || fold(c.nome).includes(term));
            const chosen = term ? list.find((d) => fold(d.nome).includes(term)) : null;
            return (
              <>
                {rank.length > 0 ? (
                  <ul className="max-h-44 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-background">
                    {rank.slice(0, 8).map((c, i) => (
                      <li key={c.id} data-ctx="rank-cliente-produto" data-id={c.id} data-produto={selectedProd} data-nome={c.nome}>
                        <Link to="/clientes/$id" params={{ id: c.id }} className="flex items-center gap-2 px-2.5 py-2 hover:bg-muted">
                          <span className="w-4 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-sm">{c.nome}</span>
                          <span className="shrink-0 text-sm font-medium tabular-nums">
                            {formatNumber(c.qtd)} {byProd?.unidade}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selectedProd ? "Ninguém retirou este produto neste recorte." : "Sem saída neste mês para detalhar."}
                  </p>
                )}
                {selectedProd ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      exportReportPdf({
                        from,
                        to,
                        pavilhaoId: "todos",
                        kind: "saida",
                        mercadoriaId: selectedProd,
                        destinoId: chosen?.id,
                      })
                    }
                  >
                    <FileText /> {chosen ? `PDF de ${chosen.nome}` : "PDF deste produto"}
                  </Button>
                ) : null}
              </>
            );
          })()}
        </SpotlightCard>

        <RankBlock title="Produto que mais sai" items={stats.topSaida} extra="saida" />
        <RankBlock title="Produto que mais entra" items={stats.topEntrada} extra="entrada" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} clip={q ? undefined : "/lottie/pin.json"} title={q ? "Nenhum cliente neste filtro" : "Nenhum cliente ainda"} description="Cadastre o mercado ou o destino da expedição.">
          <Button onClick={() => setOpen(true)}>Novo cliente</Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filtered.map((d) => (
            <li key={d.id} data-ctx="cliente" data-id={d.id} data-nome={d.nome} className="flex items-center gap-1 rounded-2xl border border-border bg-card pr-1">
              <Link to="/clientes/$id" params={{ id: d.id }} className="flex min-w-0 flex-1 items-center gap-3 p-3 hover:bg-muted">
                <ClientMark d={d} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.nome}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{d.telefone || d.contato || d.endereco || "Sem telefone"}</p>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar ${d.nome}`}
                onClick={() => {
                  setEdit(d);
                  setENome(d.nome);
                  setETelefone(d.telefone || d.contato || "");
                  setECnpj(d.cnpj || "");
                  setEEmail(d.email || "");
                  setEEndereco(d.endereco || "");
                }}
              >
                <Pencil />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field id="cn" label="Nome" value={nome} onChange={setNome} />
            <Field id="ct" label="Telefone" value={telefone} onChange={setTelefone} />
            <Field id="cc" label="CNPJ" value={cnpj} onChange={setCnpj} />
            <Field id="ce" label="E-mail" value={email} onChange={setEmail} />
            <Field id="cd" label="Endereço" value={endereco} onChange={setEndereco} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <ActionButton
              idleLabel="Cadastrar"
              pendingLabel="Salvando"
              doneLabel="Cadastrado"
              onAction={() => {
                if (!nome.trim()) {
                  notify.error("Informe o nome do cliente.");
                  return false;
                }
                const createdName = nome.trim();
                db.createDestino({ nome, telefone, cnpj, email, endereco, contato: telefone });
                resetForm();
                window.setTimeout(() => {
                  setOpen(false);
                  playCeremony({
                    kind: "create",
                    title: createdName,
                    subtitle: "Entrou na carteira",
                    initials: initialsOf(createdName),
                    mark: "client",
                    dock: ceremonyDock("/clientes"),
                  });
                  notify.success("Cliente cadastrado.");
                }, 520);
                return true;
              }}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field id="en" label="Nome" value={eNome} onChange={setENome} />
            <Field id="et" label="Telefone" value={eTelefone} onChange={setETelefone} />
            <Field id="ec" label="CNPJ" value={eCnpj} onChange={setECnpj} />
            <Field id="ee" label="E-mail" value={eEmail} onChange={setEEmail} />
            <Field id="ed" label="Endereço" value={eEndereco} onChange={setEEndereco} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!edit) return;
                if (!eNome.trim()) {
                  notify.error("Informe o nome do cliente.");
                  return;
                }
                db.updateDestino(edit.id, {
                  nome: eNome,
                  telefone: eTelefone,
                  contato: eTelefone,
                  cnpj: eCnpj,
                  email: eEmail,
                  endereco: eEndereco,
                });
                setEdit(null);
                notify.success("Cliente atualizado.");
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

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums leading-none">
        <CountUp value={value} />
      </p>
    </div>
  );
}

function RankBlock({ title, items, extra }: { title: string; items: { id: string; nome: string; qtd: number }[]; extra: "saida" | "entrada" }) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <h2 className="border-b border-border px-3 py-2.5 text-sm font-semibold">{title}</h2>
      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {items.slice(0, 12).map((p, i) => (
          <li key={p.id} data-ctx="rank-produto" data-id={p.id} data-nome={p.nome} data-extra={extra}>
            <Link to="/produto/$id" params={{ id: p.id }} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted">
              <span className="min-w-0 truncate text-sm">
                <span className="mr-2 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                {p.nome}
              </span>
              <span className="shrink-0 text-sm tabular-nums">{formatNumber(p.qtd)}</span>
            </Link>
          </li>
        ))}
        {items.length === 0 ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">Sem movimento no mês.</li> : null}
      </ul>
    </section>
  );
}
