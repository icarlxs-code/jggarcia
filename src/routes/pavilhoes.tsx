import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, Pencil, Plus } from "lucide-react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { notify } from "@/lib/notify";
import { formatNumber } from "@/lib/format";
import type { Pavilhao } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { PageStage } from "@/components/motion/page-stage";
import { playCeremony, ceremonyDock } from "@/lib/ceremony";
import { PavMark } from "@/components/inventory/pav-mark";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pavilhoes")({ component: Pavilhoes });

function Pavilhoes() {
  const live = useDb();
  const list = live.listPavilhoes(true);
  const produtos = live.listMercadorias(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Pavilhao | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);

  function startNew() {
    setEdit(null);
    setCodigo("");
    setNome("");
    setAtivo(true);
    setOpen(true);
  }

  function startEdit(p: Pavilhao) {
    setEdit(p);
    setCodigo(p.codigo);
    setNome(p.nome);
    setAtivo(p.ativo);
    setOpen(true);
  }

  function save() {
    if (!codigo.trim() || !nome.trim()) {
      notify.error("Informe código e nome do pavilhão.");
      return;
    }
    if (edit) {
      db.updatePavilhao(edit.id, { codigo: codigo.trim(), nome: nome.trim(), ativo });
      notify.success("Pavilhão atualizado.");
    } else {
      const createdName = nome.trim();
      db.createPavilhao({ codigo: codigo.trim(), nome: nome.trim(), ativo });
      notify.success("Pavilhão cadastrado.");
      playCeremony({
        kind: "create",
        title: createdName,
        subtitle: "No mapa da operação",
        mark: "store",
        dock: ceremonyDock("/pavilhoes"),
      });
    }
    setOpen(false);
  }

  return (
    <PageStage className="space-y-4">
      <PageHeader icon="store" title="Pavilhões" description="Estoque real de cada galpão. Conte o que tem no chão e corrija se não bater.">
        <Button asChild variant="outline">
          <Link to="/contagem">
            <ClipboardCheck /> Nova contagem
          </Link>
        </Button>
        <Button onClick={startNew}>
          <Plus /> Novo pavilhão
        </Button>
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {list.map((p) => {
          const comSaldo = produtos.filter((m) => live.stockAt(m.id, p.id) > 0);
          const totalItens = comSaldo.reduce((a, m) => a + live.stockAt(m.id, p.id), 0);
          return (
          <Card key={p.id} className={cn(!p.ativo && "opacity-70")}>
            <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle>{p.codigo === "74" ? "Galpão" : "Pav."} {p.codigo}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{p.nome}</p>
              </div>
              <PavMark p={p} size="lg" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-2xl font-semibold tabular-nums leading-none">{formatNumber(comSaldo.length)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  produtos com saldo · {formatNumber(totalItens)} volumes
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant={p.ativo ? "success" : "muted"}>{p.ativo ? "Operação ativa" : "Inativo"}</Badge>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/contagem" search={{ pav: p.id }}>
                    Contar
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    db.updatePavilhao(p.id, { ativo: !p.ativo });
                    notify.success(p.ativo ? "Pavilhão desativado." : "Pavilhão ativado.");
                  }}
                >
                  {p.ativo ? "Desativar" : "Ativar"}
                </Button>
              </div>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit ? "Editar pavilhão" : "Novo pavilhão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pc">Código</Label>
              <Input id="pc" placeholder="11, 13, 23, 44, 74…" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pn">Nome</Label>
              <Input id="pn" placeholder="Pavilhão 11" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 accent-primary" />
              Operação ativa
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>{edit ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageStage>
  );
}
