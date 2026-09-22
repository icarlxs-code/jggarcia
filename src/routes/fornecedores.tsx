import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Truck } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { notify } from "@/lib/notify";
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

export const Route = createFileRoute("/fornecedores")({ component: Fornecedores });

function Fornecedores() {
  const live = useDb();
  const list = live.listFornecedores();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");

  return (
    <PageStage className="space-y-4">
      <PageHeader icon="truck" title="Fornecedores" description="Origem das entradas do Ceasa.">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell>{f.contato}</TableCell>
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
    </PageStage>
  );
}
