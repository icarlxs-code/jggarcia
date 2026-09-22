import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { notify } from "@/lib/notify";
import type { Fornecedor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { PageStage } from "@/components/motion/page-stage";
import { playCeremony, ceremonyDock } from "@/lib/ceremony";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";

export const Route = createFileRoute("/fornecedores")({ component: Fornecedores });

function Fornecedores() {
  const live = useDb();
  const list = live.listFornecedores();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [edit, setEdit] = useState<Fornecedor | null>(null);
  const [eNome, setENome] = useState("");
  const [eContato, setEContato] = useState("");
  const [pending, setPending] = useState<Fornecedor | null>(null);

  return (
    <PageStage className="space-y-4">
      <PageHeader icon="truck" title="Fornecedores" description="Origem das entradas do Ceasa. Toque para editar o nome.">
        <Button onClick={() => setOpen(true)}>
          <Plus /> Novo fornecedor
        </Button>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Cadastro</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Nenhum fornecedor"
              description="Cadastre quem envia a mercadoria para o galpão."
            >
              <Button onClick={() => setOpen(true)}>Novo fornecedor</Button>
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>{f.contato}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar"
                        onClick={() => {
                          setEdit(f);
                          setENome(f.nome);
                          setEContato(f.contato);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setPending(f)}>
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fn">Nome</Label>
              <Input id="fn" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fc">Contato</Label>
              <Input id="fc" value={contato} onChange={(e) => setContato(e.target.value)} />
            </div>
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
                const createdName = nome.trim();
                db.createFornecedor({ nome, contato });
                setOpen(false);
                setNome("");
                setContato("");
                playCeremony({
                  kind: "create",
                  title: createdName,
                  subtitle: "Na origem das entradas",
                  mark: "truck",
                  dock: ceremonyDock("/fornecedores"),
                });
                notify.success("Fornecedor cadastrado.");
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
            <DialogTitle>Editar fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="en">Nome</Label>
              <Input id="en" value={eNome} onChange={(e) => setENome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec">Contato</Label>
              <Input id="ec" value={eContato} onChange={(e) => setEContato(e.target.value)} />
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
                db.updateFornecedor(edit.id, { nome: eNome, contato: eContato });
                setEdit(null);
                notify.success("Fornecedor atualizado.");
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
        title={pending ? `Excluir “${pending.nome}”?` : "Excluir"}
        description="Sai do cadastro. Entradas antigas continuam no histórico."
        mark="truck"
        onConfirm={() => {
          if (!pending) return;
          db.deleteFornecedor(pending.id);
          notify.success("Fornecedor excluído.");
        }}
      />
    </PageStage>
  );
}
