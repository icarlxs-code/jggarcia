import type { CSSProperties } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Every area of the product has its own identity: a glyph, a light (accent)
 * drawn from the produce itself, and a one-line purpose. The global brand
 * (forest green + dawn gold) stays on actions; the module light marks place.
 */
export type ModuleId =
  | "hoje"
  | "inicio"
  | "entradas"
  | "saidas"
  | "movimentacoes"
  | "estoque"
  | "contagem"
  | "lotes"
  | "produtos"
  | "clientes"
  | "fornecedores"
  | "empilhadores"
  | "pavilhoes"
  | "log"
  | "relatorios"
  | "analises"
  | "fretes"
  | "despesas"
  | "requisicoes"
  | "equipe"
  | "config"
  | "acesso";

export interface ModuleInfo {
  id: ModuleId;
  nome: string;
  /** The module's light: icons, ambient glow, indicators. */
  luz: string;
  /** Darker companion for text and strokes on light surfaces. */
  tinta: string;
  /** What the module is for, in the product's own words. */
  papel: string;
}

export const MODULES: Record<ModuleId, ModuleInfo> = {
  hoje: { id: "hoje", nome: "Hoje", luz: "#e39a1e", tinta: "#8a5306", papel: "O dia da operação, do primeiro caminhão ao último." },
  inicio: { id: "inicio", nome: "Visão geral", luz: "#1f7a52", tinta: "#14583a", papel: "Posição do estoque, alertas e tendências." },
  entradas: { id: "entradas", nome: "Entradas", luz: "#3aa65f", tinta: "#1b6a3b", papel: "Recebimento: a mercadoria chega e o estoque sobe." },
  saidas: { id: "saidas", nome: "Saídas", luz: "#ef6a1f", tinta: "#a3430c", papel: "Expedição: de onde sai, para onde vai e a que horas." },
  movimentacoes: { id: "movimentacoes", nome: "Movimentações", luz: "#139c95", tinta: "#0a625d", papel: "Tudo que se moveu, em uma linha do tempo." },
  estoque: { id: "estoque", nome: "Estoque", luz: "#b37b3d", tinta: "#6e4a1f", papel: "Saldo, local e situação de cada produto." },
  contagem: { id: "contagem", nome: "Contagem", luz: "#5a62e6", tinta: "#353ca8", papel: "Conferência física, produto por produto." },
  lotes: { id: "lotes", nome: "Lotes", luz: "#8a4fc9", tinta: "#5d2c95", papel: "Validade e ordem de saída (FEFO)." },
  produtos: { id: "produtos", nome: "Produtos", luz: "#8cb51f", tinta: "#4f6a0c", papel: "O catálogo que alimenta estoque e lançamentos." },
  clientes: { id: "clientes", nome: "Clientes", luz: "#2f80e0", tinta: "#1c519b", papel: "Mercados e destinos da expedição." },
  fornecedores: { id: "fornecedores", nome: "Fornecedores", luz: "#c0643b", tinta: "#86391c", papel: "A origem das entradas no Ceasa." },
  empilhadores: { id: "empilhadores", nome: "Empilhadores", luz: "#e8b40c", tinta: "#7a5c00", papel: "Quem move a carga e onde ela está." },
  pavilhoes: { id: "pavilhoes", nome: "Pavilhões", luz: "#4f7590", tinta: "#2f4a5e", papel: "Os lugares físicos e o que há em cada um." },
  log: { id: "log", nome: "Log de alterações", luz: "#6b7380", tinta: "#3e444d", papel: "Quem lançou, alterou ou removeu, e quando." },
  relatorios: { id: "relatorios", nome: "Relatórios", luz: "#c23f7d", tinta: "#8a2556", papel: "Documentos prontos para baixar e enviar." },
  analises: { id: "analises", nome: "Gráficos e análises", luz: "#7158e2", tinta: "#4b35b0", papel: "Os lançamentos em leitura visual." },
  fretes: { id: "fretes", nome: "Pagamento de fretes", luz: "#c99a1e", tinta: "#765708", papel: "Comprovantes de pagamento de frete." },
  despesas: { id: "despesas", nome: "Despesa de frete", luz: "#e0544f", tinta: "#9e2c28", papel: "Despesas de frete com comprovante." },
  requisicoes: { id: "requisicoes", nome: "Requisições", luz: "#1f9cc4", tinta: "#0e5f7d", papel: "Pedidos ao fornecedor com número de série." },
  equipe: { id: "equipe", nome: "Equipe", luz: "#d9617f", tinta: "#9a3550", papel: "Contas, perfis e celulares vinculados." },
  config: { id: "config", nome: "Configurações", luz: "#7c8796", tinta: "#48525f", papel: "Preferências desta conta." },
  acesso: { id: "acesso", nome: "Acesso", luz: "#1f7a52", tinta: "#14583a", papel: "Entrar e vincular aparelhos." },
};

/** Longest prefix wins; "/" only matches exactly. */
const ROUTES: [string, ModuleId][] = [
  ["/hoje", "hoje"],
  ["/entradas", "entradas"],
  ["/historico", "saidas"],
  ["/nova-saida", "saidas"],
  ["/movimentacoes", "movimentacoes"],
  ["/estoque", "estoque"],
  ["/contagem", "contagem"],
  ["/lotes", "lotes"],
  ["/mercadorias", "produtos"],
  ["/produto", "produtos"],
  ["/clientes", "clientes"],
  ["/destinos", "clientes"],
  ["/fornecedores", "fornecedores"],
  ["/empilhadores", "empilhadores"],
  ["/central-empilhadores", "empilhadores"],
  ["/operar", "empilhadores"],
  ["/pavilhoes", "pavilhoes"],
  ["/auditoria", "log"],
  ["/relatorios", "relatorios"],
  ["/analises", "analises"],
  ["/fretes", "fretes"],
  ["/despesas-frete", "despesas"],
  ["/requisicoes", "requisicoes"],
  ["/usuarios", "equipe"],
  ["/configuracoes", "config"],
  ["/qr-acesso", "acesso"],
];

export function moduleForPath(pathname: string): ModuleId {
  if (pathname === "/" || pathname === "") return "inicio";
  let best: [string, ModuleId] | null = null;
  for (const row of ROUTES) {
    if (pathname === row[0] || pathname.startsWith(`${row[0]}/`)) {
      if (!best || row[0].length > best[0].length) best = row;
    }
  }
  return best ? best[1] : "inicio";
}

export function useCurrentModule(): ModuleInfo {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return MODULES[moduleForPath(pathname)];
}

/** Inline custom properties so any element can carry a module's light. */
export function moduleStyle(id: ModuleId): CSSProperties {
  const m = MODULES[id];
  return { "--mod": m.luz, "--mod-ink": m.tinta } as CSSProperties;
}
