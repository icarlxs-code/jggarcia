import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { notify } from "@/lib/notify";
import type { Empilhador } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { NameMark } from "@/components/brand/name-mark";
import { PageStage } from "@/components/motion/page-stage";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useQueuedEdit } from "@/lib/ctx-edit";
import { playCeremony, ceremonyDock } from "@/lib/ceremony";
import { ForkliftBoard } from "@/routes/central-empilhadores";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/empilhadores")({ component: Empilhadores });

function Empilhadores() {
  const live = useDb();
  const list = live.listEmpilhadores();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [edit, setEdit] = useState<Empilhador | null>(null);
  const [eNome, setENome] = useState("");
  const [eUsuario, setEUsuario] = useState("");
  const [eStatus, setEStatus] = useState<"ativo" | "inativo">("ativo");
  const [pending, setPending] = useState<Empilhador | null>(null);
  const [pair, setPair] = useState<Empilhador | null>(null);
  const [pairCode, setPairCode] = useState("");
  const [qr, setQr] = useState("");
  const [aba, setAba] = useState<"transportes" | "equipe">("transportes");
  const [foco, setFoco] = useState("");

  function abrirVinculo(row: Empilhador) {
    const created = db.createForkliftPairing(row.id);
    const url = `${window.location.origin}/operar?vincular=${created.code}`;
    setPair(row);
    setPairCode(created.code);
    setQr("");
    void import("qrcode").then((mod) => {
      const api = ((mod as { default?: { toDataURL?: (text: string, opts?: object) => Promise<string> } }).default ?? mod) as {
        toDataURL: (text: string, opts?: object) => Promise<string>;
      };
      return api.toDataURL(url, { width: 280, margin: 1 });
    }).then(setQr).catch(() => undefined);
  }

  useEffect(() => {
    function onEmp(event: Event) {
      const detail = (event as CustomEvent<{ action?: string; id?: string; nome?: string }>).detail;
      if (!detail?.id) return;
      const row = db.listEmpilhadores().find((x) => x.id === detail.id);
      if (detail.action === "transportes") {
        setAba("transportes");
        setFoco(detail.nome || row?.nome || "");
        return;
      }
      if (!row) return;
      if (detail.action === "vincular") abrirVinculo(row);
      if (detail.action === "revogar") {
        db.revokeForkliftDevices(row.id);
        notify.success("Celular removido. Ele precisa vincular de novo.");
      }
      if (detail.action === "editar") {
        setAba("equipe");
        setEdit(row);
        setENome(row.nome);
        setEUsuario(row.usuario || "");
        setEStatus(row.status === "inativo" ? "inativo" : "ativo");
      }
      if (detail.action === "excluir") setPending(row);
    }
    window.addEventListener("jg-empilhador", onEmp);
    return () => window.removeEventListener("jg-empilhador", onEmp);
  }, []);

  useQueuedEdit("empilhador", (id) => {
    const row = list.find((x) => x.id === id);
    if (!row) return;
    setEdit(row);
    setENome(row.nome);
    setEUsuario(row.usuario || "");
    setEStatus(row.status === "inativo" ? "inativo" : "ativo");
  });

  return (
    <PageStage className="space-y-4">
      <PageHeader
        clip="/lottie/galpao.json"
        clipClassName="lottie-clip h-14 w-24 shrink-0"
        title="Empilhadores"
        description="Quem move a carga, o celular de cada um e os transportes ligados às entradas e saídas."
      >
        <Button onClick={() => { setAba("equipe"); setOpen(true); }}>
          <Plus /> Novo empilhador
        </Button>
      </PageHeader>
      <div className="flex gap-2">
        {(["transportes", "equipe"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={cn("h-10 rounded-full border px-4 text-sm font-medium", aba === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}
          >
            {id === "transportes" ? "Transportes" : "Equipe"}
          </button>
        ))}
      </div>
      {aba === "transportes" ? <ForkliftBoard foco={foco} /> : null}
      {aba === "equipe" && list.length === 0 ? (
        <EmptyState
          icon={Plus}
          clip="/lottie/galpao.json"
          title="Nenhum empilhador cadastrado"
          description="Cadastre o nome. Nas saídas ele fica em cima da caixa, pronto para tocar."
        >
          <Button onClick={() => setOpen(true)}>Novo empilhador</Button>
        </EmptyState>
      ) : aba === "equipe" ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((e) => (
            <li key={e.id} data-ctx="empilhador" data-id={e.id} data-nome={e.nome} className="flex items-center gap-3 px-4 py-3">
              <NameMark nome={e.nome} shape="round" size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {e.usuario || "sem usuário"} · {e.status === "inativo" ? "inativo" : "ativo"}
                  {live.forkliftDevicesOf(e.id).length ? " · celular vinculado" : ""}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => abrirVinculo(e)}
              >
                Vincular celular
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { db.revokeForkliftDevices(e.id); notify.success("Celular removido. Ele precisa vincular de novo."); }}>
                Remover celular
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Editar nome"
                onClick={() => {
                  setEdit(e);
                  setENome(e.nome);
                  setEUsuario(e.usuario || "");
                  setEStatus(e.status === "inativo" ? "inativo" : "ativo");
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
      ) : null}

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
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ee">Nome</Label>
              <Input id="ee" value={eNome} onChange={(e) => setENome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu">Usuário</Label>
              <Input id="eu" value={eUsuario} onChange={(e) => setEUsuario(e.target.value)} placeholder="joao" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="es">Status</Label>
              <select id="es" value={eStatus} onChange={(e) => setEStatus(e.target.value === "inativo" ? "inativo" : "ativo")} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
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
                db.setEmpilhadorConta(edit.id, { usuario: eUsuario, status: eStatus });
                setEdit(null);
                notify.success("Nome atualizado nas saídas também.");
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pair} onOpenChange={(v) => !v && setPair(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular celular{pair ? ` · ${pair.nome}` : ""}</DialogTitle>
          </DialogHeader>
          <p className="text-center font-mono text-4xl font-semibold tracking-[0.25em]">{pairCode}</p>
          <p className="text-center text-sm text-muted-foreground">Válido por 10 minutos. O celular abre /operar e lê este código.</p>
          {qr ? <img src={qr} alt="QR Code de vínculo" className="mx-auto h-56 w-56" /> : null}
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
