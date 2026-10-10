import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { db } from "@/lib/store";
import { calcTransportTime, completeTime, isValidTime } from "@/lib/format";
import { useDb } from "@/lib/use-db";
import { notify } from "@/lib/notify";
import { destinoDaSaida, isPavTransfer, lugarDaSaida } from "@/lib/catalog";
import { MovementDetail } from "@/components/inventory/movement-detail";
import { SaidasPainel } from "@/components/inventory/saidas-painel";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { PageStage } from "@/components/motion/page-stage";
import type { Saida } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeField } from "@/components/ui/time-field";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { NameRecall } from "@/components/inventory/name-recall";
import { ProductPicker } from "@/components/inventory/product-picker";
import { useQueuedEdit } from "@/lib/ctx-edit";
import { rowEl, tossAway } from "@/lib/toss";

export const Route = createFileRoute("/historico")({ component: Historico });

function Historico() {
  const live = useDb();
  const [tick, setTick] = useState(0);
  const saidas = useMemo(() => live.listSaidas().filter((s) => (s.tipo ?? "saida") === "saida"), [tick, live]);
  const pavilhoes = live.listPavilhoes(true);
  const mercadorias = live.listMercadorias();
  const destinos = live.listDestinos();
  const usuarios = live.listUsuarios();
  const [obs, setObs] = useState("");
  const [view, setView] = useState<Saida | null>(null);
  const [edit, setEdit] = useState<Saida | null>(null);
  const [qtd, setQtd] = useState("");
  const [horaSaida, setHoraSaida] = useState("");
  const [horaChegada, setHoraChegada] = useState("");
  const [desconta, setDesconta] = useState(true);
  const [operador, setOperador] = useState("");
  const [mercadoriaId, setMercadoriaId] = useState("");
  const [pending, setPending] = useState<Saida | null>(null);

  function openEdit(s: Saida) {
    setView(null);
    setEdit(s);
    setQtd(String(s.quantidade));
    setHoraSaida((s.hora_saida || "").slice(0, 5));
    setHoraChegada((s.hora_chegada || "").slice(0, 5));
    setDesconta(s.desconta_estoque !== false);
    setOperador(s.operador_nome || "");
    setObs(s.observacao || "");
    setMercadoriaId(s.mercadoria_id);
  }

  useQueuedEdit("saida", (id) => {
    const s = saidas.find((x) => x.id === id);
    if (s) openEdit(s);
  });

  function saveEdit() {
    if (!edit) return;
    const n = Number(qtd);
    if (!n || n <= 0) {
      notify.error("Quantidade inválida.");
      return;
    }
    if (!mercadoriaId) {
      notify.error("Escolha o produto.");
      return;
    }
    const hs = completeTime(horaSaida);
    const hc = horaChegada.trim() ? completeTime(horaChegada) : "";
    if (!isValidTime(hs) || (hc && !isValidTime(hc))) {
      notify.error("Informe a hora de saída com 4 dígitos. Chegada pode ficar em branco.");
      return;
    }
    const merc = mercadorias.find((m) => m.id === mercadoriaId);
    db.updateSaida(edit.id, {
      mercadoria_id: mercadoriaId,
      unidade: merc?.unidade || edit.unidade,
      quantidade: n,
      hora_saida: hs,
      hora_chegada: hc || null,
      tempo_transporte: hc ? calcTransportTime(hs, hc) : null,
      desconta_estoque: desconta,
      operador_nome: operador.trim() || "",
      observacao: obs.trim() || "",
    });
    setEdit(null);
    setTick((t) => t + 1);
    notify.success("Saída atualizada.");
  }

  return (
    <PageStage className="space-y-4">
      <PageHeader clip="/lottie/caminhao.json" title="Saídas de mercadorias" description="Filtre, some e confira de onde saiu cada quantidade. Os lançamentos não são alterados.">
        <Button asChild>
          <Link to="/nova-saida">
            <Plus /> Nova saída
          </Link>
        </Button>
      </PageHeader>
      <SaidasPainel
        saidas={saidas}
        pavilhoes={pavilhoes}
        destinos={destinos}
        usuarios={usuarios}
        onOpen={setView}
        onEdit={openEdit}
        onDelete={setPending}
      />

      <MovementDetail view={view} onClose={() => setView(null)} onEdit={openEdit} />

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[min(92dvh,48rem)]">
          <DialogHeader>
            <DialogTitle>Editar saída</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="eh-prod">Produto</Label>
              <ProductPicker
                inputId="eh-prod"
                listId="eh-prod-lista"
                inline
                items={mercadorias}
                value={mercadoriaId}
                onChange={(id) => setMercadoriaId(id)}
                placeholder="Busque o produto certo"
              />
              {edit ? (
                <p className="text-xs text-muted-foreground">
                  {lugarDaSaida(pavilhoes, edit)} → {destinoDaSaida(pavilhoes, edit)}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq">Quantidade</Label>
              <Input id="eq" type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} />
              {mercadorias.find((m) => m.id === mercadoriaId)?.unidade ? (
                <p className="text-xs text-muted-foreground">{mercadorias.find((m) => m.id === mercadoriaId)?.unidade}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="eh-s">Horário de saída</Label>
                <TimeField id="eh-s" value={horaSaida} onChange={setHoraSaida} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eh-c">Horário de chegada</Label>
                <TimeField id="eh-c" value={horaChegada} onChange={setHoraChegada} />
                <p className="text-[11px] text-muted-foreground">Opcional. Se ainda não chegou, deixe em branco.</p>
              </div>
            </div>
            <NameRecall
              id="eh-op"
              label="Empilhador"
              value={operador}
              onChange={setOperador}
              names={live.listOperadores()}
              placeholder="Quem moveu"
            />
            <div className="space-y-2">
              <Label htmlFor="eh-obs">Observação</Label>
              <textarea
                id="eh-obs"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
                className="min-h-20 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label>Estoque</Label>
              <div className={cn("stock-mode-tabs", !desconta && "is-off")}>
                <span className="stock-mode-pill" aria-hidden />
                <button type="button" className={cn(desconta && "is-on")} onClick={() => setDesconta(true)}>
                  Descontar
                </button>
                <button type="button" className={cn(!desconta && "is-on")} onClick={() => setDesconta(false)}>
                  Não descontar
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(v) => !v && setPending(null)}
        title={pending ? `Excluir saída de “${pending.mercadoria?.nome ?? "produto"}”?` : "Excluir saída"}
        description={
          pending?.desconta_estoque === false
            ? "Só o registro sai do histórico. O estoque não muda, porque esta saída não baixou quantidade."
            : isPavTransfer(pending)
              ? "O saldo volta ao pavilhão de origem e sai do destino. O total da empresa não muda."
              : "O estoque e o lote voltam ao saldo anterior. Você pode desfazer pelo aviso."
        }
        productName={pending?.mercadoria?.nome}
        mark="product"
        onConfirm={() => {
          if (!pending) return;
          tossAway(rowEl(pending.id));
          const snap = db.deleteSaida(pending.id);
          setTick((t) => t + 1);
          notify.success("Saída removida.", {
            action: snap
              ? {
                  label: "Desfazer",
                  onClick: () => {
                    db.restoreSaida(snap);
                    setTick((n) => n + 1);
                  },
                }
              : undefined,
          });
        }}
      />
    </PageStage>
  );
}
