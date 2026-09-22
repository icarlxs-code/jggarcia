import { formatNumber, formatTime } from "@/lib/format";
import type { Saida } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DuplicateLaunchDialog({
  open,
  match,
  tipo,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  match: Saida | null;
  tipo: "entrada" | "saida";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const nome = match?.usuario?.nome || "Alguém da equipe";
  const produto = match?.mercadoria?.nome || "este produto";
  const qtd = match ? `${formatNumber(match.quantidade)} ${match.unidade}` : "";
  const hora = formatTime(match?.hora_chegada || match?.hora_saida);
  const label = tipo === "entrada" ? "entrada" : "saída";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Esse lançamento já foi feito</DialogTitle>
          <DialogDescription>
            {nome} já registrou {label} de {qtd} de {produto} hoje{hora !== "—" ? ` às ${hora}` : ""}.
            Lançar de novo a mesma quantidade?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Não lançar
          </Button>
          <Button onClick={onConfirm}>Lançar mesmo assim</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
