/** Códigos que não identificam um lugar só. Esses nunca zeram estoque. */
const BLOQUEADOS = new Set(["", "todos", "todas", "all", "*", "0"]);

/** Aceita o código de um lugar específico. Recusa vazio e “zerar tudo”. */
export function pavilhaoParaZerar(codigo: unknown): string | null {
  const raw = String(codigo ?? "").trim();
  if (BLOQUEADOS.has(raw.toLowerCase())) return null;
  return raw;
}

