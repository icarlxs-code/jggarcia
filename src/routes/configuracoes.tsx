import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/configuracoes")({ component: Configuracoes });

function Configuracoes() {
  const { isAdmin } = useSession();
  if (!isAdmin) return <Navigate to="/" />;
  return (
    <div className="space-y-4">
      <PageHeader icon="gear" title="Configurações" description="Regras operacionais da expedição." />
      <Card>
        <CardHeader>
          <CardTitle>Regras de validade</CardTitle>
          <CardDescription>Janela de alerta: 7 dias. Política de saída: FEFO. Lote vencido bloqueado na expedição.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Origens padrão: EMBALAÇÃO PAV 11, GALPÃO PAV 74, LOJA PAV 23, PAV 44 RZD. Pavilhões monitorados: 11, 13, 23, 44 e Galpão 74.
        </CardContent>
      </Card>
    </div>
  );
}
