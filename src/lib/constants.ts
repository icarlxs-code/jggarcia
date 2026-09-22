export const ORIGENS = [
  "EMBALAÇÃO PAV 11",
  "GALPÃO PAV 74",
  "LOJA PAV 23",
  "PAV 44 RZD",
] as const;

export const TIPOS_LUGAR = [
  "Pavilhão",
  "Galpão",
  "Box",
  "Carreta",
  "Caminhão",
  "Caminhão-baú",
  "Caminhão refrigerado",
  "Câmara fria",
  "Câmara de congelados",
  "Câmara climatizada",
  "Armazém",
  "Armazém refrigerado",
  "Armazém climatizado",
  "Depósito",
  "Depósito refrigerado",
  "Depósito seco",
  "Pedra",
  "Doca",
  "Baia",
  "Contêiner",
  "Mezanino",
  "Silo",
  "Paleteira",
  "Pallet",
  "Estrado",
  "Corredor",
  "Prateleira",
  "Estante",
  "Porta-paletes",
  "Plataforma",
  "Plataforma de carga",
  "Plataforma de descarga",
  "Pátio",
  "Pátio de cargas",
  "Pátio de estacionamento",
  "Galpão refrigerado",
  "Galpão climatizado",
  "Box refrigerado",
  "Box de armazenamento",
  "Loja",
  "Loja-box",
  "Módulo",
  "Unidade de armazenamento",
  "Área de carga",
  "Área de descarga",
  "Área de armazenagem",
  "Área de expedição",
  "Área de recebimento",
  "Área refrigerada",
  "Área coberta",
  "Área descoberta",
  "Área de transbordo",
  "Área de triagem",
  "Área de separação",
  "Área de conferência",
  "Área de picking",
  "Área de estoque",
  "Área de quarentena",
  "Área de devolução",
  "Área de mercadoria",
  "Área de carga temporária",
  "Estacionamento de carretas",
  "Estacionamento de caminhões",
] as const;

export type TipoLugar = (typeof TIPOS_LUGAR)[number];

const TIPOS_LUGAR_POR_TAMANHO = [...TIPOS_LUGAR].sort((a, b) => b.length - a.length);

export function inferTipoLugar(p: { tipo?: string | null; nome?: string | null; codigo?: string | null } | null | undefined): string {
  const stored = (p?.tipo || "").trim();
  if (stored) return stored;
  const nome = (p?.nome || "").trim();
  if (nome) {
    const key = nome.toLowerCase();
    const hit = TIPOS_LUGAR_POR_TAMANHO.find((t) => key === t.toLowerCase() || key.startsWith(`${t.toLowerCase()} `) || key.startsWith(`${t.toLowerCase()}/`));
    if (hit) return hit;
  }
  if (String(p?.codigo || "") === "74") return "Galpão";
  return "Pavilhão";
}

export const UNIDADES = [
  { value: "kg", label: "Quilograma (kg)" },
  { value: "g", label: "Grama (g)" },
  { value: "L", label: "Litro (L)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "Un", label: "Unidade (Un)" },
  { value: "Cx", label: "Caixa (Cx)" },
  { value: "Sc", label: "Saco (Sc)" },
  { value: "Mç", label: "Maço (Mç)" },
  { value: "Bdj", label: "Bandeja (Bdj)" },
  { value: "Pct", label: "Pacote (Pct)" },
] as const;

const LEGACY_UNIDADE: Record<string, string> = {
  Caixa: "Cx",
  caixa: "Cx",
  Unidade: "Un",
  unidade: "Un",
  Kg: "kg",
  KG: "kg",
  Quilo: "kg",
  Saco: "Sc",
  Bandeja: "Bdj",
  Pacote: "Pct",
  Maço: "Mç",
  Maco: "Mç",
  Litro: "L",
};

export function unidadeValue(raw?: string | null): string {
  const v = (raw || "").trim();
  if (!v) return "Cx";
  if (UNIDADES.some((u) => u.value === v)) return v;
  return LEGACY_UNIDADE[v] || v;
}

export function unidadeLabel(raw?: string | null): string {
  const v = unidadeValue(raw);
  return UNIDADES.find((u) => u.value === v)?.label ?? (raw || v);
}

export const FORMAS_PAGAMENTO_FRETE = [
  "PIX",
  "Dinheiro",
  "Transferência Bancária",
  "Boleto",
  "Outro",
] as const;

export const PIX_TIPOS = [
  { id: "cpf", label: "CPF" },
  { id: "cnpj", label: "CNPJ" },
  { id: "celular", label: "Celular" },
  { id: "email", label: "E-mail" },
  { id: "aleatoria", label: "Chave aleatória" },
] as const;

export type PixTipo = (typeof PIX_TIPOS)[number]["id"];

export function pixTipoLabel(id?: string | null) {
  return PIX_TIPOS.find((x) => x.id === id)?.label ?? "";
}

export const EMPRESA = {
  nomeCurto: "JG GARCIA",
  razao: "JG IRAJÁ FRUTAS E LEGUMES LTDA",
  cnpj: "51.673.492/0001-17",
  logradouro: "Avenida Brasil, 19.001",
  bairro: "Irajá — Rio de Janeiro/RJ",
  cep: "21530-900",
} as const;

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
  { id: "ajuste", label: "Ajuste de estoque" },
  { id: "outro", label: "Outro" },
] as const;

export type ContagemMotivoId = (typeof MOTIVOS_CONTAGEM)[number]["id"] | "conferencia";

export function motivoContagemLabel(id?: string | null) {
  if (!id) return "—";
  if (id === "conferencia") return "Bateu certo";
  return MOTIVOS_CONTAGEM.find((m) => m.id === id)?.label ?? id;
}