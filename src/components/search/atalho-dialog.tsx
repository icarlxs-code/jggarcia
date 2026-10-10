import { useState } from "react";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { notify } from "@/lib/notify";
import type { AtalhoKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PavPicker } from "@/components/inventory/pav-mark";
import { ProductPicker } from "@/components/inventory/product-picker";
import { cn } from "@/lib/utils";

export function AtalhoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const live = useDb();
  const pavilhoes = live.listPavilhoes();
  const destinos = live.listDestinos(true);
  const mercadorias = live.listMercadorias(true);
  const [kind, setKind] = useState<AtalhoKind>("transferencia");
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState("");
  const [destPav, setDestPav] = useState("");
  const [destId, setDestId] = useState("");
  const [mercId, setMercId] = useState("");
  const [formError, setFormError] = useState("");

  function reset() {
    setKind("transferencia");
    setNome("");
    setOrigem("");
    setDestPav("");
    setDestId("");
    setMercId("");
    setFormError("");
  }

  function save() {
    try {
      setFormError("");
      const row = db.createAtalho({
        kind,
        nome,
        origem_pavilhao_id: origem,
        destino_pavilhao_id: kind === "transferencia" ? destPav : undefined,
        destino_id: kind === "saida" ? destId : undefined,
        mercadoria_id: mercId || undefined,
      });
      onOpenChange(false);
      reset();
      notify.success(`Atalho “${row.nome}” salvo. Abra com Ctrl+K.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível criar o atalho.";
      setFormError(msg);
      notify.error(msg);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo atalho</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["transferencia", "Pavilhão"],
                ["saida", "Cliente"],
                ["entrada", "Entrada"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                className={cn(
                  "min-h-12 rounded-xl border px-2 text-sm font-medium",
                  kind === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="at-nome">Nome na lista</Label>
            <Input id="at-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Se vazio, o sistema escreve a rota" />
          </div>
          <div className="space-y-1.5">
            <Label>{kind === "entrada" ? "Entra em" : "Sai de"}</Label>
            <PavPicker items={pavilhoes} value={origem} onChange={setOrigem} />
          </div>
          {kind === "transferencia" ? (
            <div className="space-y-1.5">
              <Label>Chega em</Label>
              <PavPicker items={pavilhoes} value={destPav} onChange={setDestPav} excludeId={origem || undefined} />
            </div>
          ) : null}
          {kind === "saida" ? (
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              {destinos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cadastre um cliente em Clientes antes de criar este atalho.</p>
              ) : (
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {destinos.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDestId(d.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm",
                        destId === d.id ? "border-primary bg-mint font-medium" : "border-border hover:bg-muted",
                      )}
                    >
                      {d.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Produto (opcional)</Label>
            <ProductPicker items={mercadorias} value={mercId} onChange={(id) => setMercId(id)} placeholder="Qualquer produto — busque se quiser fixar um" />
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Criar atalho</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
