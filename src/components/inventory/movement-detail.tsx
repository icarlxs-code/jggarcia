import { Pencil } from "lucide-react";
import type { Saida } from "@/lib/types";
import { destinoDaSaida, isPavTransfer, lugarDaSaida } from "@/lib/catalog";
import { dataHoraLine, estoqueLabel, statusLabel, statusOf, tipoMovLabel, tipoMovimentacaoOf } from "@/lib/movement";
import { formatMinutes, formatNumber } from "@/lib/format";
import { useDb } from "@/lib/use-db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ProductLabel } from "@/components/inventory/product-icon";
import { PavMark } from "@/components/inventory/pav-mark";
import { useViewport } from "@/lib/use-viewport";

export function MovementDetail({
  view,
  onClose,
  onEdit,
  onArrive,
}: {
  view: Saida | null;
  onClose: () => void;
  onEdit?: (s: Saida) => void;
  onArrive?: (s: Saida) => void;
}) {
  const live = useDb();
  const phone = useViewport() === "phone";
  const pavilhoes = live.listPavilhoes(true);
  if (!view) {
    return (
      <Sheet open={false} onOpenChange={() => onClose()}>
        <SheetContent side={phone ? "bottom" : "right"} className="p-6" />
      </Sheet>
    );
  }
  const tipo = tipoMovimentacaoOf(view);
  const status = statusOf(view);
  const origin = pavilhoes.find((p) => p.id === view.pavilhao_id) || pavilhoes.find((p) => p.id === view.pavilhao);
  const destPav = view.destino_pavilhao_id ? pavilhoes.find((p) => p.id === view.destino_pavilhao_id) : null;
  return (
    <Sheet open={!!view} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={phone ? "bottom" : "right"} className="overflow-y-auto p-6">
        <SheetTitle>Movimentação</SheetTitle>
        <div className="mt-6 space-y-4 text-sm">
          <ProductLabel
            nome={view.mercadoria?.nome ?? "—"}
            codigo={view.mercadoria?.codigo}
            extra={`${formatNumber(view.quantidade)} ${view.unidade}`}
          />
          <div className="flex flex-wrap gap-1">
            <Badge variant={tipo === "entrada" ? "success" : tipo === "transferencia" ? "muted" : "gold"}>{tipoMovLabel(tipo)}</Badge>
            <Badge variant={status === "em_transito" ? "gold" : "muted"}>{statusLabel(status)}</Badge>
            {view.desconta_estoque === false ? <Badge variant="gold">Somente registro</Badge> : <Badge variant="muted">{estoqueLabel(view)}</Badge>}
          </div>
          <dl className="grid gap-3">
            <Row label="Produto" value={view.mercadoria?.nome ?? "—"} />
            <Row label="Código" value={view.mercadoria?.codigo ?? "—"} />
            <Row label="Quantidade" value={`${formatNumber(view.quantidade)} ${view.unidade}`} />
            <Row label="Tipo" value={tipoMovLabel(tipo)} />
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Origem</dt>
              <dd className="mt-1 flex items-center gap-2 font-medium">
                {origin ? <PavMark p={origin} size="sm" /> : null}
                {lugarDaSaida(pavilhoes, view)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Destino</dt>
              <dd className="mt-1 flex items-center gap-2 font-medium">
                {destPav ? <PavMark p={destPav} size="sm" /> : null}
                {tipo === "entrada" ? lugarDaSaida(pavilhoes, view) : destinoDaSaida(pavilhoes, view)}
              </dd>
            </div>
            <Row label="Saiu" value={dataHoraLine(view.data, view.hora_saida)} />
            <Row label="Chegou" value={view.hora_chegada ? dataHoraLine(view.data_hora_chegada?.slice(0, 10) || view.data, view.hora_chegada) : "Em trânsito"} />
            <Row label="Tempo de transporte" value={formatMinutes(view.tempo_transporte)} />
            <Row label="Empilhador" value={view.operador_nome || "Não informado"} />
            <Row label="Responsável pelo lançamento" value={view.usuario?.nome ?? "—"} />
            {view.observacao ? <Row label="Observação" value={view.observacao} /> : null}
            <Row label="Estoque" value={estoqueLabel(view)} />
            {view.estoque_origem_antes != null ? (
              <Row
                label="Saldo na origem"
                value={`${formatNumber(view.estoque_origem_antes)} → ${formatNumber(view.estoque_origem_depois ?? view.estoque_origem_antes)}`}
              />
            ) : null}
            {isPavTransfer(view) && view.estoque_destino_antes != null ? (
              <Row
                label="Saldo no destino"
                value={`${formatNumber(view.estoque_destino_antes)} → ${formatNumber(view.estoque_destino_depois ?? view.estoque_destino_antes)}`}
              />
            ) : null}
            <Row label="Criado" value={dataHoraLine(view.created_at.slice(0, 10), view.created_at.slice(11, 16))} />
            <Row label="ID da movimentação" value={view.codigo || `#${view.id.slice(0, 8)}`} />
          </dl>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {status === "em_transito" && onArrive ? (
              <Button variant="outline" onClick={() => onArrive(view)}>
                Marcar chegada
              </Button>
            ) : null}
            {onEdit ? (
              <Button variant="outline" onClick={() => onEdit(view)}>
                <Pencil /> Editar
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
