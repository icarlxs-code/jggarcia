export const ORIGENS = [
  "EMBALAÇÃO PAV 11",
  "GALPÃO PAV 74",
  "LOJA PAV 23",
  "PAV 44 RZD",
] as const;

export const UNIDADES = ["Caixa", "Unidade", "Kg"] as const;

export const SLOGANS = {
  main: "Frutas e qualidade em movimento",
  campaign: "Do campo para mais conquistas",
  delivery: "Agilidade e qualidade em cada entrega",
};

export const MOTIVOS_CONTAGEM = [
  { id: "estragou", label: "Estragou" },
  { id: "sumiu", label: "Sumiu" },
  { id: "vendeu", label: "Vendeu sem lançar" },
  { id: "doou", label: "Doou" },
  { id: "transferiu", label: "Foi para outro lugar" },
  { id: "perdeu", label: "Perdeu" },
  { id: "outro", label: "Outro" },
] as const;

export type ContagemMotivoId = (typeof MOTIVOS_CONTAGEM)[number]["id"] | "conferencia";

export function motivoContagemLabel(id?: string | null) {
  if (!id) return "—";
  if (id === "conferencia") return "Bateu certo";
  return MOTIVOS_CONTAGEM.find((m) => m.id === id)?.label ?? id;
}