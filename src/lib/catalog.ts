import { inferTipoLugar } from "./constants";

export interface CatalogItem {
  codigo: string;
  nome: string;
  unidade: string;
  categoria: string;
  estoque: number;
  minimo: number;
  cor: string;
}

export function pavilhaoFromCategoria(categoria: string): string {
  if (categoria.includes("13")) return "p13";
  if (categoria.includes("23") || categoria === "Uvas") return "p23";
  if (categoria.includes("74") || categoria === "Verduras" || categoria.startsWith("Plataforma")) return "p74";
  if (categoria.includes("44")) return "p44";
  return "p11";
}

export const PAVILHAO_LOGOS: Record<string, string> = {
  p11: "/pavilhoes/p11.png",
  p13: "/pavilhoes/p13.png",
  p23: "/pavilhoes/p23.png",
  p44: "/pavilhoes/p44.png",
  p74: "/pavilhoes/p74.png",
};

export function logoOfPavilhao(p: { id?: string | null; codigo?: string | null } | null | undefined): string | undefined {
  if (!p) return undefined;
  if (p.id && PAVILHAO_LOGOS[p.id]) return PAVILHAO_LOGOS[p.id];
  const code = String(p.codigo || p.id || "").replace(/^p/i, "");
  const key = `p${code}`;
  return PAVILHAO_LOGOS[key];
}

export function pavIdsOf(m: { pavilhao_id?: string; pavilhao_ids?: string[] } | null | undefined): string[] {
  if (!m) return [];
  if (m.pavilhao_ids?.length) return m.pavilhao_ids.filter(Boolean);
  return m.pavilhao_id ? [m.pavilhao_id] : [];
}

export function pavilhaoNome(id?: string | null) {
  if (id === "p11") return "Pavilhão 11";
  if (id === "p13") return "Pavilhão 13";
  if (id === "p23") return "Pavilhão 23";
  if (id === "p44") return "Pavilhão 44";
  if (id === "p74") return "Galpão 74";
  return "—";
}

export function pavTipo(p: { codigo?: string; nome?: string; tipo?: string } | null | undefined): string {
  return inferTipoLugar(p);
}

export function pavTitle(p: { codigo: string; nome?: string; tipo?: string }) {
  const tipo = inferTipoLugar(p);
  const code = (p.codigo || "").trim();
  if (code) return `${tipo} ${code}`;
  return (p.nome || "").trim() || tipo;
}

export function lugarLabel(
  pavilhoes: { id: string; codigo: string; nome?: string; tipo?: string }[],
  raw?: string | null,
): string {
  if (!raw) return "—";
  const hit =
    pavilhoes.find((p) => p.id === raw || p.codigo === raw || p.nome === raw) ||
    (() => {
      const num = String(raw).match(/\b(11|13|23|44|74)\b/);
      return num ? pavilhoes.find((p) => p.codigo === num[1]) : undefined;
    })();
  return hit ? pavTitle(hit) : raw;
}

export function lugarDaSaida(
  pavilhoes: { id: string; codigo: string; nome?: string; tipo?: string }[],
  s: { pavilhao_id?: string | null; pavilhao?: string | null; origem?: string | null },
) {
  for (const raw of [s.pavilhao_id, s.pavilhao, s.origem]) {
    if (!raw) continue;
    const label = lugarLabel(pavilhoes, raw);
    const matched = pavilhoes.some((p) => pavTitle(p) === label || p.id === raw || p.codigo === raw || p.nome === raw);
    if (matched) return label;
  }
  return s.origem?.trim() || "—";
}

export function destinoDaSaida(
  pavilhoes: { id: string; codigo: string; nome?: string; tipo?: string }[],
  s: { destino_pavilhao_id?: string | null; destino?: { nome?: string } | null; destino_id?: string | null },
) {
  if (s.destino_pavilhao_id) {
    const label = lugarLabel(pavilhoes, s.destino_pavilhao_id);
    if (label && label !== "—") return label;
  }
  return s.destino?.nome?.trim() || "—";
}

export function isPavTransfer(s: { destino_pavilhao_id?: string | null } | null | undefined) {
  return Boolean(s?.destino_pavilhao_id);
}

export const CATALOG: CatalogItem[] = [
  { codigo: "0000020", nome: "Aipim Amarelo", unidade: "Caixa", categoria: "Comercialização", estoque: 0, minimo: 10, cor: "#e4c15a" },
  { codigo: "0000112", nome: "Caixa de Papelão Vazia", unidade: "Caixa", categoria: "Comercialização", estoque: 3140, minimo: 50, cor: "#c4a574" },
  { codigo: "0000570", nome: "Morcote", unidade: "Caixa", categoria: "Comercialização", estoque: 0, minimo: 8, cor: "#d8b56a" },

  { codigo: "0000009", nome: "Caju Ceará", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 1702, minimo: 40, cor: "#e07a3d" },
  { codigo: "0001600", nome: "Kiwi Cumbuca", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 156, minimo: 12, cor: "#7aa83a" },
  { codigo: "0001601", nome: "Kiwi Agranel", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 134, minimo: 12, cor: "#6f9a34" },
  { codigo: "0000251", nome: "Maçã Ácida", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 18, minimo: 10, cor: "#d94b4b" },
  { codigo: "0000201", nome: "Maçã Fuji Cat. 1", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 1932, minimo: 40, cor: "#e05656" },
  { codigo: "0000221", nome: "Maçã Fuji Cat. 3", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 0, minimo: 20, cor: "#c94a4a" },
  { codigo: "0000202", nome: "Maçã Gala Cat. 1", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 214, minimo: 30, cor: "#ef6b4a" },
  { codigo: "0000203", nome: "Maçã Gala Cat. 3", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 5000, minimo: 40, cor: "#e85d3c" },
  { codigo: "0000250", nome: "Maçã Importada", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 32, minimo: 10, cor: "#d64545" },
  { codigo: "0000200", nome: "Maçã Saco", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 2686, minimo: 40, cor: "#de4e4e" },
  { codigo: "0000400", nome: "Pera", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 154, minimo: 16, cor: "#c8d45a" },
  { codigo: "0000450", nome: "Pera 1/2 Caixa", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 0, minimo: 8, cor: "#b8c64e" },
  { codigo: "0000460", nome: "Pera Portuguesa", unidade: "Caixa", categoria: "Maçãs e peras", estoque: 100, minimo: 12, cor: "#d2dc6a" },

  { codigo: "0000150", nome: "Mamão Formosa", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 8, minimo: 20, cor: "#f0a12a" },
  { codigo: "0000100", nome: "Mamão Papaya", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 0, minimo: 20, cor: "#f08a2a" },
  { codigo: "0001370", nome: "Manga Palmer 18 kg", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 1872, minimo: 30, cor: "#e67a1a" },
  { codigo: "0001375", nome: "Manga Palmer 6 kg", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 0, minimo: 16, cor: "#d86e16" },
  { codigo: "0001350", nome: "Manga Tommy 18 kg", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 285, minimo: 24, cor: "#c45a18" },
  { codigo: "0000037", nome: "Melancia Baby", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 105, minimo: 10, cor: "#2f8f4a" },
  { codigo: "0000701", nome: "Melão Amarelo 13 kg", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 1717, minimo: 24, cor: "#f0c43a" },
  { codigo: "0000700", nome: "Melão Amarelo Rei", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 51, minimo: 10, cor: "#e6b82e" },
  { codigo: "0000706", nome: "Melão Dino", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 58, minimo: 8, cor: "#c9d85a" },
  { codigo: "0000703", nome: "Melão Famosa", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 146, minimo: 12, cor: "#ead45a" },
  { codigo: "0000704", nome: "Melão Orange", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 0, minimo: 8, cor: "#f0a040" },
  { codigo: "0000702", nome: "Melão Pele de Sapo", unidade: "Caixa", categoria: "Manga, melão e mamão", estoque: 431, minimo: 16, cor: "#8fbf4a" },

  { codigo: "0001702", nome: "Abacate Avocado", unidade: "Caixa", categoria: "Pavilhão 11", estoque: 89, minimo: 12, cor: "#3f7a32" },
  { codigo: "0001705", nome: "Abacate Breda", unidade: "Caixa", categoria: "Pavilhão 11", estoque: 607, minimo: 20, cor: "#4a8a38" },
  { codigo: "0001704", nome: "Abacate Margarida", unidade: "Caixa", categoria: "Pavilhão 11", estoque: 0, minimo: 16, cor: "#35682c" },
  { codigo: "0001900", nome: "Abacaxi Tipo 10", unidade: "Unidade", categoria: "Pavilhão 11", estoque: 4014, minimo: 80, cor: "#e6c04a" },
  { codigo: "0001915", nome: "Abacaxi Tipo 15", unidade: "Unidade", categoria: "Pavilhão 11", estoque: 0, minimo: 40, cor: "#d9b23e" },
  { codigo: "0001916", nome: "Abacaxi Tipo 16", unidade: "Unidade", categoria: "Pavilhão 11", estoque: 528, minimo: 30, cor: "#ccaa36" },
  { codigo: "0001561", nome: "Laranja Lima", unidade: "Caixa", categoria: "Pavilhão 11", estoque: 15, minimo: 12, cor: "#f0a020" },
  { codigo: "0001562", nome: "Laranja Saco", unidade: "Saco", categoria: "Pavilhão 11", estoque: 58, minimo: 16, cor: "#f08c14" },
  { codigo: "0003800", nome: "Laranja Seleta", unidade: "Caixa", categoria: "Pavilhão 11", estoque: 47, minimo: 12, cor: "#e67a10" },
  { codigo: "0000019", nome: "Limão", unidade: "Saco", categoria: "Pavilhão 11", estoque: 55, minimo: 16, cor: "#8fbf2a" },
  { codigo: "0000110", nome: "Mamão Papaya Tulipa", unidade: "Caixa", categoria: "Pavilhão 11", estoque: 551, minimo: 20, cor: "#f07828" },
  { codigo: "0001300", nome: "Manga Espada", unidade: "Caixa", categoria: "Pavilhão 11", estoque: 0, minimo: 12, cor: "#d46a18" },
  { codigo: "0001371", nome: "Manga Palmer Agranel", unidade: "Caixa", categoria: "Pavilhão 11", estoque: 0, minimo: 12, cor: "#c45e14" },
  { codigo: "0001351", nome: "Manga Tommy Agranel", unidade: "Caixa", categoria: "Pavilhão 11", estoque: 0, minimo: 12, cor: "#b45212" },
  { codigo: "0000710", nome: "Melão Amarelo Agranel", unidade: "Caixa", categoria: "Pavilhão 11", estoque: 265, minimo: 16, cor: "#ebc034" },
  { codigo: "0000600", nome: "Tangerina Ponkan", unidade: "Caixa", categoria: "Pavilhão 11", estoque: 2, minimo: 10, cor: "#f08a1c" },

  { codigo: "0000015", nome: "Alho", unidade: "Caixa", categoria: "Pavilhão 13", estoque: 1710, minimo: 24, cor: "#e8d9b0" },
  { codigo: "0000072", nome: "Batata Asterix", unidade: "Saco", categoria: "Pavilhão 13", estoque: 0, minimo: 16, cor: "#c46a3a" },
  { codigo: "0000076", nome: "Batata Calabresa", unidade: "Saco", categoria: "Pavilhão 13", estoque: 0, minimo: 10, cor: "#b85a32" },
  { codigo: "0000074", nome: "Batata Caroço", unidade: "Saco", categoria: "Pavilhão 13", estoque: 63, minimo: 12, cor: "#d4a05a" },
  { codigo: "0000058", nome: "Batata Lisa", unidade: "Saco", categoria: "Pavilhão 13", estoque: 0, minimo: 20, cor: "#e0c07a" },
  { codigo: "0000073", nome: "Batata Marquês", unidade: "Saco", categoria: "Pavilhão 13", estoque: 0, minimo: 10, cor: "#c9a056" },
  { codigo: "0000050", nome: "Cebola", unidade: "Saco", categoria: "Pavilhão 13", estoque: 438, minimo: 24, cor: "#f0d9a0" },
  { codigo: "0000051", nome: "Cebola Roxa", unidade: "Caixa", categoria: "Pavilhão 13", estoque: 23, minimo: 10, cor: "#8a4a8a" },
  { codigo: "0000003", nome: "Coco Seco Saco", unidade: "Caixa", categoria: "Pavilhão 13", estoque: 126, minimo: 12, cor: "#6b4a2a" },
  { codigo: "0000012", nome: "Ovo", unidade: "Caixa", categoria: "Pavilhão 13", estoque: 244, minimo: 20, cor: "#f2e2b8" },
  { codigo: "0001212", nome: "Ovo de Codorna", unidade: "Caixa", categoria: "Pavilhão 13", estoque: 6, minimo: 6, cor: "#e8d4a8" },
  { codigo: "0000016", nome: "Ovo PVC", unidade: "Caixa", categoria: "Pavilhão 13", estoque: 0, minimo: 10, cor: "#eee0c0" },
  { codigo: "0001202", nome: "Ovo PVC 30 Cartelas", unidade: "Caixa", categoria: "Pavilhão 13", estoque: 0, minimo: 8, cor: "#e6d8b4" },
  { codigo: "0000120", nome: "Ovo Vermelho", unidade: "Caixa", categoria: "Pavilhão 13", estoque: 3, minimo: 8, cor: "#e8c48a" },

  { codigo: "0000059", nome: "Brócolis", unidade: "Unidade", categoria: "Plataforma 1", estoque: 306, minimo: 24, cor: "#2f8a3a" },
  { codigo: "0000500", nome: "Morango", unidade: "Caixa", categoria: "Plataforma 1", estoque: 0, minimo: 20, cor: "#e23b4a" },

  { codigo: "0001500", nome: "Maracujá", unidade: "Caixa", categoria: "Plataforma 2", estoque: 2099, minimo: 30, cor: "#c8a032" },
  { codigo: "0001501", nome: "Maracujá Saco", unidade: "Saco", categoria: "Plataforma 2", estoque: 0, minimo: 16, cor: "#b8942c" },

  { codigo: "0000068", nome: "Abobrinha Italiana", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 12, cor: "#6aaa3a" },
  { codigo: "0002001", nome: "Aipim Branco", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 20, cor: "#e8d9b8" },
  { codigo: "0000130", nome: "Batata Baroa", unidade: "Caixa", categoria: "Verduras", estoque: 38, minimo: 12, cor: "#d4b06a" },
  { codigo: "0000138", nome: "Batata Baroa Bandeja", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 12, cor: "#c8a45e" },
  { codigo: "0000031", nome: "Batata Doce", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 16, cor: "#d47a48" },
  { codigo: "0003100", nome: "Batata Doce Roxa", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 8, cor: "#8a4a78" },
  { codigo: "0003102", nome: "Batata Doce Salmão", unidade: "Saco", categoria: "Verduras", estoque: 2, minimo: 8, cor: "#e08a62" },
  { codigo: "0003001", nome: "Batata Yacon", unidade: "Saco", categoria: "Verduras", estoque: 2, minimo: 6, cor: "#c8b888" },
  { codigo: "0000040", nome: "Berinjela", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 10, cor: "#5a3a78" },
  { codigo: "0000018", nome: "Beterraba", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 12, cor: "#a03248" },
  { codigo: "0002002", nome: "Cará", unidade: "Caixa", categoria: "Verduras", estoque: 23, minimo: 10, cor: "#dcc8a0" },
  { codigo: "0000035", nome: "Cenoura", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 16, cor: "#e87820" },
  { codigo: "0000043", nome: "Chuchu", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 10, cor: "#8fbf6a" },
  { codigo: "0000044", nome: "Gengibre", unidade: "Caixa", categoria: "Verduras", estoque: 27, minimo: 8, cor: "#d4b06a" },
  { codigo: "0000032", nome: "Inhame", unidade: "Saco", categoria: "Verduras", estoque: 0, minimo: 12, cor: "#c4b090" },
  { codigo: "0000888", nome: "Jiló", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 8, cor: "#6a8a38" },
  { codigo: "0000006", nome: "Milho", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 12, cor: "#f0c43a" },
  { codigo: "0000066", nome: "Milho Bandeja", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 10, cor: "#e6b82e" },
  { codigo: "0000041", nome: "Pepino", unidade: "Caixa", categoria: "Verduras", estoque: 1, minimo: 12, cor: "#4a9a3a" },
  { codigo: "0000045", nome: "Pepino Japonês", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 10, cor: "#3d8a32" },
  { codigo: "0000027", nome: "Pimentão Misto", unidade: "Caixa", categoria: "Verduras", estoque: 94, minimo: 12, cor: "#e0563a" },
  { codigo: "0000026", nome: "Pimentão Verde", unidade: "Caixa", categoria: "Verduras", estoque: 8, minimo: 10, cor: "#3d8f32" },
  { codigo: "0000023", nome: "Quiabo", unidade: "Caixa", categoria: "Verduras", estoque: 1, minimo: 8, cor: "#5a9a38" },
  { codigo: "0000046", nome: "Repolho Roxo", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 8, cor: "#6a3a78" },
  { codigo: "0000042", nome: "Repolho Verde", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 12, cor: "#4a8a3a" },
  { codigo: "0001003", nome: "Tomate Carmem", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 16, cor: "#d43a32" },
  { codigo: "0001004", nome: "Tomate Italiano", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 12, cor: "#c4322a" },
  { codigo: "0000010", nome: "Tomate Sweet Grape Kg", unidade: "Caixa", categoria: "Verduras", estoque: 5, minimo: 8, cor: "#e04a3a" },
  { codigo: "0000222", nome: "Tomate Sweet Uva 12 Bandejas", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 8, cor: "#d64038" },
  { codigo: "0000154", nome: "Vagem Manteiga", unidade: "Caixa", categoria: "Verduras", estoque: 0, minimo: 8, cor: "#6aaa3a" },

  { codigo: "0000560", nome: "Blueberry", unidade: "Caixa", categoria: "Exóticos", estoque: 168, minimo: 8, cor: "#3a4a8a" },
  { codigo: "0000049", nome: "Cacau", unidade: "Caixa", categoria: "Exóticos", estoque: 4, minimo: 4, cor: "#6b3a1a" },
  { codigo: "0000011", nome: "Carambola", unidade: "Caixa", categoria: "Exóticos", estoque: 17, minimo: 8, cor: "#e8c03a" },
  { codigo: "0000033", nome: "Figo", unidade: "Caixa", categoria: "Exóticos", estoque: 0, minimo: 6, cor: "#6a3a5a" },
  { codigo: "0000064", nome: "Graviola", unidade: "Caixa", categoria: "Exóticos", estoque: 0, minimo: 6, cor: "#8fbf6a" },
  { codigo: "0000005", nome: "Jabuticaba", unidade: "Caixa", categoria: "Exóticos", estoque: 9, minimo: 10, cor: "#3a2048" },
  { codigo: "0001602", nome: "Kiwi Importado Golden", unidade: "Caixa", categoria: "Exóticos", estoque: 3, minimo: 6, cor: "#c8c03a" },
  { codigo: "0000605", nome: "Physalis", unidade: "Caixa", categoria: "Exóticos", estoque: 8, minimo: 4, cor: "#f0a020" },
  { codigo: "0000089", nome: "Romã", unidade: "Caixa", categoria: "Exóticos", estoque: 8, minimo: 6, cor: "#b0323a" },
  { codigo: "0000070", nome: "Tâmara", unidade: "Caixa", categoria: "Exóticos", estoque: 37, minimo: 8, cor: "#6b3a18" },
  { codigo: "0000081", nome: "Tâmara 1 kg", unidade: "Caixa", categoria: "Exóticos", estoque: 5, minimo: 4, cor: "#5a3014" },
  { codigo: "0000080", nome: "Tâmara Bandeja", unidade: "Caixa", categoria: "Exóticos", estoque: 165, minimo: 10, cor: "#7a421c" },
  { codigo: "0000071", nome: "Tamarindo", unidade: "Caixa", categoria: "Exóticos", estoque: 18, minimo: 6, cor: "#6a4a28" },
  { codigo: "0000056", nome: "Temperos", unidade: "Unidade", categoria: "Exóticos", estoque: 5, minimo: 4, cor: "#3d8a4a" },
  { codigo: "0001001", nome: "Tomate Sweet Grape Bandeja", unidade: "Bandeja", categoria: "Exóticos", estoque: 0, minimo: 20, cor: "#d43c34" },

  { codigo: "0000802", nome: "Ameixa CBC", unidade: "Caixa", categoria: "Importados", estoque: 217, minimo: 12, cor: "#6a2a5a" },
  { codigo: "0000851", nome: "Ameixa D'Agen", unidade: "Caixa", categoria: "Importados", estoque: 0, minimo: 8, cor: "#5a2448" },
  { codigo: "0000850", nome: "Ameixa Importada", unidade: "Caixa", categoria: "Importados", estoque: 158, minimo: 12, cor: "#7a3268" },
  { codigo: "0000601", nome: "Tangerina Bergamota", unidade: "Caixa", categoria: "Importados", estoque: 687, minimo: 20, cor: "#f08a1c" },
  { codigo: "0001400", nome: "Goiaba", unidade: "Caixa", categoria: "Importados", estoque: 4, minimo: 10, cor: "#d45a6a" },
  { codigo: "0001401", nome: "Goiaba 18 kg", unidade: "Caixa", categoria: "Importados", estoque: 0, minimo: 8, cor: "#c44e5e" },
  { codigo: "0000038", nome: "Laranja Bahia Importada", unidade: "Caixa", categoria: "Importados", estoque: 11, minimo: 10, cor: "#f07810" },
  { codigo: "0000021", nome: "Limão Siciliano", unidade: "Caixa", categoria: "Importados", estoque: 109, minimo: 10, cor: "#d4d02a" },
  { codigo: "0001151", nome: "Pêssego Importado", unidade: "Caixa", categoria: "Importados", estoque: 52, minimo: 10, cor: "#f0905a" },
  { codigo: "0000602", nome: "Tangerina Importada", unidade: "Caixa", categoria: "Importados", estoque: 58, minimo: 10, cor: "#f07018" },

  { codigo: "0000333", nome: "Pitaya", unidade: "Caixa", categoria: "Uvas", estoque: 29, minimo: 8, cor: "#e0567a" },
  { codigo: "0000381", nome: "Uva Crimson Cumbuca 10x1", unidade: "Caixa", categoria: "Uvas", estoque: 809, minimo: 20, cor: "#8a2a5a" },
  { codigo: "0000301", nome: "Uva Itália 8 kg", unidade: "Caixa", categoria: "Uvas", estoque: 340, minimo: 16, cor: "#6aaa4a" },
  { codigo: "0000351", nome: "Uva Itália Cumbuca 10x1", unidade: "Caixa", categoria: "Uvas", estoque: 20, minimo: 10, cor: "#5a9a3e" },
  { codigo: "0000370", nome: "Uva Jubilee 8 kg", unidade: "Caixa", categoria: "Uvas", estoque: 0, minimo: 8, cor: "#3a6a8a" },
  { codigo: "0000303", nome: "Uva Núbia 8 kg", unidade: "Caixa", categoria: "Uvas", estoque: 506, minimo: 16, cor: "#4a2a6a" },
  { codigo: "0000393", nome: "Uva Núbia Cumbuca 10x1", unidade: "Caixa", categoria: "Uvas", estoque: 614, minimo: 16, cor: "#3a2058" },
  { codigo: "0000360", nome: "Uva Red Globe 8 kg", unidade: "Caixa", categoria: "Uvas", estoque: 73, minimo: 12, cor: "#a03248" },
  { codigo: "0001302", nome: "Uva Rosada", unidade: "Caixa", categoria: "Uvas", estoque: 39, minimo: 10, cor: "#d45a7a" },
  { codigo: "0001304", nome: "Uva Rosada Cumbuca 10x1", unidade: "Caixa", categoria: "Uvas", estoque: 105, minimo: 12, cor: "#c44e6e" },
  { codigo: "0000350", nome: "Uva Sem Semente 8 kg", unidade: "Caixa", categoria: "Uvas", estoque: 107, minimo: 12, cor: "#6a2a58" },
  { codigo: "0000353", nome: "Uva Sem Semente Cumbuca 10x1", unidade: "Caixa", categoria: "Uvas", estoque: 12121, minimo: 40, cor: "#5a2448" },
  { codigo: "0000355", nome: "Uva Vitória Cumbuca 10x1", unidade: "Caixa", categoria: "Uvas", estoque: 1622, minimo: 24, cor: "#4a1e3e" },
];
