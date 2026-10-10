import { destinoDaSaida, lugarDaSaida, pavTitle } from "./catalog";
import { fold } from "./utils";
import type { Destino, Pavilhao, Saida, Usuario } from "./types";

export interface SaidaLinha {
  id: string;
  data: string;
  hora: string;
  pavilhaoId: string;
  pavilhao: string;
  pavilhaoCodigo: string;
  mercadoriaId: string;
  mercadoria: string;
  codigo: string;
  familia: string;
  variedade: string;
  pallets: number | null;
  porPallet: number | null;
  total: number;
  unidade: string;
  destino: string;
  destinoId: string;
  cliente: string;
  usuario: string;
  usuarioId: string;
  documento: string;
  raw: Saida;
}

export interface FiltroSaidas {
  de: string;
  ate: string;
  pav: string;
  mercadoriaId: string;
  /** Rótulo do produto escolhido. A filtragem usa mercadoriaId. */
  mercadoria: string;
  destino: string;
  cliente: string;
  usuario: string;
}

export interface GrupoMercadoria {
  key: string;
  nome: string;
  familia: string;
  variedade: string;
  unidade: string;
  pallets: number | null;
  porPallet: number | null;
  total: number;
  linhas: SaidaLinha[];
}

export interface GrupoPavilhao {
  key: string;
  nome: string;
  unidade: string;
  pallets: number | null;
  total: number;
  produtos: GrupoMercadoria[];
}

export function partirNome(nome: string): { familia: string; variedade: string } {
  const clean = nome.trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { familia: clean, variedade: "" };
  return { familia: parts[0], variedade: parts.slice(1).join(" ") };
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Total stays the registered quantity unless the exit already stores pallets × volumes. */
export function medidasSaida(s: Saida): { pallets: number | null; porPallet: number | null; total: number } {
  const pallets = num(s.pallets);
  const porPallet = num(s.volumes_pallet);
  if (pallets != null && porPallet != null) {
    return { pallets, porPallet, total: Math.round(pallets * porPallet * 1000) / 1000 };
  }
  return { pallets, porPallet, total: Number(s.quantidade) || 0 };
}

export function linhaDeSaida(s: Saida, pavilhoes: Pavilhao[], destinos: Destino[], usuarios: Usuario[]): SaidaLinha {
  const nome = s.mercadoria?.nome || "Produto";
  const partes = partirNome(nome);
  const medidas = medidasSaida(s);
  const pavId = s.pavilhao_id || s.pavilhao || "";
  const pav = pavilhoes.find((p) => p.id === pavId || p.codigo === pavId || p.nome === pavId || pavTitle(p) === s.origem);
  const destinoId = s.destino_pavilhao_id || s.destino_id || "";
  const clienteNome = s.destino_pavilhao_id ? "" : s.destino?.nome || destinos.find((d) => d.id === s.destino_id)?.nome || "";
  const usuario = s.usuario?.nome || usuarios.find((u) => u.id === s.usuario_id)?.nome || "";
  return {
    id: s.id,
    data: s.data,
    hora: (s.hora_saida || "").slice(0, 5),
    pavilhaoId: pav?.id || pavId,
    pavilhao: lugarDaSaida(pavilhoes, s),
    pavilhaoCodigo: pav?.codigo || "",
    mercadoriaId: s.mercadoria_id,
    mercadoria: nome,
    codigo: s.mercadoria?.codigo || "",
    familia: partes.familia,
    variedade: partes.variedade,
    pallets: medidas.pallets,
    porPallet: medidas.porPallet,
    total: medidas.total,
    unidade: s.unidade || "Caixa",
    destino: destinoDaSaida(pavilhoes, s),
    destinoId,
    cliente: clienteNome,
    usuario,
    usuarioId: s.usuario_id || "",
    documento: (s.codigo || "").trim(),
    raw: s,
  };
}

function hit(text: string, term: string) {
  const q = fold(term.trim());
  if (!q) return true;
  return fold(text).includes(q);
}

export function filtrarSaidas(linhas: SaidaLinha[], filtro: FiltroSaidas): SaidaLinha[] {
  return linhas.filter((r) => {
    if (filtro.de && r.data < filtro.de) return false;
    if (filtro.ate && r.data > filtro.ate) return false;
    if (filtro.pav && filtro.pav !== "todos" && r.pavilhaoId !== filtro.pav && r.pavilhaoCodigo !== filtro.pav) return false;
    if (filtro.mercadoriaId && r.mercadoriaId !== filtro.mercadoriaId) return false;
    if (filtro.destino && filtro.destino !== "todos" && r.destinoId !== filtro.destino && fold(r.destino) !== fold(filtro.destino)) return false;
    if (filtro.cliente.trim() && !hit(r.cliente, filtro.cliente)) return false;
    if (filtro.usuario && filtro.usuario !== "todos" && r.usuarioId !== filtro.usuario && fold(r.usuario) !== fold(filtro.usuario)) return false;
    return true;
  });
}

/** Código ou nome de um produto já cadastrado. Não cria mercadoria. */
export function mercadoriaCombina(item: { codigo: string; nome: string }, termo: string) {
  const q = fold(termo.trim());
  if (!q) return true;
  const nome = fold(item.nome);
  const codigo = fold(item.codigo);
  const semZero = (s: string) => s.replace(/^0+/, "");
  const qCurto = semZero(q);
  return nome.includes(q) || codigo.includes(q) || (qCurto.length > 0 && semZero(codigo).includes(qCurto));
}

export function pesquisaRapida(linhas: SaidaLinha[], q: string): SaidaLinha[] {
  const term = fold(q.trim());
  if (!term) return linhas;
  return linhas.filter((r) => {
    const blob = fold(`${r.mercadoria} ${r.familia} ${r.variedade} ${r.codigo}`);
    if (blob.includes(term)) return true;
    const nome = fold(r.mercadoria);
    return nome.length > 1 && term.includes(nome);
  });
}

function somaPallets(linhas: SaidaLinha[]): number | null {
  if (!linhas.length || linhas.some((r) => r.pallets == null)) return null;
  return linhas.reduce((a, r) => a + (r.pallets || 0), 0);
}

function porPalletUnico(linhas: SaidaLinha[]): number | null {
  const vals = linhas.map((r) => r.porPallet).filter((n): n is number => n != null);
  if (!vals.length || vals.length !== linhas.length) return null;
  return vals.every((n) => n === vals[0]) ? vals[0] : null;
}

function unidadeDe(linhas: SaidaLinha[]) {
  const units = [...new Set(linhas.map((r) => r.unidade).filter(Boolean))];
  return units.length === 1 ? units[0] : "volumes";
}

export function agruparMercadoria(linhas: SaidaLinha[]): GrupoMercadoria[] {
  const map = new Map<string, SaidaLinha[]>();
  for (const r of linhas) {
    const key = r.mercadoriaId || fold(r.mercadoria);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, rows]) => {
      const first = rows[0];
      return {
        key,
        nome: first.mercadoria,
        familia: first.familia,
        variedade: first.variedade,
        unidade: unidadeDe(rows),
        pallets: somaPallets(rows),
        porPallet: porPalletUnico(rows),
        total: rows.reduce((a, r) => a + r.total, 0),
        linhas: rows.slice().sort((a, b) => b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora)),
      };
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function agruparPavilhao(linhas: SaidaLinha[]): GrupoPavilhao[] {
  const map = new Map<string, SaidaLinha[]>();
  for (const r of linhas) {
    const key = r.pavilhaoId || r.pavilhao;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, rows]) => ({
      key,
      nome: rows[0]?.pavilhao || "Sem pavilhão",
      unidade: unidadeDe(rows),
      pallets: somaPallets(rows),
      total: rows.reduce((a, r) => a + r.total, 0),
      produtos: agruparMercadoria(rows),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface FamiliaResumo {
  nome: string;
  unidade: string;
  total: number;
  variedades: { nome: string; total: number; unidade: string }[];
}

export function resumoFamilia(linhas: SaidaLinha[], termo: string): FamiliaResumo | null {
  const q = fold(termo.trim());
  if (!q || linhas.length < 2) return null;
  const families = new Map<string, SaidaLinha[]>();
  for (const r of linhas) {
    if (!fold(r.familia).includes(q) && !fold(r.mercadoria).startsWith(q)) continue;
    const list = families.get(fold(r.familia)) ?? [];
    list.push(r);
    families.set(fold(r.familia), list);
  }
  if (families.size !== 1) return null;
  const rows = [...families.values()][0];
  const grupos = agruparMercadoria(rows);
  if (grupos.length < 2) return null;
  return {
    nome: rows[0].familia,
    unidade: unidadeDe(rows),
    total: rows.reduce((a, r) => a + r.total, 0),
    variedades: grupos.map((g) => ({ nome: g.variedade || g.nome, total: g.total, unidade: g.unidade })),
  };
}

export function totais(linhas: SaidaLinha[]) {
  return {
    saidas: linhas.length,
    pallets: somaPallets(linhas),
    volumes: linhas.reduce((a, r) => a + r.total, 0),
    unidade: unidadeDe(linhas),
  };
}
