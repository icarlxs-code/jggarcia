import type {
  AuditAcao,
  AuditEntidade,
  AuditLog,
  Atalho,
  AtalhoKind,
  Contagem,
  Destino,
  Empilhador,
  Fornecedor,
  FreteInput,
  FretePagamento,
  Lote,
  Mercadoria,
  MovimentoStatus,
  NivelAcesso,
  Pavilhao,
  Saida,
  SaidaInput,
  StockAlert,
  Usuario,
} from "./types";
import { calcTransportTime, isoDaysAgo, todayISO } from "./format";
import { CATALOG, logoOfPavilhao, pavilhaoFromCategoria, pavilhaoNome, pavTitle } from "./catalog";
import { inferTipoLugar } from "./constants";
import { arrivalStamp, nextMovCodigo } from "./movement";

const KEY = "jg-garcia-db-v3";
const BAK_KEY = "jg-garcia-db-v3-bak";
const OUTBOX_KEY = "jg-garcia-outbox";
const SESSION_KEY = "jg-garcia-session-v2";
const SESSION_TAB_KEY = "jg-garcia-session-tab";
const REMEMBER_KEY = "jg-garcia-remember-v1";

const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
const OP_ID = "00000000-0000-0000-0000-000000000002";

let gen = 0;
const listeners = new Set<() => void>();
function emit() {
  gen += 1;
  for (const l of listeners) l();
}
export function subscribeDb(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getDbGen() {
  return gen;
}

interface Session {
  user_id: string;
}

interface LocalDb {
  usuarios: Usuario[];
  mercadorias: Mercadoria[];
  destinos: Destino[];
  fornecedores: Fornecedor[];
  pavilhoes: Pavilhao[];
  lotes: Lote[];
  saidas: Saida[];
  logs: AuditLog[];
  contagens: Contagem[];
  contadores: string[];
  atalhos: Atalho[];
  operadores: string[];
  empilhadeiras: string[];
  empilhadoresPessoas: Empilhador[];
  fretes: FretePagamento[];
  senhas: Record<string, string>;
  apagados: string[];
  stockResetAt?: string | null;
  stockIgnoredDates?: string[];
}

let memoryDb: LocalDb | null = null;
let memorySession: string | null = null;
let cloudReady = false;
let pushTimer = 0;

function uid() {
  return crypto.randomUUID();
}

function mergeNamedPeople(a: Empilhador[] = [], b: Empilhador[] = []): Empilhador[] {
  const map = new Map<string, Empilhador>();
  const byName = new Map<string, Empilhador>();
  for (const row of [...a, ...b]) {
    if (!row?.id && !row?.nome) continue;
    const prev = (row.id && map.get(row.id)) || byName.get((row.nome || "").toLowerCase());
    if (!prev) {
      map.set(row.id, row);
      if (row.nome) byName.set(row.nome.toLowerCase(), row);
      continue;
    }
    const stamp = (x: Empilhador) => x.updated_at || x.deleted_at || x.created_at || "";
    const newer = stamp(row) >= stamp(prev) ? { ...prev, ...row, id: prev.id } : { ...row, ...prev, id: prev.id };
    map.set(prev.id, newer);
    if (newer.nome) byName.set(newer.nome.toLowerCase(), newer);
  }
  return [...map.values()];
}

function rememberOperador(store: LocalDb, nome?: string | null) {
  const n = (nome || "").trim();
  if (!n) return;
  store.operadores = rememberList(store.operadores, n);
  const people = store.empilhadoresPessoas ?? [];
  const key = n.toLowerCase();
  const hit = people.find((e) => e.nome.toLowerCase() === key);
  const stamp = nowIso();
  if (hit) {
    hit.deleted_at = null;
    hit.updated_at = stamp;
    hit.nome = n;
    store.empilhadoresPessoas = people;
    return;
  }
  people.push({ id: uid(), nome: n, created_at: stamp, updated_at: stamp, deleted_at: null });
  store.empilhadoresPessoas = people;
}

function nextFreteNumero(rows: FretePagamento[]): string {
  let max = 0;
  for (const r of rows) {
    if (r.deleted_at) continue;
    const n = parseInt(String(r.numero || "").replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(6, "0");
}

function rememberList(list: string[] | undefined, nome?: string | null) {
  const n = (nome || "").trim();
  if (!n) return list ?? [];
  const next = list ?? [];
  if (next.some((x) => x.toLowerCase() === n.toLowerCase())) return next;
  return [...next, n].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function atalhoKey(a: Pick<Atalho, "kind" | "origem_pavilhao_id" | "destino_pavilhao_id" | "destino_id" | "mercadoria_id">) {
  return [a.kind, a.origem_pavilhao_id || "", a.destino_pavilhao_id || "", a.destino_id || "", a.mercadoria_id || ""].join("|");
}

function mergeAtalhos(a: Atalho[] = [], b: Atalho[] = []): Atalho[] {
  const map = new Map<string, Atalho>();
  for (const row of [...a, ...b]) {
    if (!row?.id) continue;
    const prev = map.get(row.id);
    if (!prev) {
      map.set(row.id, row);
      continue;
    }
    const stamp = (x: Atalho) => x.updated_at || x.deleted_at || x.created_at || "";
    const newer = stamp(row) >= stamp(prev) ? { ...prev, ...row } : { ...row, ...prev };
    newer.usos = Math.max(prev.usos || 0, row.usos || 0);
    map.set(row.id, newer);
  }
  return [...map.values()];
}

function nowIso() {
  return new Date().toISOString();
}

function canStore() {
  try {
    localStorage.setItem("__jg_probe", "1");
    localStorage.removeItem("__jg_probe");
    return true;
  } catch {
    return false;
  }
}

function catalogRows(): Mercadoria[] {
  return CATALOG.map((p) => ({
    id: `m-${p.codigo}`,
    codigo: p.codigo,
    nome: p.nome,
    unidade: p.unidade,
    status: true,
    created_at: nowIso(),
    estoque: p.estoque,
    minimo: p.minimo,
    cor: p.cor,
    categoria: p.categoria,
    pavilhao_id: pavilhaoFromCategoria(p.categoria),
    pavilhao_ids: [pavilhaoFromCategoria(p.categoria)],
  }));
}

function ensureCatalog(store: LocalDb): boolean {
  let changed = false;
  const byCode = new Map(store.mercadorias.map((m) => [m.codigo, m]));
  for (const p of CATALOG) {
    const row = byCode.get(p.codigo);
    if (!row) {
      store.mercadorias.push({
        id: `m-${p.codigo}`,
        codigo: p.codigo,
        nome: p.nome,
        unidade: p.unidade,
        status: true,
        created_at: nowIso(),
        estoque: p.estoque,
        minimo: p.minimo,
        cor: p.cor,
        categoria: p.categoria,
        pavilhao_id: pavilhaoFromCategoria(p.categoria),
        pavilhao_ids: [pavilhaoFromCategoria(p.categoria)],
      });
      changed = true;
    } else {
      if (!row.pavilhao_ids?.length) {
        row.pavilhao_ids = row.pavilhao_id ? [row.pavilhao_id] : [pavilhaoFromCategoria(p.categoria)];
        if (!row.pavilhao_id) row.pavilhao_id = row.pavilhao_ids[0];
        changed = true;
      }
    }
  }
  return changed;
}

function isCustomLogo(logo?: string | null) {
  return Boolean(logo && (logo.startsWith("data:") || logo.startsWith("blob:")));
}

function ensurePavLogos(store: LocalDb): boolean {
  let changed = false;
  const seeded = seed().pavilhoes;
  for (const row of seeded) {
    const hit = store.pavilhoes.find((p) => p.id === row.id || p.codigo === row.codigo);
    if (!hit) {
      store.pavilhoes.push({ ...row });
      changed = true;
    }
  }
  for (const p of store.pavilhoes) {
    if (!p.tipo) {
      p.tipo = inferTipoLugar(p);
      changed = true;
    }
    if (isCustomLogo(p.logo)) continue;
    const logo = logoOfPavilhao(p);
    if (logo && p.logo !== logo) {
      p.logo = logo;
      changed = true;
    }
    if (p.id === "p74" && p.nome === "Pavilhão 74") {
      p.nome = "Galpão 74";
      p.tipo = "Galpão";
      changed = true;
    }
  }
  return changed;
}

function seed(): LocalDb {
  return {
    usuarios: [
      {
        id: ADMIN_ID,
        nome: "Administrador",
        email: "admin@jggarcia.com.br",
        nivel_acesso: "admin",
        status: true,
        created_at: nowIso(),
      },
      {
        id: OP_ID,
        nome: "Operador",
        email: "operador@jggarcia.com.br",
        nivel_acesso: "operador",
        status: true,
        created_at: nowIso(),
      },
    ],
    mercadorias: catalogRows(),
    destinos: [],
    fornecedores: [],
    pavilhoes: [
      { id: "p11", codigo: "11", nome: "Pavilhão 11", tipo: "Pavilhão", ativo: true, logo: "/pavilhoes/p11.png" },
      { id: "p13", codigo: "13", nome: "Pavilhão 13", tipo: "Pavilhão", ativo: true, logo: "/pavilhoes/p13.png" },
      { id: "p23", codigo: "23", nome: "Pavilhão 23", tipo: "Pavilhão", ativo: true, logo: "/pavilhoes/p23.png" },
      { id: "p44", codigo: "44", nome: "Pavilhão 44", tipo: "Pavilhão", ativo: true, logo: "/pavilhoes/p44.png" },
      { id: "p74", codigo: "74", nome: "Galpão 74", tipo: "Galpão", ativo: true, logo: "/pavilhoes/p74.png" },
    ],
    lotes: [],
    saidas: [],
    logs: [],
    contagens: [],
    contadores: [],
    atalhos: [],
    operadores: [],
    empilhadeiras: [],
    empilhadoresPessoas: [],
    fretes: [],
    senhas: { [ADMIN_ID]: "Jg@2026", [OP_ID]: "Op@2026" },
    apagados: [],
    stockIgnoredDates: [],
  };
}

function snapshotOf(data: LocalDb) {
  return {
    usuarios: [] as Usuario[],
    mercadorias: data.mercadorias,
    destinos: data.destinos,
    fornecedores: data.fornecedores,
    pavilhoes: data.pavilhoes,
    lotes: data.lotes,
    saidas: data.saidas,
    logs: data.logs,
    contagens: data.contagens ?? [],
    contadores: data.contadores ?? [],
    atalhos: data.atalhos ?? [],
    operadores: data.operadores ?? [],
    empilhadeiras: data.empilhadeiras ?? [],
    empilhadoresPessoas: data.empilhadoresPessoas ?? [],
    fretes: data.fretes ?? [],
    stockResetAt: data.stockResetAt ?? null,
    stockIgnoredDates: data.stockIgnoredDates ?? [],
  };
}

function applyCloud(data: LocalDb, remote: Partial<ReturnType<typeof snapshotOf>> & { stockResetAt?: string | null }) {
  const by = <T extends { id: string }>(a: T[], b: T[]) => {
    const map = new Map(a.map((x) => [x.id, x]));
    for (const row of b) {
      const prev = map.get(row.id);
      map.set(row.id, prev ? { ...prev, ...row } : row);
    }
    return [...map.values()];
  };
  const mercMap = new Map(data.mercadorias.map((m) => [m.id, m]));
  for (const row of remote.mercadorias ?? []) {
    const prev = mercMap.get(row.id) ?? [...mercMap.values()].find((x) => x.codigo === row.codigo);
    if (!prev) mercMap.set(row.id, row);
    else {
      mercMap.set(prev.id, {
        ...prev,
        ...row,
        id: prev.id,
      });
    }
  }
  data.mercadorias = [...mercMap.values()];
  data.destinos = by(data.destinos, remote.destinos ?? []);
  data.fornecedores = by(data.fornecedores, remote.fornecedores ?? []);
  data.pavilhoes = by(data.pavilhoes, remote.pavilhoes ?? []);
  ensurePavLogos(data);
  data.lotes = by(data.lotes, remote.lotes ?? []);
  data.saidas = by(data.saidas, remote.saidas ?? []);
  data.logs = by(data.logs, remote.logs ?? []).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  data.contagens = by(data.contagens ?? [], (remote as { contagens?: Contagem[] }).contagens ?? []);
  const remoteNames = (remote as { contadores?: string[] }).contadores ?? [];
  data.contadores = [...new Set([...(data.contadores ?? []), ...remoteNames])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
  data.atalhos = mergeAtalhos(data.atalhos ?? [], (remote as { atalhos?: Atalho[] }).atalhos ?? []);
  data.operadores = [...new Set([...(data.operadores ?? []), ...((remote as { operadores?: string[] }).operadores ?? [])])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
  data.empilhadeiras = [...new Set([...(data.empilhadeiras ?? []), ...((remote as { empilhadeiras?: string[] }).empilhadeiras ?? [])])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
  data.empilhadoresPessoas = mergeNamedPeople(data.empilhadoresPessoas ?? [], (remote as { empilhadoresPessoas?: Empilhador[] }).empilhadoresPessoas ?? []);
  data.fretes = by(data.fretes ?? [], (remote as { fretes?: FretePagamento[] }).fretes ?? []);
  const remoteReset = (remote as { stockResetAt?: string | null }).stockResetAt;
  if (remoteReset && (!data.stockResetAt || remoteReset > data.stockResetAt)) data.stockResetAt = remoteReset;
  const remoteIgnored = (remote as { stockIgnoredDates?: string[] }).stockIgnoredDates ?? [];
  data.stockIgnoredDates = [...new Set([...(data.stockIgnoredDates ?? []), ...remoteIgnored])].sort();
  recomputeStock(data);
}

function countsForStock(store: LocalDb, data: string | undefined, createdAt: string | undefined, upto?: string) {
  if (upto && data && data > upto) return false;
  const ignored = store.stockIgnoredDates || [];
  if (data && ignored.includes(data) && data !== upto) return false;
  if (store.stockResetAt && (createdAt || "") <= store.stockResetAt) {
    if (!upto) return false;
    const resetDay = store.stockResetAt.slice(0, 10);
    if (upto > resetDay) return false;
  }
  return true;
}

function recomputeStock(data: LocalDb) {
  const qty = new Map<string, number>();
  const movedSaida = new Set<string>();
  const lastCount = new Map<string, { at: string; contado: number }>();
  for (const s of data.saidas) {
    if (s.deleted_at) continue;
    if (!countsForStock(data, s.data, s.created_at)) continue;
    const sign = companySign(s);
    if (!sign) continue;
    qty.set(s.mercadoria_id, (qty.get(s.mercadoria_id) || 0) + sign * Number(s.quantidade || 0));
    movedSaida.add(s.mercadoria_id);
  }
  for (const c of data.contagens ?? []) {
    if (c.deleted_at) continue;
    if (!countsForStock(data, c.data, c.created_at)) continue;
    qty.set(c.mercadoria_id, (qty.get(c.mercadoria_id) || 0) + Number(c.delta || 0));
    const key = `${c.mercadoria_id}\t${c.pavilhao_id}`;
    const prev = lastCount.get(key);
    if (!prev || c.created_at > prev.at) lastCount.set(key, { at: c.created_at, contado: Number(c.contado || 0) });
  }
  const countedTotal = new Map<string, number>();
  for (const [key, row] of lastCount) {
    const mercId = key.slice(0, key.indexOf("\t"));
    countedTotal.set(mercId, (countedTotal.get(mercId) || 0) + row.contado);
  }
  const catalogEstoque = new Map(CATALOG.map((p) => [p.codigo, p.estoque]));
  const since = data.stockResetAt || "";
  for (const m of data.mercadorias) {
    if (movedSaida.has(m.id) || since) {
      m.estoque = Math.max(0, qty.get(m.id) || 0);
      continue;
    }
    if (qty.has(m.id) && catalogEstoque.has(m.codigo)) {
      m.estoque = Math.max(0, Number(catalogEstoque.get(m.codigo) || 0) + (qty.get(m.id) || 0));
      continue;
    }
    const counted = countedTotal.get(m.id);
    if (counted != null && Number(m.estoque || 0) < counted) m.estoque = counted;
  }
  if (since) {
    for (const l of data.lotes) l.quantidade = 0;
    for (const s of data.saidas) {
      if (s.deleted_at || !s.lote_codigo) continue;
      if (!countsForStock(data, s.data, s.created_at)) continue;
      const lote = data.lotes.find((l) => l.codigo === s.lote_codigo && l.mercadoria_id === s.mercadoria_id);
      if (!lote) continue;
      const sign = movementSign(s);
      if (!sign) continue;
      lote.quantidade = Math.max(0, lote.quantidade + sign * Number(s.quantidade || 0));
    }
  }
}

function parseDb(raw: string | null): LocalDb | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocalDb;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.usuarios)) parsed.usuarios = [];
    if (!parsed.senhas || typeof parsed.senhas !== "object") parsed.senhas = {};
    if (!Array.isArray(parsed.mercadorias)) parsed.mercadorias = [];
    if (!Array.isArray(parsed.destinos)) parsed.destinos = [];
    if (!Array.isArray(parsed.fornecedores)) parsed.fornecedores = [];
    if (!Array.isArray(parsed.pavilhoes)) parsed.pavilhoes = [];
    if (!Array.isArray(parsed.lotes)) parsed.lotes = [];
    if (!Array.isArray(parsed.saidas)) parsed.saidas = [];
    if (!Array.isArray(parsed.logs)) parsed.logs = [];
    parsed.contagens = parsed.contagens ?? [];
    parsed.contadores = parsed.contadores ?? [];
    parsed.atalhos = parsed.atalhos ?? [];
    parsed.operadores = parsed.operadores ?? [];
    parsed.empilhadeiras = parsed.empilhadeiras ?? [];
    parsed.empilhadoresPessoas = parsed.empilhadoresPessoas ?? [];
    parsed.fretes = parsed.fretes ?? [];
    parsed.apagados = parsed.apagados ?? [];
    for (const m of parsed.mercadorias) {
      if (!m.pavilhao_ids?.length && m.pavilhao_id) m.pavilhao_ids = [m.pavilhao_id];
    }
    ensureCatalog(parsed);
    ensurePavLogos(parsed);
    return parsed;
  } catch {
    return null;
  }
}

function load(): LocalDb {
  if (memoryDb) return memoryDb;
  if (typeof window === "undefined") {
    memoryDb = seed();
    return memoryDb;
  }
  const parsed = parseDb(localStorage.getItem(KEY)) || parseDb(localStorage.getItem(BAK_KEY));
  memoryDb = parsed || seed();
  memoryDb.empilhadoresPessoas = memoryDb.empilhadoresPessoas ?? [];
  memoryDb.fretes = memoryDb.fretes ?? [];
  const before = memoryDb.mercadorias.map((m) => m.estoque).join("\n");
  const changed = ensureCatalog(memoryDb) || ensurePavLogos(memoryDb);
  recomputeStock(memoryDb);
  const repaired = memoryDb.mercadorias.map((m) => m.estoque).join("\n") !== before;
  if (changed || repaired) saveLocal(memoryDb);
  return memoryDb;
}

function queuePush(data: LocalDb) {
  if (typeof window === "undefined" || !cloudReady) return;
  const payload = snapshotOf(data);
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    void import("./cloud")
      .then(({ pushCloudStore }) => pushCloudStore({ data: { payload } }))
      .then(() => {
        try {
          localStorage.removeItem(OUTBOX_KEY);
        } catch {
          /* keep as extra backup if needed */
        }
      })
      .catch(() => undefined);
  }, 250);
}

export async function hydrateFromCloud() {
  if (typeof window === "undefined") return;
  try {
    const { pullCloudStore } = await import("./cloud");
    const remote = await pullCloudStore({ data: {} });
    if (remote) {
      const data = load();
      applyCloud(data, remote);
      memoryDb = data;
      saveLocal(data);
      emit();
    }
  } catch {
    /* offline */
  } finally {
    const first = !cloudReady;
    cloudReady = true;
    if (first && memoryDb) queuePush(memoryDb);
  }
}

function saveLocal(data: LocalDb) {
  if (!canStore()) return;
  const raw = JSON.stringify(data);
  try {
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(BAK_KEY, prev);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(KEY, raw);
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(snapshotOf(data)));
  } catch {
    try {
      localStorage.setItem(BAK_KEY, raw);
    } catch {
      /* memória cobre */
    }
  }
}

function save(data: LocalDb) {
  memoryDb = data;
  saveLocal(data);
  queuePush(data);
}

function mutate(fn: (data: LocalDb) => void): LocalDb {
  const current = load();
  const data = JSON.parse(JSON.stringify(current)) as LocalDb;
  fn(data);
  save(data);
  emit();
  return data;
}

function attachSaida(data: LocalDb, s: Saida): Saida {
  const merc = data.mercadorias.find((m) => m.id === s.mercadoria_id);
  const destPavId = resolvePavilhaoId(data.pavilhoes, s.destino_pavilhao_id);
  const destPav = destPavId ? data.pavilhoes.find((p) => p.id === destPavId) : null;
  const dest = destPav
    ? { id: destPav.id, nome: pavTitle(destPav) }
    : data.destinos.find((d) => d.id === s.destino_id);
  const user = data.usuarios.find((u) => u.id === s.usuario_id);
  return {
    ...s,
    mercadoria: merc ? { id: merc.id, codigo: merc.codigo, nome: merc.nome } : null,
    destino: dest ? { id: dest.id, nome: dest.nome } : s.destino,
    usuario: user ? { id: user.id, nome: user.nome } : null,
  };
}

export function stockAlert(m: Mercadoria): StockAlert {
  if (m.estoque <= m.minimo * 0.2) return "critico";
  if (m.estoque <= m.minimo * 0.5) return "baixo";
  if (m.estoque <= m.minimo) return "atencao";
  return "ok";
}

export function loteStatus(validade: string): "ok" | "a_vencer" | "vencido" {
  const today = todayISO();
  if (validade < today) return "vencido";
  const limit = isoDaysAgo(-7);
  if (validade <= limit) return "a_vencer";
  return "ok";
}

function actorOf(store: LocalDb, usuarioId?: string) {
  const id = usuarioId || memorySession;
  const user = store.usuarios.find((u) => u.id === id);
  return { id: user?.id ?? "sistema", nome: user?.nome ?? "Sistema" };
}

function addLog(
  store: LocalDb,
  input: {
    acao: AuditAcao;
    entidade: AuditEntidade;
    entidade_id: string;
    resumo: string;
    detalhe?: string;
    usuario_id?: string;
    created_at?: string;
  },
) {
  const who = actorOf(store, input.usuario_id);
  store.logs.unshift({
    id: uid(),
    created_at: input.created_at ?? nowIso(),
    usuario_id: who.id,
    usuario_nome: who.nome,
    acao: input.acao,
    entidade: input.entidade,
    entidade_id: input.entidade_id,
    resumo: input.resumo,
    detalhe: input.detalhe,
  });
}

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolvePavilhaoId(pavilhoes: Pavilhao[], raw?: string | null): string | null {
  if (!raw) return null;
  const original = String(raw).trim();
  if (!original) return null;
  const s = norm(original);
  const stripped = s.replace(/^p/, "");
  const exact = pavilhoes.find((p) => p.id === original || norm(p.id) === s || norm(p.id) === stripped);
  if (exact) return exact.id;
  const byCode = pavilhoes.find(
    (p) =>
      norm(p.codigo) === s ||
      norm(p.codigo) === stripped ||
      norm(p.id) === `p${stripped}` ||
      `p${norm(p.codigo)}` === s,
  );
  if (byCode) return byCode.id;
  const num = s.match(/(11|13|23|44|74)/);
  if (num) {
    const hit = pavilhoes.find((p) => p.codigo === num[1] || p.id === `p${num[1]}` || norm(p.codigo) === num[1]);
    if (hit) return hit.id;
  }
  return (
    pavilhoes.find((p) => {
      const nome = norm(p.nome);
      const title = norm(pavTitle(p));
      return (
        s === nome ||
        s === title ||
        s.includes(nome) ||
        nome.includes(s) ||
        s.includes(title) ||
        title.includes(s) ||
        s.includes(`pav ${p.codigo}`) ||
        s.includes(`pavilhao ${p.codigo}`) ||
        s.includes(`galpao ${p.codigo}`)
      );
    })?.id ?? null
  );
}

function movementSign(s: Saida): number {
  if ((s.tipo ?? "saida") === "entrada") return 1;
  if (s.desconta_estoque === false) return 0;
  return -1;
}

function companySign(s: Saida): number {
  if (s.destino_pavilhao_id) return 0;
  return movementSign(s);
}

function pavOfMovement(store: LocalDb, s: Saida, merc?: Mercadoria | null): string | null {
  return (
    resolvePavilhaoId(store.pavilhoes, s.pavilhao_id) ||
    resolvePavilhaoId(store.pavilhoes, s.pavilhao) ||
    resolvePavilhaoId(store.pavilhoes, s.origem) ||
    merc?.pavilhao_id ||
    null
  );
}

function stockMapFor(store: LocalDb, mercadoriaId: string, upto?: string): Map<string, number> {
  const merc = store.mercadorias.find((m) => m.id === mercadoriaId);
  const map = new Map<string, number>();
  let moved = false;
  for (const s of store.saidas) {
    if (s.deleted_at || s.mercadoria_id !== mercadoriaId) continue;
    if (!countsForStock(store, s.data, s.created_at, upto)) continue;
    const pav = pavOfMovement(store, s, merc);
    if (!pav) continue;
    const sign = movementSign(s);
    if (!sign) continue;
    moved = true;
    map.set(pav, (map.get(pav) || 0) + sign * Number(s.quantidade || 0));
    if (sign < 0 && s.destino_pavilhao_id) {
      const dest = resolvePavilhaoId(store.pavilhoes, s.destino_pavilhao_id);
      if (dest && dest !== pav) {
        map.set(dest, (map.get(dest) || 0) + Number(s.quantidade || 0));
      }
    }
  }
  for (const c of store.contagens ?? []) {
    if (c.deleted_at || c.mercadoria_id !== mercadoriaId) continue;
    if (!countsForStock(store, c.data, c.created_at, upto)) continue;
    moved = true;
    map.set(c.pavilhao_id, (map.get(c.pavilhao_id) || 0) + Number(c.delta || 0));
  }
  if (!moved && merc && merc.estoque > 0 && merc.pavilhao_id && !upto) {
    map.set(merc.pavilhao_id, merc.estoque);
  } else if (moved && merc) {
    let allocated = 0;
    for (const v of map.values()) allocated += v;
    const rest = Number(merc.estoque || 0) - allocated;
    if (rest !== 0 && merc.pavilhao_id && !upto) {
      map.set(merc.pavilhao_id, (map.get(merc.pavilhao_id) || 0) + rest);
    }
  }
  for (const [k, v] of map) if (v < 0) map.set(k, 0);
  return map;
}

function setSession(userId: string | null, remember: boolean) {
  memorySession = userId;
  if (!canStore()) return;
  try {
    if (userId) {
      sessionStorage.setItem(SESSION_TAB_KEY, userId);
      if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify({ user_id: userId } satisfies Session));
      else localStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.removeItem(SESSION_TAB_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

function isApagado(store: LocalDb, id?: string, email?: string) {
  const keys = store.apagados ?? [];
  if (id && keys.includes(id)) return true;
  if (email && keys.includes(email.trim().toLowerCase())) return true;
  return false;
}

function readSessionId(): string | null {
  if (memorySession) return memorySession;
  if (typeof window === "undefined") return null;
  try {
    const tab = sessionStorage.getItem(SESSION_TAB_KEY);
    if (tab) {
      memorySession = tab;
      return tab;
    }
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Session;
      memorySession = parsed.user_id;
      return memorySession;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export const db = {
  listMercadorias(activeOnly = false): Mercadoria[] {
    const rows = load().mercadorias.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return activeOnly ? rows.filter((m) => m.status) : rows;
  },
  listDestinos(activeOnly = false): Destino[] {
    const rows = load().destinos.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return activeOnly ? rows.filter((d) => d.status) : rows;
  },
  listFornecedores(): Fornecedor[] {
    return load().fornecedores.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
  listPavilhoes(all = false): Pavilhao[] {
    const rows = load().pavilhoes.slice();
    const list = all ? rows : rows.filter((p) => p.ativo);
    return list.sort((a, b) => Number(a.codigo) - Number(b.codigo) || a.codigo.localeCompare(b.codigo, "pt-BR"));
  },
  createPavilhao(input: { codigo: string; nome: string; ativo?: boolean; tipo?: string; logo?: string }): Pavilhao {
    let created!: Pavilhao;
    mutate((store) => {
      const codigo = input.codigo.trim();
      const tipo = (input.tipo || "").trim() || inferTipoLugar({ codigo, nome: input.nome, tipo: input.tipo });
      created = {
        id: codigo ? `p${codigo}` : uid(),
        codigo,
        nome: input.nome.trim() || `${tipo} ${codigo}`.trim(),
        tipo,
        ativo: input.ativo ?? true,
        logo: input.logo || logoOfPavilhao({ id: codigo ? `p${codigo}` : "", codigo }),
      };
      store.pavilhoes.push(created);
      addLog(store, {
        acao: "cadastrou",
        entidade: "pavilhao",
        entidade_id: created.id,
        resumo: `Cadastrou ${created.tipo || "o lugar"} ${created.nome}`,
      });
    });
    return created;
  },
  updatePavilhao(id: string, patch: Partial<Pick<Pavilhao, "codigo" | "nome" | "ativo" | "tipo" | "logo">>) {
    mutate((store) => {
      const row = store.pavilhoes.find((p) => p.id === id);
      if (!row) return;
      const next = { ...row, ...patch };
      row.codigo = next.codigo;
      row.nome = next.nome;
      row.ativo = next.ativo;
      if (patch.tipo !== undefined) row.tipo = patch.tipo.trim() || inferTipoLugar(next);
      if (patch.logo !== undefined) {
        row.logo = patch.logo || logoOfPavilhao(row) || "";
      } else if (!isCustomLogo(row.logo)) {
        const logo = logoOfPavilhao(row);
        if (logo) row.logo = logo;
      }
      addLog(store, {
        acao: patch.ativo === false ? "desativou" : patch.ativo === true ? "ativou" : "editou",
        entidade: "pavilhao",
        entidade_id: id,
        resumo: `${patch.ativo === false ? "Desativou" : patch.ativo === true ? "Ativou" : "Editou"} ${row.tipo || "o pavilhão"} ${row.nome}`,
      });
    });
  },
  listLotes(): Lote[] {
    return load()
      .lotes.slice()
      .sort((a, b) => a.validade.localeCompare(b.validade));
  },
  listFefoLotes(mercadoriaId: string): Lote[] {
    return load()
      .lotes.filter((l) => l.mercadoria_id === mercadoriaId && l.quantidade > 0)
      .sort((a, b) => a.validade.localeCompare(b.validade));
  },
  stockAt(mercadoriaId: string, pavilhaoId: string, upto?: string): number {
    const store = load();
    const pav = resolvePavilhaoId(store.pavilhoes, pavilhaoId) || pavilhaoId;
    return stockMapFor(store, mercadoriaId, upto).get(pav) || 0;
  },
  stockPositions(mercadoriaId: string, upto?: string): { id: string; nome: string; quantidade: number }[] {
    const store = load();
    const map = stockMapFor(store, mercadoriaId, upto);
    return store.pavilhoes
      .filter((p) => p.ativo)
      .sort((a, b) => Number(a.codigo) - Number(b.codigo))
      .map((p) => ({ id: p.id, nome: pavTitle(p), quantidade: map.get(p.id) || 0 }));
  },
  stockSnapshot(upto?: string): {
    id: string;
    codigo: string;
    nome: string;
    unidade: string;
    total: number;
    positions: { id: string; nome: string; quantidade: number }[];
  }[] {
    const store = load();
    const rows = [];
    for (const m of store.mercadorias) {
      if (!m.status) continue;
      const map = stockMapFor(store, m.id, upto);
      const positions = store.pavilhoes
        .filter((p) => p.ativo)
        .sort((a, b) => Number(a.codigo) - Number(b.codigo))
        .map((p) => ({ id: p.id, nome: pavTitle(p), quantidade: map.get(p.id) || 0 }))
        .filter((p) => p.quantidade > 0);
      const total = positions.reduce((a, p) => a + p.quantidade, 0);
      if (total <= 0) continue;
      rows.push({ id: m.id, codigo: m.codigo, nome: m.nome, unidade: m.unidade, total, positions });
    }
    return rows.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
  listSaidas(opts?: { tipo?: "entrada" | "saida"; from?: string; to?: string }): Saida[] {
    const data = load();
    return data.saidas
      .filter((s) => !s.deleted_at)
      .filter((s) => !opts?.tipo || (s.tipo ?? "saida") === opts.tipo)
      .filter((s) => !opts?.from || s.data >= opts.from)
      .filter((s) => !opts?.to || s.data <= opts.to)
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "") || b.data.localeCompare(a.data))
      .map((s) => attachSaida(data, s));
  },
  getSaida(id: string): Saida | null {
    const data = load();
    const row = data.saidas.find((s) => s.id === id);
    return row ? attachSaida(data, row) : null;
  },
  findDuplicateLaunch(opts: { mercadoriaId: string; quantidade: number; tipo: "entrada" | "saida"; userId: string }): Saida | null {
    const hoje = todayISO();
    const qtd = Number(opts.quantidade);
    const hits = this.listSaidas({ tipo: opts.tipo, from: hoje, to: hoje }).filter((s) => {
      if (s.mercadoria_id !== opts.mercadoriaId) return false;
      if (Math.abs(Number(s.quantidade) - qtd) > 0.0001) return false;
      return true;
    });
    if (!hits.length) return null;
    const other = hits.find((s) => s.usuario_id && s.usuario_id !== opts.userId) ?? hits[0];
    return other;
  },
  listLogs(): AuditLog[] {
    return load()
      .logs.slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  zeroAllStock() {
    mutate((store) => {
      store.stockResetAt = nowIso();
      for (const m of store.mercadorias) m.estoque = 0;
      for (const l of store.lotes) l.quantidade = 0;
      addLog(store, {
        acao: "excluiu",
        entidade: "estoque",
        entidade_id: "estoque",
        resumo: "Zerou todo o estoque. Quantidades voltaram para 0.",
      });
    });
  },
  zeroStockDay(date: string) {
    mutate((store) => {
      const next = new Set(store.stockIgnoredDates ?? []);
      next.add(date);
      store.stockIgnoredDates = [...next].sort();
      recomputeStock(store);
      addLog(store, {
        acao: "excluiu",
        entidade: "estoque",
        entidade_id: `dia:${date}`,
        resumo: `Zerou o estoque do dia ${date}. O histórico do dia permanece; as quantidades daquele dia não entram mais no saldo.`,
      });
    });
  },
  stockIgnoredDates(): string[] {
    return (load().stockIgnoredDates ?? []).slice();
  },
  createSaida(input: SaidaInput) {
    const current = load();
    const tipo = input.tipo ?? "saida";
    const desconta = tipo === "saida" && input.desconta_estoque !== false;
    const merc0 = current.mercadorias.find((m) => m.id === input.mercadoria_id);
    const pavId0 =
      resolvePavilhaoId(current.pavilhoes, input.pavilhao_id) ||
      resolvePavilhaoId(current.pavilhoes, input.pavilhao) ||
      resolvePavilhaoId(current.pavilhoes, input.origem);
    const destPav0 = resolvePavilhaoId(current.pavilhoes, input.destino_pavilhao_id);
    if (tipo === "saida") {
      if (!merc0) throw new Error("Produto não encontrado.");
      if (!pavId0) throw new Error("Selecione de onde o produto está saindo.");
      if (destPav0 && destPav0 === pavId0) throw new Error("Origem e destino não podem ser o mesmo pavilhão.");
      if (!input.destino_id && !destPav0) throw new Error("Escolha o destino da saída.");
      if (desconta) {
        const noPav = stockMapFor(current, merc0.id).get(pavId0) || 0;
        const pavNome = current.pavilhoes.find((p) => p.id === pavId0)?.nome || "esse pavilhão";
        if (noPav < input.quantidade && !input.permitir_negativo) {
          throw new Error(`Quantidade superior ao estoque disponível. No ${pavNome} só tem ${noPav} ${merc0.unidade}.`);
        }
      }
    }
    mutate((store) => {
      const tipo = input.tipo ?? "saida";
      const desconta = tipo === "saida" && input.desconta_estoque !== false;
      const merc = store.mercadorias.find((m) => m.id === input.mercadoria_id);
      const pavId =
        resolvePavilhaoId(store.pavilhoes, input.pavilhao_id) ||
        resolvePavilhaoId(store.pavilhoes, input.pavilhao) ||
        resolvePavilhaoId(store.pavilhoes, input.origem);
      const destPavId = resolvePavilhaoId(store.pavilhoes, input.destino_pavilhao_id);
      const transfer = tipo === "saida" && !!destPavId;
      if (tipo === "saida") {
        if (!merc) throw new Error("Produto não encontrado.");
        if (!pavId) throw new Error("Selecione de onde o produto está saindo.");
        if (destPavId && destPavId === pavId) throw new Error("Origem e destino não podem ser o mesmo pavilhão.");
      }
      const origemAntes = merc && pavId ? stockMapFor(store, merc.id).get(pavId) || 0 : 0;
      const destAntes = merc && destPavId ? stockMapFor(store, merc.id).get(destPavId) || 0 : 0;
      if (tipo === "saida" && desconta) {
        if (origemAntes < input.quantidade && !input.permitir_negativo) {
          const pavNome = store.pavilhoes.find((p) => p.id === pavId)?.nome || "esse pavilhão";
          throw new Error(`Quantidade superior ao estoque disponível. No ${pavNome} só tem ${origemAntes} ${merc?.unidade}.`);
        }
        if (!transfer && merc) merc.estoque = Math.max(0, merc.estoque - input.quantidade);
        if (input.lote_codigo) {
          const lote = store.lotes.find((l) => l.codigo === input.lote_codigo && l.mercadoria_id === input.mercadoria_id);
          if (lote) lote.quantidade = Math.max(0, lote.quantidade - input.quantidade);
        }
      } else if (tipo === "entrada" && merc) {
        merc.estoque += input.quantidade;
      }
      const id = uid();
      const codigo = nextMovCodigo(store.saidas, input.data || todayISO());
      const tipoMov = tipo === "entrada" ? "entrada" : transfer ? "transferencia" : "saida";
      const hasChegada = Boolean(input.hora_chegada);
      const status: MovimentoStatus =
        input.status || (tipoMov === "transferencia" ? (hasChegada ? "entregue" : "em_transito") : "registrada");
      let dataHoraSaida = input.data_hora_saida || null;
      let dataHoraChegada = input.data_hora_chegada || null;
      if (!dataHoraSaida && input.hora_saida) {
        const stamps = arrivalStamp(input.data, input.hora_saida, input.hora_chegada || input.hora_saida);
        dataHoraSaida = stamps.stampSaida;
        dataHoraChegada = hasChegada ? stamps.stampChegada : null;
      }
      const origemDepois =
        tipo === "entrada"
          ? origemAntes + input.quantidade
          : desconta
            ? Math.max(0, origemAntes - input.quantidade)
            : origemAntes;
      const destDepois = destPavId ? destAntes + (desconta && tipo === "saida" ? input.quantidade : 0) : undefined;
      const pavRow = store.pavilhoes.find((p) => p.id === pavId);
      const origemNome = pavRow ? pavTitle(pavRow) : input.origem;
      const { permitir_negativo: excecaoNegativo, empilhadeira: _empilhadeira, ...safeInput } = input;
      store.saidas.unshift({
        id,
        codigo,
        ...safeInput,
        origem: origemNome,
        destino_id: transfer ? "" : input.destino_id || "",
        destino_pavilhao_id: destPavId || undefined,
        tipo,
        tipo_movimentacao: tipoMov,
        status,
        desconta_estoque: tipo === "saida" ? desconta : undefined,
        pavilhao: pavId || input.pavilhao || input.origem,
        pavilhao_id: pavId || undefined,
        operador_nome: input.operador_nome?.trim() || undefined,
        empilhadeira: undefined,
        data_hora_saida: dataHoraSaida,
        data_hora_chegada: dataHoraChegada,
        estoque_origem_antes: merc ? origemAntes : undefined,
        estoque_origem_depois: merc ? origemDepois : undefined,
        estoque_destino_antes: destPavId ? destAntes : undefined,
        estoque_destino_depois: destPavId ? destDepois : undefined,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
      if (input.operador_nome?.trim()) rememberOperador(store, input.operador_nome);
      const dest = store.destinos.find((d) => d.id === input.destino_id);
      const pavNome = pavRow?.nome;
      const destPavNome = destPavId ? pavTitle(store.pavilhoes.find((p) => p.id === destPavId) ?? { codigo: "" }) : "";
      const rota = destPavNome ? `${pavNome} → ${destPavNome}` : dest ? `${pavNome} → ${dest.nome}` : pavNome || "";
      addLog(store, {
        acao: "cadastrou",
        entidade: tipo === "entrada" ? "entrada" : "saida",
        entidade_id: id,
        resumo:
          tipo === "entrada"
            ? `Cadastrou entrada de ${merc?.nome ?? "produto"} · ${input.quantidade} ${input.unidade}${pavNome ? ` · ${pavNome}` : ""}`
            : `${transfer ? "Registrou transferência" : "Registrou saída"} de ${merc?.nome ?? "produto"} · ${input.quantidade} ${input.unidade}${rota ? ` · ${rota}` : ""}${input.hora_saida ? ` · saiu ${input.hora_saida}` : ""}${input.hora_chegada ? ` · chegou ${input.hora_chegada}` : ""} · estoque: ${desconta ? "descontado" : "não alterado"}`,
        detalhe: `${codigo}${input.operador_nome ? ` · empilhador ${input.operador_nome}` : ""}${desconta ? "" : " · somente registro"}${excecaoNegativo ? " · exceção de estoque negativo autorizada pelo administrador" : ""}`,
        usuario_id: input.usuario_id,
      });
    });
  },
  createEntrada(input: SaidaInput & { validade?: string; pavilhao_id?: string }) {
    mutate((store) => {
      const id = uid();
      const pavId = resolvePavilhaoId(store.pavilhoes, input.pavilhao_id || input.pavilhao || input.origem) ?? "p13";
      const codigo = nextMovCodigo(store.saidas, input.data || todayISO());
      store.saidas.unshift({
        id,
        codigo,
        ...input,
        destino_id: input.destino_id || "",
        tipo: "entrada",
        tipo_movimentacao: "entrada",
        status: "registrada",
        pavilhao: input.pavilhao || pavId,
        pavilhao_id: pavId,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
      const merc = store.mercadorias.find((m) => m.id === input.mercadoria_id);
      if (merc) merc.estoque += input.quantidade;
      if (input.lote_codigo) {
        store.lotes.unshift({
          id: uid(),
          codigo: input.lote_codigo,
          mercadoria_id: input.mercadoria_id,
          quantidade: input.quantidade,
          unidade: input.unidade,
          validade: input.validade ?? isoDaysAgo(-10),
          pavilhao_id: pavId,
          fornecedor_id: "f1",
        });
      }
      addLog(store, {
        acao: "cadastrou",
        entidade: "entrada",
        entidade_id: id,
        resumo: `Cadastrou entrada de ${merc?.nome ?? "produto"} · ${input.quantidade} ${input.unidade} · ${store.pavilhoes.find((p) => p.id === pavId)?.nome ?? ""}`,
        detalhe: codigo,
        usuario_id: input.usuario_id,
      });
    });
  },
  updateSaida(id: string, patch: Partial<SaidaInput>) {
    mutate((store) => {
      const row = store.saidas.find((s) => s.id === id);
      if (!row || row.deleted_at) return;
      const before = row.quantidade;
      const tipo = row.tipo ?? "saida";
      const oldMercId = row.mercadoria_id;
      const newMercId = patch.mercadoria_id || oldMercId;
      const productChanged = Boolean(patch.mercadoria_id && patch.mercadoria_id !== oldMercId);
      const oldMerc = store.mercadorias.find((m) => m.id === oldMercId);
      const newMerc = store.mercadorias.find((m) => m.id === newMercId);
      const nextDesconta = patch.desconta_estoque ?? row.desconta_estoque;
      const nextQty = patch.quantidade ?? row.quantidade;
      const nextRow: Saida = { ...row, ...patch, mercadoria_id: newMercId, quantidade: nextQty, desconta_estoque: nextDesconta };
      const wasMoving = movementSign(row) !== 0;
      const willMove = movementSign(nextRow) !== 0;
      const wasCompany = companySign(row) !== 0;
      const willCompany = companySign(nextRow) !== 0;
      const beforeHs = row.hora_saida;
      const beforeHc = row.hora_chegada;
      if (productChanged) {
        if (oldMerc && wasCompany) {
          if (tipo === "saida") oldMerc.estoque += row.quantidade;
          else oldMerc.estoque = Math.max(0, oldMerc.estoque - row.quantidade);
        }
        if (wasMoving && row.lote_codigo) {
          const lote = store.lotes.find((l) => l.codigo === row.lote_codigo && l.mercadoria_id === oldMercId);
          if (lote) {
            if (tipo === "saida") lote.quantidade += row.quantidade;
            else lote.quantidade = Math.max(0, lote.quantidade - row.quantidade);
          }
        }
        if (newMerc && willCompany) {
          if (tipo === "saida") newMerc.estoque = Math.max(0, newMerc.estoque - nextQty);
          else newMerc.estoque += nextQty;
        }
        patch.lote_codigo = "";
        if (newMerc?.unidade) patch.unidade = newMerc.unidade;
      } else if (oldMerc && tipo === "saida") {
        if (wasCompany && !willCompany) {
          oldMerc.estoque += row.quantidade;
        } else if (!wasCompany && willCompany) {
          oldMerc.estoque = Math.max(0, oldMerc.estoque - nextQty);
        } else if (wasCompany && willCompany && patch.quantidade != null && patch.quantidade !== before) {
          const delta = patch.quantidade - before;
          oldMerc.estoque = Math.max(0, oldMerc.estoque - delta);
        }
        if (wasMoving && !willMove) {
          if (row.lote_codigo) {
            const lote = store.lotes.find((l) => l.codigo === row.lote_codigo && l.mercadoria_id === row.mercadoria_id);
            if (lote) lote.quantidade += row.quantidade;
          }
        } else if (!wasMoving && willMove) {
          if (row.lote_codigo) {
            const lote = store.lotes.find((l) => l.codigo === row.lote_codigo && l.mercadoria_id === row.mercadoria_id);
            if (lote) lote.quantidade = Math.max(0, lote.quantidade - nextQty);
          }
        } else if (wasMoving && willMove && patch.quantidade != null && patch.quantidade !== before) {
          const delta = patch.quantidade - before;
          if (row.lote_codigo) {
            const lote = store.lotes.find((l) => l.codigo === row.lote_codigo && l.mercadoria_id === row.mercadoria_id);
            if (lote) lote.quantidade = Math.max(0, lote.quantidade - delta);
          }
        }
      } else if (oldMerc && tipo === "entrada" && patch.quantidade != null && patch.quantidade !== before) {
        const delta = patch.quantidade - before;
        oldMerc.estoque = Math.max(0, oldMerc.estoque + delta);
        if (row.lote_codigo) {
          const lote = store.lotes.find((l) => l.codigo === row.lote_codigo && l.mercadoria_id === row.mercadoria_id);
          if (lote) lote.quantidade = Math.max(0, lote.quantidade + delta);
        }
      }
      if (patch.hora_saida != null || patch.hora_chegada != null) {
        const hs = patch.hora_saida ?? row.hora_saida;
        const hc = patch.hora_chegada ?? row.hora_chegada;
        if (hs && hc) patch.tempo_transporte = calcTransportTime(hs, hc);
        if (hs) {
          const stamps = arrivalStamp(row.data, hs, hc || hs);
          patch.data_hora_saida = stamps.stampSaida;
          patch.data_hora_chegada = hc ? stamps.stampChegada : null;
        }
        if (row.destino_pavilhao_id) {
          patch.status = hc ? "entregue" : "em_transito";
        }
      }
      Object.assign(row, patch);
      row.updated_at = nowIso();
      if (patch.operador_nome != null) rememberOperador(store, patch.operador_nome);
      const detalheParts: string[] = [];
      if (productChanged) detalheParts.push(`Produto ${oldMerc?.nome ?? "—"} → ${newMerc?.nome ?? "—"}`);
      if (patch.quantidade != null && patch.quantidade !== before) detalheParts.push(`Quantidade ${before} → ${patch.quantidade} ${row.unidade}`);
      if (patch.hora_chegada != null && patch.hora_chegada !== beforeHc) detalheParts.push(`Horário de chegada ${beforeHc ?? "—"} → ${patch.hora_chegada ?? "—"}`);
      if (patch.hora_saida != null && patch.hora_saida !== beforeHs) detalheParts.push(`Horário de saída ${beforeHs ?? "—"} → ${patch.hora_saida ?? "—"}`);
      addLog(store, {
        acao: "editou",
        entidade: tipo === "entrada" ? "entrada" : "saida",
        entidade_id: id,
        resumo: `Editou ${tipo === "entrada" ? "entrada" : "saída"} de ${newMerc?.nome ?? oldMerc?.nome ?? "produto"}`,
        detalhe: detalheParts.join(" · ") || undefined,
      });
    });
  },
  markChegada(id: string, hora: string, data?: string) {
    const row = this.getSaida(id);
    if (!row) throw new Error("Movimentação não encontrada.");
    this.updateSaida(id, {
      hora_chegada: hora,
      data_hora_chegada: arrivalStamp(data || row.data, row.hora_saida || hora, hora, data).stampChegada,
      status: "entregue",
      tempo_transporte: row.hora_saida ? calcTransportTime(row.hora_saida, hora) : row.tempo_transporte,
    });
  },
  deleteSaida(id: string): Saida | null {
    let snap: Saida | null = null;
    mutate((store) => {
      const row = store.saidas.find((s) => s.id === id);
      if (!row || row.deleted_at) return;
      snap = { ...row };
      const merc = store.mercadorias.find((m) => m.id === row.mercadoria_id);
      const tipo = row.tipo ?? "saida";
      const moves = movementSign(row) !== 0;
      if (merc && companySign(row) !== 0) {
        if (tipo === "saida") merc.estoque += row.quantidade;
        else merc.estoque = Math.max(0, merc.estoque - row.quantidade);
      }
      if (moves && row.lote_codigo) {
        const lote = store.lotes.find((l) => l.codigo === row.lote_codigo && l.mercadoria_id === row.mercadoria_id);
        if (lote) {
          if (tipo === "saida") lote.quantidade += row.quantidade;
          else lote.quantidade = Math.max(0, lote.quantidade - row.quantidade);
        }
      }
      row.deleted_at = nowIso();
      addLog(store, {
        acao: "excluiu",
        entidade: tipo === "entrada" ? "entrada" : "saida",
        entidade_id: id,
        resumo: `Excluiu ${tipo === "entrada" ? "entrada" : "saída"} de ${merc?.nome ?? "produto"} · ${row.quantidade} ${row.unidade}`,
      });
    });
    return snap;
  },
  restoreSaida(row: Saida) {
    mutate((store) => {
      const existing = store.saidas.find((s) => s.id === row.id);
      if (existing) {
        if (!existing.deleted_at) return;
        existing.deleted_at = null;
      } else {
        store.saidas.unshift({ ...row, deleted_at: null });
      }
      const tipo = row.tipo ?? "saida";
      const merc = store.mercadorias.find((m) => m.id === row.mercadoria_id);
      const moves = movementSign(row) !== 0;
      if (merc && companySign(row) !== 0) {
        if (tipo === "saida") merc.estoque = Math.max(0, merc.estoque - row.quantidade);
        else merc.estoque += row.quantidade;
      }
      if (moves && row.lote_codigo) {
        const lote = store.lotes.find((l) => l.codigo === row.lote_codigo && l.mercadoria_id === row.mercadoria_id);
        if (lote) {
          if (tipo === "saida") lote.quantidade = Math.max(0, lote.quantidade - row.quantidade);
          else lote.quantidade += row.quantidade;
        }
      }
      addLog(store, {
        acao: "cadastrou",
        entidade: tipo === "entrada" ? "entrada" : "saida",
        entidade_id: row.id,
        resumo: `Desfez a exclusão da ${tipo === "entrada" ? "entrada" : "saída"} de ${merc?.nome ?? "produto"}`,
      });
    });
  },
  createMercadoria(input: { codigo: string; nome: string; unidade: string; pavilhao_id?: string; pavilhao_ids?: string[] }): Mercadoria {
    let created!: Mercadoria;
    mutate((store) => {
      const ids = (input.pavilhao_ids?.length ? input.pavilhao_ids : input.pavilhao_id ? [input.pavilhao_id] : ["p13"]).filter(Boolean);
      const pav = ids[0] || "p13";
      const pavNomes = ids
        .map((id) => store.pavilhoes.find((p) => p.id === id)?.nome || pavilhaoNome(id))
        .filter(Boolean);
      created = {
        id: uid(),
        codigo: input.codigo.trim(),
        nome: input.nome.trim(),
        unidade: input.unidade,
        status: true,
        created_at: nowIso(),
        estoque: 0,
        minimo: 10,
        cor: "#2d6a4f",
        pavilhao_id: pav,
        pavilhao_ids: ids,
        categoria: pavNomes.join(" · ") || pavilhaoNome(pav),
      };
      store.mercadorias.unshift(created);
      addLog(store, {
        acao: "cadastrou",
        entidade: "produto",
        entidade_id: created.id,
        resumo: `Cadastrou o produto ${created.nome} (${created.codigo})`,
      });
    });
    return created;
  },
  updateMercadoria(id: string, patch: Partial<Pick<Mercadoria, "nome" | "codigo" | "unidade" | "status" | "minimo" | "estoque" | "pavilhao_id" | "pavilhao_ids" | "categoria">>) {
    mutate((store) => {
      const row = store.mercadorias.find((m) => m.id === id);
      if (!row) return;
      const before = `${row.nome} (${row.codigo})`;
      Object.assign(row, patch);
      const ids = patch.pavilhao_ids?.length ? patch.pavilhao_ids : patch.pavilhao_id ? [patch.pavilhao_id] : row.pavilhao_ids?.length ? row.pavilhao_ids : row.pavilhao_id ? [row.pavilhao_id] : [];
      if (ids.length) {
        row.pavilhao_ids = ids;
        row.pavilhao_id = ids[0];
        row.categoria = ids.map((pid) => store.pavilhoes.find((p) => p.id === pid)?.nome || pavilhaoNome(pid)).join(" · ");
      }
      const acao: AuditAcao = patch.status === false ? "desativou" : patch.status === true ? "ativou" : "editou";
      addLog(store, {
        acao,
        entidade: "produto",
        entidade_id: id,
        resumo:
          acao === "desativou"
            ? `Desativou o produto ${before}`
            : acao === "ativou"
              ? `Ativou o produto ${row.nome} (${row.codigo})`
              : `Editou o produto ${row.nome} (${row.codigo})`,
        detalhe: patch.status == null ? `Antes: ${before}` : undefined,
      });
    });
  },
  deleteMercadoria(id: string): Mercadoria | null {
    let snap: Mercadoria | null = null;
    mutate((store) => {
      const row = store.mercadorias.find((m) => m.id === id);
      if (!row) return;
      snap = { ...row };
      store.mercadorias = store.mercadorias.filter((m) => m.id !== id);
      addLog(store, {
        acao: "excluiu",
        entidade: "produto",
        entidade_id: id,
        resumo: `Excluiu o produto ${row.nome} (${row.codigo})`,
      });
    });
    return snap;
  },
  restoreMercadoria(row: Mercadoria) {
    mutate((store) => {
      if (store.mercadorias.some((m) => m.id === row.id)) return;
      store.mercadorias.unshift(row);
      addLog(store, {
        acao: "cadastrou",
        entidade: "produto",
        entidade_id: row.id,
        resumo: `Desfez a exclusão do produto ${row.nome}`,
      });
    });
  },
  createDestino(input: {
    nome: string;
    codigo?: string;
    endereco?: string;
    contato?: string;
    telefone?: string;
    cnpj?: string;
    email?: string;
    logo?: string;
  }): Destino {
    let created!: Destino;
    mutate((store) => {
      created = {
        id: uid(),
        nome: input.nome.trim(),
        codigo: (input.codigo ?? "").trim(),
        endereco: (input.endereco ?? "").trim(),
        contato: (input.contato || input.telefone || "").trim(),
        telefone: (input.telefone || input.contato || "").trim(),
        cnpj: (input.cnpj ?? "").trim(),
        email: (input.email ?? "").trim(),
        logo: input.logo || "",
        status: true,
        created_at: nowIso(),
      };
      store.destinos.unshift(created);
      addLog(store, {
        acao: "cadastrou",
        entidade: "destino",
        entidade_id: created.id,
        resumo: `Cadastrou o cliente ${created.nome}`,
      });
    });
    return created;
  },
  updateDestino(
    id: string,
    patch: Partial<Pick<Destino, "nome" | "status" | "endereco" | "contato" | "codigo" | "telefone" | "cnpj" | "email" | "logo">>,
  ) {
    mutate((store) => {
      const row = store.destinos.find((d) => d.id === id);
      if (!row) return;
      Object.assign(row, patch);
      if (patch.telefone != null && patch.contato == null) row.contato = patch.telefone;
      addLog(store, {
        acao: patch.status === false ? "desativou" : patch.status === true ? "ativou" : "editou",
        entidade: "destino",
        entidade_id: id,
        resumo: `Atualizou o cliente ${row.nome}`,
      });
    });
  },
  createFornecedor(input: { nome: string; contato: string }): Fornecedor {
    let created!: Fornecedor;
    mutate((store) => {
      created = { id: uid(), nome: input.nome.trim(), contato: input.contato.trim(), status: true };
      store.fornecedores.unshift(created);
      addLog(store, {
        acao: "cadastrou",
        entidade: "fornecedor",
        entidade_id: created.id,
        resumo: `Cadastrou o fornecedor ${created.nome}`,
      });
    });
    return created;
  },
  updateFornecedor(id: string, patch: Partial<Pick<Fornecedor, "nome" | "contato" | "status">>) {
    mutate((store) => {
      const row = store.fornecedores.find((f) => f.id === id);
      if (!row) return;
      const before = row.nome;
      Object.assign(row, patch);
      addLog(store, {
        acao: patch.status === false ? "desativou" : patch.status === true ? "ativou" : "editou",
        entidade: "fornecedor",
        entidade_id: id,
        resumo: `Atualizou o fornecedor ${row.nome}`,
        detalhe: patch.nome && patch.nome !== before ? `Antes: ${before}` : undefined,
      });
    });
  },
  deleteFornecedor(id: string): Fornecedor | null {
    let snap: Fornecedor | null = null;
    mutate((store) => {
      const row = store.fornecedores.find((f) => f.id === id);
      if (!row) return;
      snap = { ...row };
      store.fornecedores = store.fornecedores.filter((f) => f.id !== id);
      addLog(store, {
        acao: "excluiu",
        entidade: "fornecedor",
        entidade_id: id,
        resumo: `Excluiu o fornecedor ${row.nome}`,
      });
    });
    return snap;
  },
  restoreFornecedor(row: Fornecedor) {
    mutate((store) => {
      if (store.fornecedores.some((f) => f.id === row.id)) return;
      store.fornecedores.unshift(row);
      addLog(store, {
        acao: "cadastrou",
        entidade: "fornecedor",
        entidade_id: row.id,
        resumo: `Desfez a exclusão do fornecedor ${row.nome}`,
      });
    });
  },
  listUsuarios(): Usuario[] {
    return load().usuarios.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
  createUser(input: { nome: string; email: string; senha: string; nivel_acesso: NivelAcesso }): Usuario {
    const email = input.email.trim().toLowerCase();
    if (load().usuarios.some((u) => u.email.toLowerCase() === email) && !isApagado(load(), undefined, email)) {
      throw new Error("Já existe um usuário com este e-mail.");
    }
    let created!: Usuario;
    mutate((store) => {
      store.apagados = (store.apagados ?? []).filter((k) => k !== email);
      const existingGone = store.usuarios.find((u) => u.email.toLowerCase() === email);
      if (existingGone) store.usuarios = store.usuarios.filter((u) => u.id !== existingGone.id);
      created = {
        id: uid(),
        nome: input.nome.trim(),
        email,
        nivel_acesso: input.nivel_acesso,
        status: true,
        created_at: nowIso(),
      };
      store.usuarios.push(created);
      store.senhas[created.id] = input.senha.trim();
      addLog(store, {
        acao: "cadastrou",
        entidade: "usuario",
        entidade_id: created.id,
        resumo: `Cadastrou o usuário ${created.nome}`,
      });
    });
    return created;
  },
  updateUser(input: {
    user_id: string;
    nome: string;
    email: string;
    nivel_acesso: NivelAcesso;
    status?: boolean;
    senha?: string;
  }) {
    mutate((store) => {
      const row = store.usuarios.find((u) => u.id === input.user_id);
      if (!row) return;
      row.nome = input.nome.trim();
      row.email = input.email.trim().toLowerCase();
      row.nivel_acesso = input.nivel_acesso;
      if (typeof input.status === "boolean") row.status = input.status;
      if (input.senha?.trim()) store.senhas[row.id] = input.senha.trim();
      addLog(store, {
        acao: input.status === false ? "desativou" : input.status === true ? "ativou" : "editou",
        entidade: "usuario",
        entidade_id: row.id,
        resumo: `Atualizou o usuário ${row.nome}`,
      });
    });
  },
  deleteUser(id: string) {
    mutate((store) => {
      const row = store.usuarios.find((u) => u.id === id);
      if (!row) return;
      store.apagados = [...new Set([...(store.apagados ?? []), row.id, row.email.toLowerCase()])];
      store.usuarios = store.usuarios.filter((u) => u.id !== id);
      delete store.senhas[id];
      addLog(store, {
        acao: "excluiu",
        entidade: "usuario",
        entidade_id: id,
        resumo: `Excluiu o usuário ${row.nome}`,
      });
    });
  },
  acceptRemoteUser(user: Usuario, senha?: string) {
    mutate((store) => {
      store.apagados = (store.apagados ?? []).filter((k) => k !== user.id && k !== user.email.toLowerCase());
      const existing = store.usuarios.find((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
      if (existing) {
        Object.assign(existing, user, { id: existing.id });
        if (senha) store.senhas[existing.id] = senha;
      } else {
        store.usuarios.push(user);
        if (senha) store.senhas[user.id] = senha;
      }
    });
  },
  applyDeleted(keys: string[]) {
    if (!keys.length) return;
    mutate((store) => {
      store.apagados = [...new Set([...(store.apagados ?? []), ...keys])];
      store.usuarios = store.usuarios.filter((u) => !store.apagados.includes(u.id) && !store.apagados.includes(u.email.toLowerCase()));
    });
  },
  exportUsers() {
    const store = load();
    return store.usuarios.map((u) => ({ ...u, senha: store.senhas[u.id] || "" }));
  },
  login(identificador: string, senha: string, remember = false): Usuario {
    const store = load();
    const key = identificador.trim().toLowerCase();
    const user = store.usuarios.find((u) => u.email.toLowerCase() === key || u.nome.toLowerCase() === key);
    if (!user || (store.senhas[user.id] ?? "") !== senha) throw new Error("E-mail ou senha inválidos.");
    if (!user.status) throw new Error("Usuário desativado.");
    setSession(user.id, remember);
    return user;
  },
  openSession(user: Usuario, senha?: string, remember = false) {
    const store = load();
    if (senha) {
      const row = store.usuarios.find((u) => u.id === user.id);
      if (row && !store.senhas[row.id]) store.senhas[row.id] = senha;
    }
    setSession(user.id, remember);
    return store.usuarios.find((u) => u.id === user.id) ?? user;
  },
  getSessionUser(): Usuario | null {
    const id = readSessionId();
    if (!id) return null;
    return load().usuarios.find((u) => u.id === id && u.status) ?? null;
  },
  logout() {
    setSession(null, false);
  },
  saveRemember(identificador: string, senha: string) {
    if (!canStore()) return;
    try {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ identificador, senha }));
    } catch {
      /* ignore */
    }
  },
  clearRemember() {
    try {
      localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignore */
    }
  },
  loadRemember(): { identificador: string; senha: string } | null {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as { identificador: string; senha: string };
    } catch {
      return null;
    }
  },
  recordAccess(input: { resumo: string; detalhe?: string; usuario_id?: string; acao?: AuditAcao }) {
    mutate((store) => {
      addLog(store, {
        acao: input.acao ?? "login",
        entidade: "seguranca",
        entidade_id: input.usuario_id || "acesso",
        resumo: input.resumo,
        detalhe: input.detalhe,
        usuario_id: input.usuario_id,
      });
    });
  },
  listContagens(): Contagem[] {
    return load()
      .contagens.filter((c) => !c.deleted_at)
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  listContadores(): string[] {
    return (load().contadores ?? []).slice();
  },
  createContagem(input: {
    mercadoria_id: string;
    pavilhao_id: string;
    contado: number;
    motivo: string;
    observacao: string;
    usuario_id: string;
    contador: string;
    data?: string;
  }) {
    mutate((store) => {
      const merc = store.mercadorias.find((m) => m.id === input.mercadoria_id);
      if (!merc) throw new Error("Produto não encontrado.");
      const day = input.data || todayISO();
      const esperado = stockMapFor(store, merc.id, input.data).get(input.pavilhao_id) || 0;
      const delta = input.contado - esperado;
      merc.estoque = Math.max(0, merc.estoque + delta);
      const user = store.usuarios.find((u) => u.id === input.usuario_id);
      const id = uid();
      store.contagens.unshift({
        id,
        created_at: nowIso(),
        data: day,
        mercadoria_id: input.mercadoria_id,
        pavilhao_id: input.pavilhao_id,
        esperado,
        contado: input.contado,
        delta,
        unidade: merc.unidade,
        motivo: input.motivo,
        observacao: input.observacao || "",
        usuario_id: input.usuario_id,
        usuario_nome: user?.nome || "",
        contador: input.contador,
      });
      store.contadores = rememberList(store.contadores, input.contador);
      recomputeStock(store);
      addLog(store, {
        acao: input.motivo === "ajuste" ? "editou" : "cadastrou",
        entidade: "contagem",
        entidade_id: id,
        resumo: `${input.motivo === "ajuste" ? "Editou estoque" : "Contagem"} de ${merc.nome}: ${esperado} → ${input.contado} ${merc.unidade}${input.data ? ` · ${input.data}` : ""}`,
        usuario_id: input.usuario_id,
      });
    });
  },
  undoContagem(id: string) {
    mutate((store) => {
      const row = store.contagens.find((c) => c.id === id);
      if (!row || row.deleted_at) return;
      const merc = store.mercadorias.find((m) => m.id === row.mercadoria_id);
      if (merc) merc.estoque = Math.max(0, merc.estoque - row.delta);
      row.deleted_at = nowIso();
      recomputeStock(store);
      addLog(store, {
        acao: "excluiu",
        entidade: "contagem",
        entidade_id: id,
        resumo: `Desfez a contagem de ${merc?.nome ?? "produto"}`,
      });
    });
  },
  listAtalhos(): Atalho[] {
    return (load().atalhos ?? [])
      .filter((a) => !a.deleted_at)
      .slice()
      .sort((a, b) => b.usos - a.usos || (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at));
  },
  listOperadores(): string[] {
    const store = load();
    const named = (store.empilhadoresPessoas ?? []).filter((e) => !e.deleted_at).map((e) => e.nome);
    if (named.length) return named.slice().sort((a, b) => a.localeCompare(b, "pt-BR"));
    return (store.operadores ?? []).slice();
  },
  listEmpilhadores(): Empilhador[] {
    return (load().empilhadoresPessoas ?? [])
      .filter((e) => !e.deleted_at)
      .slice()
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
  createEmpilhador(nome: string): Empilhador {
    let created!: Empilhador;
    mutate((store) => {
      const n = nome.trim();
      if (!n) throw new Error("Informe o nome do empilhador.");
      const people = store.empilhadoresPessoas ?? [];
      const hit = people.find((e) => e.nome.toLowerCase() === n.toLowerCase());
      const stamp = nowIso();
      if (hit) {
        hit.deleted_at = null;
        hit.nome = n;
        hit.updated_at = stamp;
        created = hit;
      } else {
        created = { id: uid(), nome: n, created_at: stamp, updated_at: stamp, deleted_at: null };
        people.push(created);
        store.empilhadoresPessoas = people;
      }
      rememberOperador(store, n);
      addLog(store, {
        acao: "cadastrou",
        entidade: "empilhador",
        entidade_id: created.id,
        resumo: `Cadastrou o empilhador ${n}`,
      });
    });
    return created;
  },
  renameEmpilhador(id: string, nome: string) {
    mutate((store) => {
      const n = nome.trim();
      if (!n) throw new Error("Informe o nome.");
      const people = store.empilhadoresPessoas ?? [];
      const row = people.find((e) => e.id === id);
      if (!row) throw new Error("Empilhador não encontrado.");
      const before = row.nome;
      if (before === n) return;
      row.nome = n;
      row.updated_at = nowIso();
      row.deleted_at = null;
      store.operadores = (store.operadores ?? []).map((x) => (x.toLowerCase() === before.toLowerCase() ? n : x));
      if (!store.operadores.some((x) => x.toLowerCase() === n.toLowerCase())) store.operadores = rememberList(store.operadores, n);
      for (const s of store.saidas) {
        if ((s.operador_nome || "").trim().toLowerCase() === before.toLowerCase()) s.operador_nome = n;
      }
      addLog(store, {
        acao: "editou",
        entidade: "empilhador",
        entidade_id: id,
        resumo: `Renomeou o empilhador ${before} → ${n}`,
      });
    });
  },
  deleteEmpilhador(id: string) {
    mutate((store) => {
      const row = (store.empilhadoresPessoas ?? []).find((e) => e.id === id);
      if (!row) return;
      row.deleted_at = nowIso();
      row.updated_at = row.deleted_at;
      store.operadores = (store.operadores ?? []).filter((x) => x.toLowerCase() !== row.nome.toLowerCase());
      addLog(store, {
        acao: "excluiu",
        entidade: "empilhador",
        entidade_id: id,
        resumo: `Removeu o empilhador ${row.nome} do cadastro`,
      });
    });
  },
  listFretes(): FretePagamento[] {
    return (load().fretes ?? [])
      .filter((f) => !f.deleted_at)
      .slice()
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  },
  getFrete(id: string): FretePagamento | undefined {
    return this.listFretes().find((f) => f.id === id);
  },
  saveFrete(input: FreteInput & { id?: string }): FretePagamento {
    let saved!: FretePagamento;
    mutate((store) => {
      const stamp = nowIso();
      const rows = store.fretes ?? [];
      if (input.id) {
        const row = rows.find((f) => f.id === input.id && !f.deleted_at);
        if (!row) throw new Error("Pagamento de frete não encontrado.");
        Object.assign(row, {
          fornecedor: input.fornecedor.trim(),
          numero_bilhete: (input.numero_bilhete || "").trim(),
          valor: Number(input.valor) || 0,
          data_entrada: input.data_entrada,
          pavilhao: (input.pavilhao || "").trim(),
          placa: (input.placa || "").trim(),
          motorista: (input.motorista || "").trim(),
          cpf: (input.cpf || "").trim(),
          assinatura_motorista: input.assinatura_motorista || "",
          forma_pagamento: input.forma_pagamento || "",
          pix_tipo: input.forma_pagamento === "PIX" ? input.pix_tipo || "" : "",
          pix_chave: input.forma_pagamento === "PIX" ? (input.pix_chave || "").trim() : "",
          rubrica: input.rubrica || "",
          data_autorizacao: input.data_autorizacao || "",
          observacoes: (input.observacoes || "").trim(),
          status: input.status || row.status,
          updated_at: stamp,
          created_by: input.created_by || row.created_by,
          created_by_nome: input.created_by_nome || row.created_by_nome,
        });
        saved = row;
        addLog(store, {
          acao: "editou",
          entidade: "frete",
          entidade_id: row.id,
          resumo: `Atualizou o frete nº ${row.numero}${row.fornecedor ? ` · ${row.fornecedor}` : ""}`,
        });
        return;
      }
      const numero = (input.numero || "").trim() || nextFreteNumero(rows);
      saved = {
        id: uid(),
        numero,
        fornecedor: input.fornecedor.trim(),
        numero_bilhete: (input.numero_bilhete || "").trim(),
        valor: Number(input.valor) || 0,
        data_entrada: input.data_entrada,
        pavilhao: (input.pavilhao || "").trim(),
        placa: (input.placa || "").trim(),
        motorista: (input.motorista || "").trim(),
        cpf: (input.cpf || "").trim(),
        assinatura_motorista: input.assinatura_motorista || "",
        forma_pagamento: input.forma_pagamento || "",
        pix_tipo: input.forma_pagamento === "PIX" ? input.pix_tipo || "" : "",
        pix_chave: input.forma_pagamento === "PIX" ? (input.pix_chave || "").trim() : "",
        rubrica: input.rubrica || "",
        data_autorizacao: input.data_autorizacao || "",
        observacoes: (input.observacoes || "").trim(),
        status: input.status || "gerado",
        created_at: stamp,
        updated_at: stamp,
        created_by: input.created_by,
        created_by_nome: input.created_by_nome,
        deleted_at: null,
      };
      store.fretes = [saved, ...rows];
      addLog(store, {
        acao: "cadastrou",
        entidade: "frete",
        entidade_id: saved.id,
        resumo: `Gerou o comprovante de frete nº ${saved.numero}${saved.fornecedor ? ` · ${saved.fornecedor}` : ""}`,
      });
    });
    return saved;
  },
  deleteFrete(id: string) {
    mutate((store) => {
      const row = (store.fretes ?? []).find((f) => f.id === id);
      if (!row) return;
      row.deleted_at = nowIso();
      row.updated_at = row.deleted_at;
      addLog(store, {
        acao: "excluiu",
        entidade: "frete",
        entidade_id: id,
        resumo: `Excluiu o frete nº ${row.numero}`,
      });
    });
  },
  listEmpilhadeiras(): string[] {
    return (load().empilhadeiras ?? []).slice();
  },
  createAtalho(input: {
    kind: AtalhoKind;
    nome?: string;
    origem_pavilhao_id?: string;
    destino_pavilhao_id?: string;
    destino_id?: string;
    mercadoria_id?: string;
  }): Atalho {
    let created!: Atalho;
    mutate((store) => {
      const kind = input.kind;
      const origem_pavilhao_id = input.origem_pavilhao_id || undefined;
      const destino_pavilhao_id = input.destino_pavilhao_id || undefined;
      const destino_id = input.destino_id || undefined;
      const mercadoria_id = input.mercadoria_id || undefined;
      if (kind === "entrada" && !origem_pavilhao_id) throw new Error("Escolha o pavilhão da entrada.");
      if (kind === "saida" && (!origem_pavilhao_id || !destino_id)) throw new Error("Escolha de onde sai e o cliente.");
      if (kind === "transferencia" && (!origem_pavilhao_id || !destino_pavilhao_id)) throw new Error("Escolha os dois pavilhões.");
      if (kind === "transferencia" && origem_pavilhao_id === destino_pavilhao_id) throw new Error("Origem e destino não podem ser o mesmo lugar.");
      const key = atalhoKey({ kind, origem_pavilhao_id, destino_pavilhao_id, destino_id, mercadoria_id });
      const dup = (store.atalhos ?? []).find((a) => atalhoKey(a) === key);
      const stamp = nowIso();
      if (dup) {
        if (dup.deleted_at) {
          dup.deleted_at = null;
          dup.updated_at = stamp;
          if ((input.nome || "").trim()) dup.nome = input.nome!.trim();
        } else if ((input.nome || "").trim() && input.nome!.trim() !== dup.nome) {
          dup.nome = input.nome!.trim();
          dup.updated_at = stamp;
        }
        created = dup;
        return;
      }
      const pavs = store.pavilhoes;
      const from = pavs.find((p) => p.id === origem_pavilhao_id);
      const toPav = pavs.find((p) => p.id === destino_pavilhao_id);
      const dest = store.destinos.find((d) => d.id === destino_id);
      const auto =
        kind === "entrada"
          ? `Entrada · ${from ? pavTitle(from) : "pavilhão"}`
          : kind === "saida"
            ? `${from ? pavTitle(from) : "origem"} → ${dest?.nome ?? "cliente"}`
            : `${from ? pavTitle(from) : "origem"} → ${toPav ? pavTitle(toPav) : "destino"}`;
      created = {
        id: uid(),
        kind,
        nome: (input.nome || "").trim() || auto,
        origem_pavilhao_id,
        destino_pavilhao_id,
        destino_id,
        mercadoria_id,
        created_at: stamp,
        updated_at: stamp,
        usos: 0,
        deleted_at: null,
      };
      store.atalhos = [...(store.atalhos ?? []), created];
    });
    return created;
  },
  touchAtalho(id: string) {
    mutate((store) => {
      const row = (store.atalhos ?? []).find((a) => a.id === id);
      if (row && !row.deleted_at) {
        row.usos += 1;
        row.updated_at = nowIso();
      }
    });
  },
  deleteAtalho(id: string) {
    mutate((store) => {
      const row = (store.atalhos ?? []).find((a) => a.id === id);
      if (!row) return;
      row.deleted_at = nowIso();
      row.updated_at = row.deleted_at;
    });
  },
};
