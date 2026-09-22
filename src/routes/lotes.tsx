import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { loteStatus } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { formatDateBR, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/lotes")({ component: Lotes });

function Lotes() {
  const db = useDb();
  const produtos = db.listMercadorias();
  const pavilhoes = db.listPavilhoes();
  const lotes = db.listLotes();

  return (
    <div className="space-y-4">
      <PageHeader icon="lot" title="Lotes e validade" description="FEFO: sai primeiro o lote que vence antes. Alerta em 7 dias." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">FEFO</CardTitle>
            <CardDescription>First Expired, First Out — expedição sempre pelo lote mais próximo do vencimento.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Janela de 7 dias</CardTitle>
            <CardDescription>Lotes que vencem em até 7 dias entram em “a vencer” e sobem no dashboard.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bloqueio de vencido</CardTitle>
            <CardDescription>Lote com validade anterior a hoje não pode ser escolhido em nova saída.</CardDescription>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lotes em estoque</CardTitle>
        </CardHeader>
        <CardContent>
          {lotes.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nenhum lote" description="Registre uma entrada do Ceasa para gerar o primeiro lote." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Pavilhão</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map((l) => {
                  const st = loteStatus(l.validade);
                  const prod = produtos.find((p) => p.id === l.mercadoria_id);
                  const pav = pavilhoes.find((p) => p.id === l.pavilhao_id);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.codigo}</TableCell>
                      <TableCell className="font-medium">{prod?.nome}</TableCell>
                      <TableCell>
                        {formatNumber(l.quantidade)} {l.unidade}
                      </TableCell>
                      <TableCell>{formatDateBR(l.validade)}</TableCell>
                      <TableCell>{pav?.nome}</TableCell>
                      <TableCell>
                        <Badge variant={st === "vencido" ? "destructive" : st === "a_vencer" ? "gold" : "success"}>
                          {st === "vencido" ? "Vencido" : st === "a_vencer" ? "A vencer" : "Válido"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
