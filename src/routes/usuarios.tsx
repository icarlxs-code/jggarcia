import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Pencil, Plus, QrCode, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { db } from "@/lib/store";
import { useSession } from "@/lib/session";
import { useDb } from "@/lib/use-db";
import { createQrPairing, deleteRemoteUser, listQrDevices, revokeQrDevice, upsertRemoteUser } from "@/lib/qr-auth";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import type { Usuario } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { playCeremony, ceremonyDock, initialsOf } from "@/lib/ceremony";
import { rowEl, tossAway } from "@/lib/toss";

export const Route = createFileRoute("/usuarios")({
  ssr: false,
  component: Usuarios,
});

function Usuarios() {
  const { isAdmin, perfil } = useSession();
  const live = useDb();
  const [tick, setTick] = useState(0);
  const list = useMemo(() => live.listUsuarios(), [tick, live]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nivel, setNivel] = useState("operador");
  const [devices, setDevices] = useState<
    { id: string; label: string; nome: string; email: string; createdAt: string; lastIp?: string; lastSeen?: string }[]
  >([]);
  const [cracha, setCracha] = useState<{ nome: string; img: string } | null>(null);
  const [pending, setPending] = useState<Usuario | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listQrDevices({ data: {} })
      .then(setDevices)
      .catch(() => undefined);
  }, [tick]);

  if (!isAdmin) return <Navigate to="/" />;

  return (
    <PageStage className="space-y-4">
      <PageHeader
        clip="/lottie/equipe.json"
        clipClassName="lottie-clip h-14 w-20 shrink-0"
        title="Equipe"
        description="Administradores e operadores com acesso ao sistema."
      >
        <Button
          onClick={() => {
            setEditing(null);
            setNome("");
            setEmail("");
            setSenha("");
            setNivel("operador");
            setOpen(true);
          }}
        >
          <Plus /> Novo usuário
        </Button>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u) => (
                <TableRow key={u.id} data-toss-id={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.nivel_acesso === "admin" ? "gold" : "secondary"}>
                      {u.nivel_acesso === "admin" ? "Admin" : "Operador"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status ? "success" : "muted"}>{u.status ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar usuário"
                      onClick={() => {
                        setEditing(u);
                        setNome(u.nome);
                        setEmail(u.email);
                        setSenha("");
                        setNivel(u.nivel_acesso);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="QR do celular"
                      onClick={() => {
                        void (async () => {
                          try {
                            const pair = await createQrPairing({ data: { userId: u.id } });
                            if (!pair.ok) {
                              toast.error(pair.error);
                              return;
                            }
                            const href = `${window.location.origin}/qr-acesso?p=${pair.token}`;
                            const img = await QRCode.toDataURL(href, { width: 280, margin: 1, color: { dark: "#0c241b", light: "#fcfcfc" } });
                            setCracha({ nome: pair.nome, img });
                          } catch {
                            toast.error("Não foi possível gerar o QR.");
                          }
                        })();
                      }}
                    >
                      <QrCode />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        db.updateUser({
                          user_id: u.id,
                          nome: u.nome,
                          email: u.email,
                          nivel_acesso: u.nivel_acesso,
                          status: !u.status,
                        });
                        void upsertRemoteUser({
                          data: {
                            id: u.id,
                            nome: u.nome,
                            email: u.email,
                            nivel_acesso: u.nivel_acesso,
                            status: !u.status,
                          },
                        }).catch(() => undefined);
                        setTick((n) => n + 1);
                      }}
                    >
                      {u.status ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir usuário"
                      disabled={u.id === perfil?.id}
                      onClick={() => setPending(u)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Celulares vinculados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum celular vinculado. A pessoa vincula na primeira leitura do QR.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Aparelho</TableHead>
                  <TableHead>Último IP</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.nome}</div>
                      <div className="text-xs text-muted-foreground">{d.email}</div>
                    </TableCell>
                    <TableCell>{d.label}</TableCell>
                    <TableCell className="font-mono text-xs">{d.lastIp || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Desvincular celular"
                        onClick={() => {
                          void revokeQrDevice({ data: { id: d.id } }).then(() => {
                            setTick((n) => n + 1);
                            toast.success("Celular desvinculado.");
                          });
                        }}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="un">Nome</Label>
              <Input id="un" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ue">E-mail</Label>
              <Input id="ue" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="us">{editing ? "Nova senha (opcional)" : "Senha"}</Label>
              <Input
                id="us"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={editing ? "Deixe em branco para manter" : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nível</Label>
              <Select value={nivel} onValueChange={setNivel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={saving}
              onClick={() => {
                if (!nome.trim() || !email.trim() || (!editing && !senha.trim())) {
                  toast.error(editing ? "Preencha nome e e-mail." : "Preencha nome, e-mail e senha.");
                  return;
                }
                void (async () => {
                  setSaving(true);
                  try {
                    const payload = {
                      id: editing?.id,
                      nome: nome.trim(),
                      email: email.trim(),
                      senha: senha.trim() || undefined,
                      nivel_acesso: nivel,
                      status: editing?.status ?? true,
                    };
                    const remote = await upsertRemoteUser({ data: payload });
                    if (editing) {
                      db.updateUser({
                        user_id: remote.id,
                        nome: remote.nome,
                        email: remote.email,
                        nivel_acesso: remote.nivel_acesso,
                        status: remote.status,
                        senha: senha.trim() || undefined,
                      });
                      toast.success("Usuário atualizado. Já vale no login.");
                    } else {
                      db.acceptRemoteUser(remote, senha.trim());
                      playCeremony({
                        kind: "create",
                        title: remote.nome,
                        subtitle: "Já pode entrar",
                        initials: initialsOf(remote.nome),
                        mark: "person",
                        dock: ceremonyDock("/usuarios"),
                      });
                      toast.success(`${remote.nome} já pode entrar com e-mail e senha.`);
                    }
                    setOpen(false);
                    setEditing(null);
                    setNome("");
                    setEmail("");
                    setSenha("");
                    setNivel("operador");
                    setTick((n) => n + 1);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Não gravou no servidor. Tente de novo.");
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
            >
              {saving ? "Salvando" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!cracha} onOpenChange={(o) => !o && setCracha(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crachá de {cracha?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-center">
            {cracha ? <img src={cracha.img} alt="QR do celular" className="mx-auto h-56 w-56 rounded-xl" /> : null}
            <p className="text-sm text-muted-foreground">
              A pessoa lê este QR no próprio celular. O aparelho vira a chave dela: IP fica gravado e, se esquecer a senha, é só ler o QR da tela de login.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending ? `Excluir “${pending.nome}”?` : "Excluir usuário"}
        description="Tem certeza? O perfil some do banco de dados. Essa pessoa não entra mais, nem com senha nem com QR."
        confirmLabel="Excluir"
        initials={pending ? initialsOf(pending.nome) : undefined}
        mark="person"
        onConfirm={() => {
          if (!pending) return;
          const alvo = pending;
          tossAway(rowEl(alvo.id));
          void (async () => {
            try {
              const res = await deleteRemoteUser({ data: { id: alvo.id } });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              db.deleteUser(alvo.id);
              setTick((n) => n + 1);
              toast.success(`${alvo.nome} foi excluído.`);
            } catch {
              toast.error("Não foi possível excluir.");
            }
          })();
        }}
      />
    </PageStage>
  );
}
