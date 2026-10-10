export const ROTAS_OPERADOR = ["/fretes", "/despesas-frete"] as const;

export function operadorPodeVer(path: string) {
  return ROTAS_OPERADOR.some((rota) => path === rota || path.startsWith(`${rota}/`));
}
