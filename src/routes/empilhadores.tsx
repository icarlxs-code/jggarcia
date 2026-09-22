import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { useSession } from "@/lib/session";
import { notify } from "@/lib/notify";
import type { Empilhador } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { playCeremony, ceremonyDock } from "@/lib/ceremony";

export const Route = createFileRoute("/empilhadores")({ component: Empilhadores });

function Empilhadores() {
  const { isAdmin } = useSession();
  const live = useDb();
  const list = live.listEmpilhadores();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [edit, setEdit] = useState<Empilhador | null>(null);
  const [eNome, setENome] = useState("");
  const [pending, setPending] = useState<Empilhador | null>(null);

  if (!isAdmin) return <Navigate to="/" />;

  return (
    <PageStage className="space-y-4">
      <PageHeader icon="users" title="Empilhadores" description="Cadastro de quem move a carga. O nome também aparece na saída, digitando ou tocando no atalho.">
        <Button onClick={() => setOpen(true)}>
          <Plus /> Novo empilhador
        </Button>
      </PageHeader>

      {list.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="Nenhum empilhador cadastrado"
          description="Cadastre o nome. Nas saídas ele fica em cima da caixa, pronto para tocar."
        >
          <Button onClick={() => setOpen(true)}>Novo empilhador</Button>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3">
              <p className="min-w-0 flex-1 truncate font-medium">{e.nome}</p>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Editar nome"
                onClick={() => {
                  setEdit(e);
                  setENome(e.nome);
                }}
              >
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setPending(e)}>
                <Trash2 className="text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo empilhador</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="en">Nome</Label>
            <Input id="en" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome de quem opera" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!nome.trim()) {
                  notify.error("Informe o nome.");
                  return;
                }
                const created = db.createEmpilhador(nome);
                setOpen(false);
                setNome("");
                playCeremony({
                  kind: "create",
                  title: created.nome,
                  subtitle: "No cadastro de empilhadores",
                  mark: "client",
                  dock: ceremonyDock("/empilhadores"),
                });
                notify.success("Empilhador cadastrado.");
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar nome</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ee">Nome</Label>
            <Input id="ee" value={eNome} onChange={(e) => setENome(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!edit) return;
                if (!eNome.trim()) {
                  notify.error("Informe o nome.");
                  return;
                }
                db.renameEmpilhador(edit.id, eNome);
                setEdit(null);
                notify.success("Nome atualizado nas saídas também.");
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending ? `Remover “${pending.nome}”?` : "Remover"}
        description="Sai do cadastro e dos atalhos da saída. O histórico antigo mantém o nome que estava na nota."
        initials={pending?.nome}
        onConfirm={() => {
          if (!pending) return;
          db.deleteEmpilhador(pending.id);
          notify.success("Empilhador removido do cadastro.");
        }}
      />
    </PageStage>
  );
}
