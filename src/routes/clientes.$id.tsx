import { useRef, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { FileText, Pencil, Users } from "lucide-react";
import { db } from "@/lib/store";
import { useSession } from "@/lib/session";
import { useDb } from "@/lib/use-db";
import { formatDateBR, formatNumber, monthStartISO, todayISO } from "@/lib/format";
import { clientStats, exportSaidasClientesPdf, readLogoFile } from "@/lib/reports";
import { lugarDaSaida } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { CountUp } from "@/components/motion/count-up";
import { Spark } from "@/components/motion/live-gears";
import { dailySeries } from "@/lib/dashboard-stats";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { EmptyState } from "@/components/empty-state";
import { notify } from "@/lib/notify";
import { ClientMark } from "@/components/clients/client-mark";
import { ProductLabel } from "@/components/inventory/product-icon";

export const Route = createFileRoute("/clientes/$id")({ component: ClientePerfil });

function ClientePerfil() {
  const { id } = Route.useParams();
  const { isAdmin } = useSession();
  const live = useDb();
  const d = live.listDestinos(false).find((x) => x.id === id);
  const pavilhoes = live.listPavilhoes(true);
  const from = monthStartISO();
  const to = todayISO();
  const stats = clientStats(from, to);
  const mine = stats.rankClients.find((c) => c.id === id);
  const saidas = live.listSaidas({ tipo: "saida" }).filter((s) => s.destino_id === id);
  const mes = saidas.filter((s) => s.data >= from && s.data <= to);
  const [edit, setEdit] = useState(false);
  const [nome, setNome] = useState(d?.nome ?? "");
  const [telefone, setTelefone] = useState(d?.telefone || d?.contato || "");
  const [cnpj, setCnpj] = useState(d?.cnpj ?? "");
  const [email, setEmail] = useState(d?.email ?? "");
  const [endereco, setEndereco] = useState(d?.endereco ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isAdmin) return <Navigate to="/" />;
  if (!d) {
    return (
      <PageStage>
        <EmptyState icon={Users} title="Cliente não encontrado" description="Ele pode ter sido excluído.">
          <Button asChild>
            <Link to="/clientes">Voltar</Link>
          </Button>
        </EmptyState>
      </PageStage>
    );
  }

  const topProds = mine ? [...mine.produtos.values()].sort((a, b) => b.qtd - a.qtd) : [];

  return (
    <PageStage className="mx-auto max-w-3xl space-y-4">
      <PageHeader icon="pin" title={d.nome} description="Ficha do cliente · retiradas do mês e contato">
        <Button variant="outline" onClick={() => exportSaidasClientesPdf({ from, to, destinoId: d.id })}>
          <FileText /> PDF do mês
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setNome(d.nome);
            setTelefone(d.telefone || d.contato || "");
            setCnpj(d.cnpj ?? "");
            setEmail(d.email ?? "");
            setEndereco(d.endereco ?? "");
            setEdit(true);
          }}
        >
          <Pencil /> Editar
        </Button>
      </PageHeader>

      <SpotlightCard className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <button type="button" className="shrink-0 self-start" onClick={() => fileRef.current?.click()} aria-label="Trocar logomarca">
            <ClientMark d={d} size="lg" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const logo = await readLogoFile(file);
                db.updateDestino(d.id, { logo });
                notify.success("Logomarca salva.");
              } catch (err) {
                notify.error(err instanceof Error ? err.message : "Não deu para salvar a logo.");
              }
            }}
          />
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Telefone · </span>
              {d.telefone || d.contato ? (
                <a className="font-medium underline-offset-2 hover:underline" href={`tel:${(d.telefone || d.contato || "").replace(/\s/g, "")}`}>
                  {d.telefone || d.contato}
                </a>
              ) : (
                "—"
              )}
            </p>
            <p>
              <span className="text-muted-foreground">CNPJ · </span>
              {d.cnpj || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">E-mail · </span>
              {d.email ? (
                <a className="underline-offset-2 hover:underline" href={`mailto:${d.email}`}>
                  {d.email}
                </a>
              ) : (
                "—"
              )}
            </p>
            <p>
              <span className="text-muted-foreground">Endereço · </span>
              {d.endereco || "—"}
            </p>
            <p className="text-xs text-muted-foreground">Toque na marca para enviar a logo do mercado.</p>
          </div>
          <div className="text-right">
            <Spark
              values={dailySeries(mes, from, to).map((d) => d.saidas)}
              tone="out"
              label="Quantidade retirada por dia neste mês"
            />
            <p className="text-2xl font-semibold tabular-nums leading-none">
              <CountUp value={mine?.qtd ?? 0} />
            </p>
            <p className="text-xs text-muted-foreground">un. neste mês · traço por dia</p>
          </div>
      </SpotlightCard>

      <div>
        <h2 className="mb-2 text-sm font-semibold">O que mais retira</h2>
        {topProds.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma saída para este cliente neste mês.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {topProds.slice(0, 8).map((p) => (
              <li key={p.nome} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="truncate">{p.nome}</span>
                <span className="tabular-nums font-medium">{formatNumber(p.qtd)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Saídas recentes</h2>
        {saidas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma saída ainda.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {saidas.slice(0, 24).map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <ProductLabel
                  nome={s.mercadoria?.nome ?? "Produto"}
                  codigo={s.mercadoria?.codigo}
                  extra={`${formatDateBR(s.data)} · ${lugarDaSaida(pavilhoes, s)}`}
                  className="min-w-0 flex-1"
                />
                <span className="text-sm font-semibold tabular-nums">
                  {formatNumber(s.quantidade)} {s.unidade}
                </span>
              </li>
            ))}
          </ul>
        )}
        {mes.length > 0 ? (
          <Button className="mt-3 w-full" variant="outline" onClick={() => exportSaidasClientesPdf({ from, to, destinoId: d.id })}>
            Exportar PDF das saídas deste mês
          </Button>
        ) : null}
      </div>

      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="en">Nome</Label>
              <Input id="en" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et">Telefone</Label>
              <Input id="et" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec">CNPJ</Label>
              <Input id="ec" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ee">E-mail</Label>
              <Input id="ee" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed">Endereço</Label>
              <Input id="ed" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!nome.trim()) {
                  notify.error("Informe o nome.");
                  return;
                }
                db.updateDestino(d.id, { nome, telefone, contato: telefone, cnpj, email, endereco });
                setEdit(false);
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

