import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { FileText, Plus, Search, Users } from "lucide-react";
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
  const selectedProd = prodId || stats.topSaida[0]?.id || "";
  const byProd = selectedProd ? clientsForProduct(selectedProd, from, to) : null;

  const filtered = list.filter((d) => {
    const term = fold(q);
    if (!term) return true;
    return fold(d.nome).includes(term) || fold(d.contato || "").includes(term) || fold(d.telefone || "").includes(term) || fold(d.cnpj || "").includes(term);
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
      <PageHeader icon="pin" title="Clientes" description={`${list.length} cadastrados · ranking do mês, ficha com logomarca, telefone e CNPJ`}>
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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Quem mais retirou neste mês</h2>
        {stats.rankClients.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Ainda não há saída para montar o ranking.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {stats.rankClients.slice(0, 8).map((c, i) => (
              <li key={c.id}>
                <Link to="/clientes/$id" params={{ id: c.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                  <span className="w-6 text-center text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.nome}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.vezes} saídas{c.topProduto ? ` · mais ${c.topProduto.nome}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatNumber(c.qtd)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SpotlightCard className="space-y-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Quem mais retirou cada produto</h2>
          <p className="text-xs text-muted-foreground">Escolha uva, morango ou outro item e veja o ranking do mês.</p>
        </div>
        {stats.topSaida.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sem saída neste mês para detalhar.</p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {stats.topSaida.slice(0, 10).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProdId(p.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-xs font-medium",
                    selectedProd === p.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p.nome}
                </button>
              ))}
            </div>
            {byProd && byProd.rank.length > 0 ? (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
                {byProd.rank.slice(0, 8).map((c, i) => (
                  <li key={c.id}>
                    <Link to="/clientes/$id" params={{ id: c.id }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted">
                      <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{c.nome}</span>
                      <span className="text-sm tabular-nums font-medium">
                        {formatNumber(c.qtd)} {byProd.unidade}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Ninguém retirou este produto neste mês.</p>
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
                  })
                }
              >
                <FileText /> PDF das saídas deste produto
              </Button>
            ) : null}
          </>
        )}
      </SpotlightCard>

      <div className="grid gap-3 sm:grid-cols-2">
        <RankBlock title="Produto que mais sai" items={stats.topSaida} />
        <RankBlock title="Produto que mais entra" items={stats.topEntrada} />
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar cliente, telefone ou CNPJ" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={q ? "Nenhum cliente neste filtro" : "Nenhum cliente ainda"} description="Cadastre o mercado ou o destino da expedição.">
          <Button onClick={() => setOpen(true)}>Novo cliente</Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filtered.map((d) => (
            <li key={d.id}>
              <Link to="/clientes/$id" params={{ id: d.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-muted">
                <ClientMark d={d} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.nome}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{d.telefone || d.contato || d.endereco || "Sem telefone"}</p>
                </div>
              </Link>
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

function RankBlock({ title, items }: { title: string; items: { id: string; nome: string; qtd: number }[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {items.slice(0, 5).map((p, i) => (
          <li key={p.id}>
            <Link to="/produto/$id" params={{ id: p.id }} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted">
              <span className="truncate text-sm">
                <span className="mr-2 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                {p.nome}
              </span>
              <span className="text-sm tabular-nums">{formatNumber(p.qtd)}</span>
            </Link>
          </li>
        ))}
        {items.length === 0 ? <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sem movimento no mês.</li> : null}
      </ul>
    </div>
  );
}
