import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, { group?: string; page: string }> = {
  "/": { page: "Visão geral" },
  "/hoje": { group: "Operação", page: "Hoje" },
  "/entradas": { group: "Operação", page: "Entradas" },
  "/historico": { group: "Operação", page: "Saídas" },
  "/nova-saida": { group: "Operação", page: "Nova saída" },
  "/estoque": { group: "Operação", page: "Estoque" },
  "/contagem": { group: "Operação", page: "Contagem" },
  "/lotes": { group: "Operação", page: "Lotes" },
  "/mercadorias": { group: "Cadastros", page: "Produtos" },
  "/clientes": { group: "Cadastros", page: "Clientes" },
  "/destinos": { group: "Cadastros", page: "Clientes" },
  "/fornecedores": { group: "Cadastros", page: "Fornecedores" },
  "/pavilhoes": { group: "Cadastros", page: "Pavilhões" },
  "/auditoria": { group: "Gestão", page: "Auditoria" },
  "/relatorios": { group: "Gestão", page: "Relatórios" },
  "/usuarios": { group: "Gestão", page: "Equipe" },
  "/configuracoes": { group: "Gestão", page: "Configurações" },
};

export function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumb =
    pathname.startsWith("/produto/")
      ? { group: "Operação", page: "Perfil do produto" }
      : pathname.startsWith("/clientes/")
        ? { group: "Cadastros", page: "Cliente" }
        : (LABELS[pathname] ?? { page: "JG Garcia" });
  return (
    <nav aria-label="Caminho" className="hidden min-w-0 items-center text-sm text-muted-foreground md:flex">
      <Link to="/" className="hover:text-foreground">
        Início
      </Link>
      {crumb.group ? (
        <>
          <ChevronRight className="mx-1 h-3.5 w-3.5 opacity-50" />
          <span>{crumb.group}</span>
        </>
      ) : null}
      <ChevronRight className="mx-1 h-3.5 w-3.5 opacity-50" />
      <span className="truncate font-medium text-foreground">{crumb.page}</span>
    </nav>
  );
}
