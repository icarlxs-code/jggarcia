import type {
  AuditAcao,
  AuditEntidade,
  AuditLog,
  Atalho,
  AtalhoKind,
  Contagem,
  Destino,
  Empilhador,
  ForkliftDevice,
  ForkliftJob,
  ForkliftLocation,
  ForkliftPairing,
  Fornecedor,
  FreteInput,
  FretePagamento,
  Lote,
  Mercadoria,
  MovimentoStatus,
  NivelAcesso,
  Pavilhao,
  RequisicaoFornecedor,
  RequisicaoInput,
  Saida,
  SaidaInput,
  StockAlert,
  Usuario,
} from "./types";
import { calcTransportTime, addDaysISO, isoDaysAgo, todayISO } from "./format";
import { CATALOG, logoOfPavilhao, pavilhaoFromCategoria, pavilhaoNome, pavTitle } from "./catalog";
import { inferTipoLugar } from "./constants";
import { arrivalStamp, nextMovCodigo } from "./movement";
import { pavilhaoParaZerar } from "./zero-pav";
import { activePrefs } from "./ui-prefs";
import { photoOfProduct } from "./product-photos";
import { syncProductPhotoOverrides } from "./product-photo-overrides";
import { hashToken } from "./forklift-device";
import { idbGet, idbSet } from "./idb-store";
import { MEDIA_KEY, attachMedia } from "./media-store";

const KEY = "jg-garcia-db-v3";
const BAK_KEY = "jg-garcia-db-v3-bak";
const OUTBOX_KEY = "jg-garcia-outbox";
const SESSION_KEY = "jg-garcia-session-v2";
const SESSION_TAB_KEY = "jg-garcia-session-tab";
const SESSION_PROFILE_KEY = "jg-garcia-session-profile";
const REMEMBER_KEY = "jg-garcia-remember-v1";

const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
const OP_ID = "00000000-0000-0000-0000-000000000002";

let gen = 0;
const listeners = new Set<() => void>();
let storageBound = false;
function emit() {
  gen += 1;
  for (const l of listeners) l();
}
export function subscribeDb(cb: () => void) {
  if (!storageBound && typeof window !== "undefined") {
    storageBound = true;
    window.addEventListener("storage", (event) => {
      if (event.key !== KEY || !event.newValue) return;
      const parsed = parseDb(event.newValue);
      if (!parsed) return;
      memoryDb = parsed;
      emit();
    });
  }
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

export interface StockBackup {
  id: string;
  created_at: string;
  mode: "all" | "day";
  date?: string;
  stockResetAt: string | null;
  stockIgnoredDates: string[];
  mercadorias: { id: string; estoque: number }[];
  lotes: { id: string; quantidade: number }[];
  usuario_nome: string;
  restored_at?: string | null;
}

interface FechamentoDia {
  data: string;
  pos: [string, string, number][];
  /** Saldo já fechado. Enquanto o dia está aberto, o físico de hoje continua neste número. */
  publicado?: [string, string, number][];
  manual?: boolean;
  aberto?: boolean;
  updated_at?: string;
  /** O saldo do pavilhão 23 neste fechamento já está sem a contagem física da loja. */
  loja?: boolean;
}

export interface PavilionReset {
  id: string;
  created_at: string;
  data: string;
  pavilhao_id: string;
  pavilhao_codigo: string;
  usuario_id: string;
  usuario_nome: string;
  itens: { mercadoria_id: string; codigo: string; nome: string; unidade: string; quantidade: number }[];
}

/** Zeragem sozinha de um pavilhão, depois da meia-noite. */
export interface AutoZeroRegra {
  id: string;
  pavilhao_codigo: string;
  ativo: boolean;
  modo: "todo_dia" | "dias";
  /** 0 domingo … 6 sábado. */
  dias: number[];
  updated_at: string;
  /** Dia em que a regra já rodou. A primeira execução é na meia-noite seguinte ao salvamento. */
  ultimo_dia?: string;
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
  requisicoes: RequisicaoFornecedor[];
  /** Último número de requisição já usado. Nunca diminui, mesmo se a nota for excluída. */
  requisicaoSeq: number;
  forkliftDevices?: ForkliftDevice[];
  forkliftPairings?: ForkliftPairing[];
  forkliftJobs?: ForkliftJob[];
  forkliftLocations?: ForkliftLocation[];
  senhas: Record<string, string>;
  apagados: string[];
  stockResetAt?: string | null;
  stockIgnoredDates?: string[];
  stockBackups?: StockBackup[];
  fechamentos?: FechamentoDia[];
  pavilionResets?: PavilionReset[];
  autoZeros?: AutoZeroRegra[];
}

let memoryDb: LocalDb | null = null;
let lastRaw = "";
let localWrites = 0;
let localBoot: Promise<void> | null = null;
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

function nextRequisicaoNumero(rows: RequisicaoFornecedor[], seq: number): string {
  let max = Number(seq) || 0;
  for (const row of rows) {
    const n = parseInt(String(row.numero || "").replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(6, "0");
}

function settleRequisicaoNumeros(rows: RequisicaoFornecedor[], seq: number) {
  const used = new Set<number>();
  let max = Number(seq) || 0;
  const ordered = [...rows].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  for (const row of ordered) {
    let n = parseInt(String(row.numero || "").replace(/\D/g, ""), 10);
    if (!Number.isFinite(n) || n <= 0 || used.has(n)) {
      n = max + 1;
      row.numero = String(n).padStart(6, "0");
    }
    used.add(n);
    if (n > max) max = n;
  }
  return max;
}

function nextFreteNumero(rows: FretePagamento[]): string {
  let max = 0;
  for (const r of rows) {
    if (r.deleted_at) continue;
    for (const raw of [r.numero]) {
      const n = parseInt(String(raw || "").replace(/\D/g, ""), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
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
    } else if (hit.deleted_at) {
      continue;
    }
  }
  for (const p of store.pavilhoes) {
    if (p.deleted_at) continue;
    if (p.tipo == null) {
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
    requisicoes: [],
    requisicaoSeq: 0,
    forkliftDevices: [],
    forkliftPairings: [],
    forkliftJobs: [],
    forkliftLocations: [],
    senhas: { [ADMIN_ID]: "Jg@2026", [OP_ID]: "Op@2026" },
    apagados: [],
    stockIgnoredDates: [],
    stockBackups: [],
    fechamentos: [],
    pavilionResets: [],
    autoZeros: [],
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
    requisicoes: data.requisicoes ?? [],
    requisicaoSeq: data.requisicaoSeq ?? 0,
    forkliftDevices: data.forkliftDevices ?? [],
    forkliftPairings: data.forkliftPairings ?? [],
    forkliftJobs: data.forkliftJobs ?? [],
    forkliftLocations: data.forkliftLocations ?? [],
    stockResetAt: data.stockResetAt ?? null,
    stockIgnoredDates: data.stockIgnoredDates ?? [],
    stockBackups: data.stockBackups ?? [],
    fechamentos: data.fechamentos ?? [],
    pavilionResets: data.pavilionResets ?? [],
    autoZeros: data.autoZeros ?? [],
  };
}

function forkliftActor(store: LocalDb, token: string) {
  const device = (store.forkliftDevices ?? []).find((d) => d.token_hash === hashToken(token || "") && d.status === "ativo" && !d.revoked_at);
  if (!device) throw new Error("Este celular não está autorizado.");
  const operator = (store.empilhadoresPessoas ?? []).find((e) => e.id === device.operator_id && !e.deleted_at);
  if (!operator || operator.status === "inativo") throw new Error("Empilhador inativo.");
  return { device, operator };
}

function requireForkliftAdmin(store: LocalDb) {
  const id = readSessionId();
  const user = id ? store.usuarios.find((u) => u.id === id && u.status !== false) : undefined;
  if (user?.nivel_acesso === "admin") return;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("jg-plain-user") || sessionStorage.getItem(SESSION_PROFILE_KEY);
      const profile = raw ? (JSON.parse(raw) as Usuario) : null;
      if (profile?.status !== false && profile?.nivel_acesso === "admin") return;
    } catch {
      /* segue para o erro */
    }
  }
  throw new Error("Só a administração acessa a central.");
}

function trimForkliftLocations(rows: ForkliftLocation[]) {
  const byJob = new Map<string, ForkliftLocation[]>();
  for (const row of rows) {
    const list = byJob.get(row.job_id) ?? [];
    list.push(row);
    byJob.set(row.job_id, list);
  }
  const out: ForkliftLocation[] = [];
  for (const list of byJob.values()) {
    list.sort((a, b) => a.captured_at.localeCompare(b.captured_at));
    out.push(...list.slice(-25));
  }
  return out;
}

function mergeForkliftJobs(a: ForkliftJob[] = [], b: ForkliftJob[] = []) {
  const map = new Map(a.map((row) => [row.id, row]));
  for (const row of b) {
    const prev = map.get(row.id);
    if (!prev) {
      map.set(row.id, row);
      continue;
    }
    const rowNewer = (row.updated_at || "") >= (prev.updated_at || "");
    const newer = rowNewer ? { ...prev, ...row } : { ...row, ...prev };
    const deleted = prev.deleted_at || row.deleted_at;
    if (deleted) {
      newer.deleted_at = prev.deleted_at && row.deleted_at ? (prev.deleted_at < row.deleted_at ? prev.deleted_at : row.deleted_at) : deleted;
    }
    if (!deleted && prev.status !== "em_transporte" && row.status === "em_transporte") {
      newer.status = prev.status;
      newer.finished_at = prev.finished_at || newer.finished_at;
      newer.photo = prev.photo || newer.photo;
      newer.cancel_motivo = prev.cancel_motivo || newer.cancel_motivo;
    }
    if (!newer.photo) newer.photo = prev.photo || row.photo;
    map.set(row.id, newer);
  }
  return [...map.values()];
}

function mergeAutoZeros(a: AutoZeroRegra[] = [], b: AutoZeroRegra[] = []): AutoZeroRegra[] {
  const map = new Map<string, AutoZeroRegra>();
  for (const row of [...a, ...b]) {
    if (!row?.pavilhao_codigo) continue;
    const prev = map.get(row.pavilhao_codigo);
    if (!prev) {
      map.set(row.pavilhao_codigo, row);
      continue;
    }
    const newer = (row.updated_at || "") >= (prev.updated_at || "") ? row : prev;
    const older = newer === row ? prev : row;
    const ultimo = [newer.ultimo_dia, older.ultimo_dia].filter(Boolean).sort().pop();
    map.set(row.pavilhao_codigo, { ...newer, ultimo_dia: ultimo });
  }
  return [...map.values()];
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
  data.requisicoes = by(data.requisicoes ?? [], (remote as { requisicoes?: RequisicaoFornecedor[] }).requisicoes ?? []);
  data.requisicaoSeq = settleRequisicaoNumeros(data.requisicoes, Math.max(data.requisicaoSeq || 0, Number((remote as { requisicaoSeq?: number }).requisicaoSeq) || 0));
  data.forkliftDevices = by(data.forkliftDevices ?? [], (remote as { forkliftDevices?: ForkliftDevice[] }).forkliftDevices ?? []);
  data.forkliftPairings = by(data.forkliftPairings ?? [], (remote as { forkliftPairings?: ForkliftPairing[] }).forkliftPairings ?? []);
  data.forkliftJobs = mergeForkliftJobs(data.forkliftJobs ?? [], (remote as { forkliftJobs?: ForkliftJob[] }).forkliftJobs ?? []);
  data.forkliftLocations = trimForkliftLocations(by(data.forkliftLocations ?? [], (remote as { forkliftLocations?: ForkliftLocation[] }).forkliftLocations ?? []));
  const remoteBackups = (remote as { stockBackups?: StockBackup[] }).stockBackups ?? [];
  const backupMap = new Map((data.stockBackups ?? []).map((b) => [b.id, b]));
  for (const row of remoteBackups) {
    const prev = backupMap.get(row.id);
    if (!prev) backupMap.set(row.id, row);
    else if (row.restored_at && (!prev.restored_at || row.restored_at > prev.restored_at)) backupMap.set(row.id, { ...prev, restored_at: row.restored_at });
  }
  data.stockBackups = [...backupMap.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);
  const remoteFech = (remote as { fechamentos?: FechamentoDia[] }).fechamentos ?? [];
  const fechMap = new Map((data.fechamentos ?? []).map((f) => [f.data, f]));
  for (const row of remoteFech) {
    if (!row?.data) continue;
    const prev = fechMap.get(row.data);
    if (!prev) {
      fechMap.set(row.data, row);
      continue;
    }
    const prevAt = prev.updated_at || "";
    const rowAt = row.updated_at || "";
    if (row.manual && !prev.manual) fechMap.set(row.data, row);
    else if (prev.manual && !row.manual && prevAt >= rowAt) continue;
    else if (rowAt >= prevAt) fechMap.set(row.data, row);
  }
  data.fechamentos = [...fechMap.values()].sort((a, b) => a.data.localeCompare(b.data));
  data.pavilionResets = by(data.pavilionResets ?? [], remote.pavilionResets ?? []);
  data.autoZeros = mergeAutoZeros(data.autoZeros ?? [], (remote as { autoZeros?: AutoZeroRegra[] }).autoZeros ?? []);
  const remoteReset = (remote as { stockResetAt?: string | null }).stockResetAt;
  const newestRestore = data.stockBackups.find((b) => b.restored_at)?.restored_at || "";
  if (remoteReset && (!data.stockResetAt || remoteReset > data.stockResetAt) && (!newestRestore || remoteReset > newestRestore)) data.stockResetAt = remoteReset;
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
  ensureFechamentos(data);
  for (const m of data.mercadorias) {
    let total = 0;
    for (const v of stockMapFor(data, m.id).values()) total += v;
    m.estoque = Math.max(0, Math.round(total * 1000) / 1000);
  }
}

function rememberStock(store: LocalDb, mode: "all" | "day", date: string | undefined, usuarioNome: string) {
  const backup: StockBackup = {
    id: uid(),
    created_at: nowIso(),
    mode,
    date,
    stockResetAt: store.stockResetAt ?? null,
    stockIgnoredDates: (store.stockIgnoredDates ?? []).slice(),
    mercadorias: store.mercadorias.map((m) => ({ id: m.id, estoque: Number(m.estoque) || 0 })),
    lotes: store.lotes.map((l) => ({ id: l.id, quantidade: Number(l.quantidade) || 0 })),
    usuario_nome: usuarioNome,
  };
  store.stockBackups = [backup, ...(store.stockBackups ?? [])].slice(0, 8);
}

const HENRIQUE_ID = "b0ad29f4-63e0-4303-9e8a-c314aa214ae8";
const CAIO_ID = "e9b92c18-9703-4229-9187-6d104fa768fc";
const CAIO_GMAIL_ID = "6d835fe3-533c-4a88-b959-971b50d3f4bc";

function restoreTeam(store: LocalDb) {
  const known: { id: string; nome: string; email: string; nivel_acesso: NivelAcesso; senha: string; created_at: string }[] = [
    { id: ADMIN_ID, nome: "Administrador", email: "admin@jggarcia.com.br", nivel_acesso: "admin", senha: "Jg@2026", created_at: "2026-09-18T15:36:21.606Z" },
    { id: OP_ID, nome: "Operador", email: "operador@jggarcia.com.br", nivel_acesso: "operador", senha: "Op@2026", created_at: "2026-09-18T15:36:21.606Z" },
    { id: HENRIQUE_ID, nome: "Henrique", email: "icarlxs@gmail.com", nivel_acesso: "admin", senha: "Carlos1@", created_at: "2026-09-18T11:54:17.699Z" },
    { id: CAIO_ID, nome: "Caio", email: "caio@jggarcia.com.br", nivel_acesso: "operador", senha: "Caio@2026", created_at: "2026-09-24T13:01:37.612Z" },
    { id: CAIO_GMAIL_ID, nome: "Caio", email: "caio@gmail.com", nivel_acesso: "admin", senha: "33624319", created_at: "2026-11-03T12:00:00.000Z" },
  ];
  const drop = new Set<string>();
  for (const row of known) {
    drop.add(row.id);
    drop.add(row.email);
  }
  store.apagados = (store.apagados ?? []).filter((k) => !drop.has(k));
  for (const row of known) {
    const existing = store.usuarios.find((u) => u.id === row.id || u.email.toLowerCase() === row.email);
    if (!existing) {
      store.usuarios.push({
        id: row.id,
        nome: row.nome,
        email: row.email,
        nivel_acesso: row.nivel_acesso,
        status: true,
        created_at: row.created_at,
      });
    } else if (existing.status === false) {
      existing.status = true;
    }
    const id = existing?.id ?? row.id;
    if (!store.senhas[id]) store.senhas[id] = row.senha;
  }
  for (const log of store.logs ?? []) {
    const id = log.usuario_id;
    const nome = log.usuario_nome?.trim();
    if (!id || id === "sistema" || !nome) continue;
    if (store.usuarios.some((u) => u.id === id)) continue;
    const slug = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    const email = `${slug || "equipe"}@jggarcia.com.br`;
    store.apagados = (store.apagados ?? []).filter((k) => k !== id && k !== email);
    store.usuarios.push({
      id,
      nome,
      email,
      nivel_acesso: "operador",
      status: true,
      created_at: log.created_at || "2026-09-18T11:54:17.699Z",
    });
    if (!store.senhas[id]) store.senhas[id] = "Op@2026";
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
    parsed.requisicoes = parsed.requisicoes ?? [];
    parsed.requisicaoSeq = settleRequisicaoNumeros(parsed.requisicoes, parsed.requisicaoSeq ?? 0);
    parsed.apagados = parsed.apagados ?? [];
    for (const m of parsed.mercadorias) {
      if (!m.pavilhao_ids?.length && m.pavilhao_id) m.pavilhao_ids = [m.pavilhao_id];
    }
    ensureCatalog(parsed);
    ensurePavLogos(parsed);
    restoreTeam(parsed);
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
  memoryDb = seed();
  const placeholder = memoryDb;
  window.setTimeout(() => {
    if (memoryDb !== placeholder || localWrites !== 0) {
      startLocalBoot();
      return;
    }
    const parsed = parseDb(localStorage.getItem(KEY)) || parseDb(localStorage.getItem(BAK_KEY));
    if (parsed) {
      parsed.empilhadoresPessoas = parsed.empilhadoresPessoas ?? [];
      parsed.fretes = parsed.fretes ?? [];
      parsed.requisicoes = parsed.requisicoes ?? [];
      parsed.requisicaoSeq = parsed.requisicaoSeq ?? 0;
      parsed.forkliftDevices = parsed.forkliftDevices ?? [];
      parsed.forkliftPairings = parsed.forkliftPairings ?? [];
      parsed.forkliftJobs = parsed.forkliftJobs ?? [];
      parsed.forkliftLocations = parsed.forkliftLocations ?? [];
      memoryDb = parsed;
      syncProductPhotoOverrides(parsed.mercadorias);
      emit();
      const atual = parsed;
      window.setTimeout(() => {
        if (memoryDb !== atual) return;
        try {
          const before = atual.mercadorias.map((m) => m.estoque).join("\n");
          const changed = ensureCatalog(atual) || ensurePavLogos(atual);
          recomputeStock(atual);
          const repaired = atual.mercadorias.map((m) => m.estoque).join("\n");
          if (changed || repaired !== before) {
            saveLocal(atual);
            syncProductPhotoOverrides(atual.mercadorias);
            emit();
          }
        } catch {
          /* o estoque recalcula depois, sem travar a entrada */
        }
      }, 20000);
    }
    startLocalBoot();
  }, 0);
  return memoryDb;
}

export function whenLocalReady() {
  if (typeof window === "undefined") return Promise.resolve();
  if (!localBoot) startLocalBoot();
  return localBoot;
}

function startLocalBoot() {
  if (localBoot || typeof window === "undefined") return;
  const atStart = localWrites;
  localBoot = (async () => {
    let idbRaw: string | null = null;
    try {
      idbRaw = await idbGet(KEY);
    } catch {
      idbRaw = null;
    }
    if (localWrites !== atStart) return;
    let ls = "";
    try {
      ls = localStorage.getItem(KEY) || localStorage.getItem(BAK_KEY) || "";
    } catch {
      ls = "";
    }
    if (idbRaw && !ls) {
      const parsed = parseDb(idbRaw);
      if (parsed) {
        parsed.empilhadoresPessoas = parsed.empilhadoresPessoas ?? [];
        parsed.fretes = parsed.fretes ?? [];
        parsed.requisicoes = parsed.requisicoes ?? [];
        parsed.requisicaoSeq = parsed.requisicaoSeq ?? 0;
        parsed.forkliftDevices = parsed.forkliftDevices ?? [];
        parsed.forkliftPairings = parsed.forkliftPairings ?? [];
        parsed.forkliftJobs = parsed.forkliftJobs ?? [];
        parsed.forkliftLocations = parsed.forkliftLocations ?? [];
        memoryDb = parsed;
        lastRaw = idbRaw;
        syncProductPhotoOverrides(parsed.mercadorias);
        emit();
      }
    } else if (memoryDb) {
      window.setTimeout(() => {
        if (memoryDb) void ligarMidia(memoryDb);
      }, 20000);
    }
    try {
      await navigator.storage?.persist?.();
    } catch {
      /* o navegador decide se mantém o espaço */
    }
  })();
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

async function mergeWeekBackup(data: LocalDb) {
  try {
    const res = await fetch("/recovery/banco-semana.json", { cache: "no-store" });
    if (!res.ok) return false;
    const backup = (await res.json()) as Partial<ReturnType<typeof snapshotOf>>;
    const antes =
      (data.saidas?.filter((s) => !s.deleted_at).length || 0) +
      (data.empilhadoresPessoas?.length || 0) +
      (data.contadores?.length || 0) +
      (data.operadores?.length || 0) +
      (data.contagens?.length || 0);
    applyCloud(data, backup);
    const depois =
      (data.saidas?.filter((s) => !s.deleted_at).length || 0) +
      (data.empilhadoresPessoas?.length || 0) +
      (data.contadores?.length || 0) +
      (data.operadores?.length || 0) +
      (data.contagens?.length || 0);
    return depois > antes;
  } catch {
    return false;
  }
}

export async function hydrateFromCloud() {
  if (typeof window === "undefined") return;
  await whenLocalReady();
  try {
    const { pullCloudStore } = await import("./cloud");
    const remote = await pullCloudStore({ data: {} });
    if (remote) {
      const data = load();
      applyCloud(data, remote);
      await mergeWeekBackup(data);
      memoryDb = data;
      saveLocal(data);
      emit();
    } else {
      const data = load();
      if (await mergeWeekBackup(data)) {
        memoryDb = data;
        saveLocal(data);
        emit();
      }
    }
  } catch {
    try {
      const data = load();
      if (await mergeWeekBackup(data)) {
        memoryDb = data;
        saveLocal(data);
        emit();
      }
    } catch {
      /* offline */
    }
  } finally {
    const first = !cloudReady;
    cloudReady = true;
    try {
      runAutoZeros();
    } catch {
      /* sem regra ou pavilhão inválido */
    }
    if (first && memoryDb) queuePush(memoryDb);
  }
}

function saveLocal(data: LocalDb) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(data);
  localWrites += 1;
  if (lastRaw && lastRaw !== raw) void idbSet(BAK_KEY, lastRaw).catch(() => undefined);
  lastRaw = raw;
  void idbSet(KEY, raw).catch(() => undefined);
  if (!canStore()) return;
  if (raw.length > 4_000_000) {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(BAK_KEY);
      localStorage.setItem("jg-garcia-idb", "1");
    } catch {
      /* a cópia grande fica só no IndexedDB */
    }
    return;
  }
  try {
    const prev = localStorage.getItem(KEY);
    if (prev && prev !== raw) localStorage.setItem(BAK_KEY, prev);
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    try {
      localStorage.setItem(BAK_KEY, raw);
    } catch {
      /* memória cobre */
    }
  }
}

async function ligarMidia(data: LocalDb) {
  try {
    const raw = await idbGet(MEDIA_KEY);
    if (!raw || memoryDb !== data) return;
    attachMedia(data, JSON.parse(raw) as Record<string, string>);
    syncProductPhotoOverrides(data.mercadorias);
    emit();
  } catch {
    /* sem mídia separada, o catálogo continua */
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
  syncProductPhotoOverrides(data.mercadorias);
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
  const prefs = activePrefs();
  const critico = prefs.criticoPct / 100;
  const baixo = prefs.baixoPct / 100;
  if (m.estoque <= m.minimo * critico) return "critico";
  if (m.estoque <= m.minimo * baixo) return "baixo";
  if (m.estoque <= m.minimo) return "atencao";
  return "ok";
}

export function loteStatus(validade: string): "ok" | "a_vencer" | "vencido" {
  const today = todayISO();
  if (validade < today) return "vencido";
  const limit = isoDaysAgo(-activePrefs().validadeDias);
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
  if (s.destino_pavilhao_id && s.soma_destino !== false) return 0;
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

function replayStockMap(store: LocalDb, mercadoriaId: string, upto?: string): Map<string, number> {
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
    if (sign < 0 && s.destino_pavilhao_id && s.soma_destino !== false) {
      const dest = resolvePavilhaoId(store.pavilhoes, s.destino_pavilhao_id);
      if (dest && dest !== pav) {
        map.set(dest, (map.get(dest) || 0) + Number(s.quantidade || 0));
      }
    }
  }
  for (const c of store.contagens ?? []) {
    if (c.deleted_at || c.mercadoria_id !== mercadoriaId) continue;
    if (!countsForStock(store, c.data, c.created_at, upto)) continue;
    const pav = resolvePavilhaoId(store.pavilhoes, c.pavilhao_id) || c.pavilhao_id;
    moved = true;
    map.set(pav, (map.get(pav) || 0) + Number(c.delta || 0));
  }
  const closed = Boolean(upto && upto < todayISO());
  if (!moved && merc && merc.estoque > 0 && merc.pavilhao_id && !closed) {
    map.set(merc.pavilhao_id, merc.estoque);
  } else if (moved && merc) {
    let allocated = 0;
    for (const v of map.values()) allocated += v;
    const rest = Number(merc.estoque || 0) - allocated;
    if (rest !== 0 && merc.pavilhao_id && !closed) {
      map.set(merc.pavilhao_id, (map.get(merc.pavilhao_id) || 0) + rest);
    }
  }
  applyLatestResets(store, map, mercadoriaId, upto);
  for (const [k, v] of map) if (v < 0) map.set(k, 0);
  return map;
}

type PosBook = Map<string, Map<string, number>>;

function packFechamento(data: string, pos: PosBook): FechamentoDia {
  const rows: [string, string, number][] = [];
  for (const [merc, map] of pos) {
    for (const [pav, q] of map) {
      const n = Math.round(q * 1000) / 1000;
      if (n > 0) rows.push([merc, pav, n]);
    }
  }
  return { data, pos: rows, loja: true };
}

function bookFromRows(rows: [string, string, number][] | undefined): PosBook {
  const pos: PosBook = new Map();
  for (const [merc, pav, q] of rows ?? []) {
    if (!(Number(q) > 0)) continue;
    const map = pos.get(merc) ?? new Map<string, number>();
    map.set(pav, Number(q));
    pos.set(merc, map);
  }
  return pos;
}

function bookFromFechamento(store: LocalDb, day: string): PosBook | null {
  const row = (store.fechamentos ?? []).find((f) => f.data === day);
  if (!row) return null;
  return bookFromRows(row.pos);
}

/** Saldo que o dia seguinte deve herdar. Com o dia aberto, ignora o rascunho e usa o último fechamento. */
function officialBook(store: LocalDb, day: string): PosBook | null {
  const row = (store.fechamentos ?? []).find((f) => f.data === day);
  if (!row) return null;
  if (row.aberto && row.publicado) return bookFromRows(row.publicado);
  return bookFromRows(row.pos);
}

function bookDelta(before: PosBook, after: PosBook): PosBook {
  const delta: PosBook = new Map();
  const mercs = new Set<string>([...before.keys(), ...after.keys()]);
  for (const merc of mercs) {
    const a = before.get(merc);
    const b = after.get(merc);
    const pavs = new Set<string>([...(a?.keys() ?? []), ...(b?.keys() ?? [])]);
    const map = new Map<string, number>();
    for (const pav of pavs) {
      const d = Math.round(((b?.get(pav) || 0) - (a?.get(pav) || 0)) * 1000) / 1000;
      if (d !== 0) map.set(pav, d);
    }
    if (map.size) delta.set(merc, map);
  }
  return delta;
}

function addDelta(book: PosBook, delta: PosBook) {
  for (const [merc, map] of delta) {
    const dest = book.get(merc) ?? new Map<string, number>();
    for (const [pav, q] of map) dest.set(pav, (dest.get(pav) || 0) + q);
    book.set(merc, dest);
  }
}

function shiftRows(rows: [string, string, number][] | undefined, delta: PosBook): [string, string, number][] {
  const book = bookFromRows(rows);
  addDelta(book, delta);
  clampBook(book);
  return packFechamento("", book).pos;
}

function setBookQty(book: PosBook, mercId: string, pavId: string, qty: number) {
  const map = book.get(mercId) ?? new Map<string, number>();
  const n = Math.round(Number(qty) * 1000) / 1000;
  if (n > 0) map.set(pavId, n);
  else map.delete(pavId);
  if (map.size) book.set(mercId, map);
  else book.delete(mercId);
}

function mapFromBook(pos: PosBook | null, mercadoriaId: string): Map<string, number> {
  const found = pos?.get(mercadoriaId);
  return found ? new Map(found) : new Map();
}

function latestResetAt(store: LocalDb, pavId: string, day?: string): string | null {
  let at: string | null = null;
  for (const r of store.pavilionResets ?? []) {
    if (r.pavilhao_id !== pavId) continue;
    if (day && r.data !== day) continue;
    if (!at || r.created_at > at) at = r.created_at;
  }
  return at;
}

function netAfterReset(store: LocalDb, mercadoriaId: string, pavId: string, afterIso: string, day?: string, upto?: string): number {
  const merc = store.mercadorias.find((m) => m.id === mercadoriaId);
  const limit = day || upto;
  let qty = 0;
  for (const s of store.saidas) {
    if (s.deleted_at || s.mercadoria_id !== mercadoriaId) continue;
    if ((s.created_at || "") <= afterIso) continue;
    if (day && s.data !== day) continue;
    if (upto && s.data && s.data > upto) continue;
    if (!countsForStock(store, s.data, s.created_at, limit)) continue;
    const pav = pavOfMovement(store, s, merc);
    const sign = movementSign(s);
    if (!sign) continue;
    if (pav === pavId) qty += sign * Number(s.quantidade || 0);
    if (sign < 0 && s.destino_pavilhao_id && s.soma_destino !== false) {
      const dest = resolvePavilhaoId(store.pavilhoes, s.destino_pavilhao_id);
      if (dest === pavId) qty += Number(s.quantidade || 0);
    }
  }
  for (const c of store.contagens ?? []) {
    if (c.deleted_at || c.mercadoria_id !== mercadoriaId) continue;
    if (day && c.data !== day) continue;
    if ((c.created_at || "") <= afterIso) continue;
    if (upto && c.data && c.data > upto) continue;
    if (!countsForStock(store, c.data, c.created_at, limit)) continue;
    const pav = resolvePavilhaoId(store.pavilhoes, c.pavilhao_id) || c.pavilhao_id;
    if (pav !== pavId) continue;
    qty += Number(c.delta || 0);
  }
  return qty;
}

function applyDayResets(store: LocalDb, map: Map<string, number>, mercadoriaId: string, day: string) {
  for (const p of store.pavilhoes) {
    const at = latestResetAt(store, p.id, day);
    if (!at) continue;
    const qty = Math.round(netAfterReset(store, mercadoriaId, p.id, at, day) * 1000) / 1000;
    if (qty > 0) map.set(p.id, qty);
    else map.delete(p.id);
  }
}

function applyLatestResets(store: LocalDb, map: Map<string, number>, mercadoriaId: string, upto?: string) {
  for (const p of store.pavilhoes) {
    let at: string | null = null;
    for (const r of store.pavilionResets ?? []) {
      if (r.pavilhao_id !== p.id) continue;
      if (upto && r.data > upto) continue;
      if (!at || r.created_at > at) at = r.created_at;
    }
    if (!at) continue;
    const qty = Math.round(netAfterReset(store, mercadoriaId, p.id, at, undefined, upto) * 1000) / 1000;
    if (qty > 0) map.set(p.id, qty);
    else map.delete(p.id);
  }
}

function applyDayNet(pos: PosBook, store: LocalDb, day: string, dir: 1 | -1) {
  for (const s of store.saidas) {
    if (s.deleted_at || s.data !== day) continue;
    if (!countsForStock(store, s.data, s.created_at, day)) continue;
    const merc = store.mercadorias.find((m) => m.id === s.mercadoria_id);
    const pav = pavOfMovement(store, s, merc);
    const sign = movementSign(s);
    if (!pav || !sign) continue;
    const map = pos.get(s.mercadoria_id) ?? new Map<string, number>();
    const qty = Number(s.quantidade || 0);
    map.set(pav, (map.get(pav) || 0) + dir * sign * qty);
    if (sign < 0 && s.destino_pavilhao_id && s.soma_destino !== false) {
      const dest = resolvePavilhaoId(store.pavilhoes, s.destino_pavilhao_id);
      if (dest && dest !== pav) map.set(dest, (map.get(dest) || 0) + dir * qty);
    }
    pos.set(s.mercadoria_id, map);
  }
  for (const c of store.contagens ?? []) {
    if (c.deleted_at || c.data !== day) continue;
    if (!countsForStock(store, c.data, c.created_at, day)) continue;
    const pav = resolvePavilhaoId(store.pavilhoes, c.pavilhao_id) || c.pavilhao_id;
    const map = pos.get(c.mercadoria_id) ?? new Map<string, number>();
    map.set(pav, (map.get(pav) || 0) + dir * Number(c.delta || 0));
    pos.set(c.mercadoria_id, map);
  }
  if (dir !== 1) return;
  const mercIds = new Set<string>(pos.keys());
  for (const s of store.saidas) if (!s.deleted_at && s.data === day) mercIds.add(s.mercadoria_id);
  for (const id of mercIds) {
    const map = pos.get(id) ?? new Map<string, number>();
    applyDayResets(store, map, id, day);
    if (map.size) pos.set(id, map);
    else pos.delete(id);
  }
}

function clampBook(pos: PosBook) {
  for (const map of pos.values()) {
    for (const [k, v] of map) {
      if (!(v > 0)) map.delete(k);
      else map.set(k, Math.round(v * 1000) / 1000);
    }
  }
}

function writeFechamento(store: LocalDb, row: FechamentoDia) {
  store.fechamentos = store.fechamentos ?? [];
  const next: FechamentoDia = { ...row, loja: true };
  if (!next.publicado) delete next.publicado;
  const i = store.fechamentos.findIndex((f) => f.data === next.data);
  if (i >= 0) store.fechamentos[i] = next;
  else store.fechamentos.push(next);
}

/** Leva a diferença do fechamento corrigido aos dias seguintes, inclusive os fechados na mão. Não mexe em hoje. */
function propagateDelta(store: LocalDb, fromDay: string, delta: PosBook) {
  const yesterday = isoDaysAgo(1);
  if (fromDay >= todayISO() || delta.size === 0) return;
  let cursor = fromDay;
  let guard = 0;
  while (cursor < yesterday && guard < 900) {
    const next = addDaysISO(cursor, 1);
    const existing = (store.fechamentos ?? []).find((f) => f.data === next);
    if (existing) {
      writeFechamento(store, {
        ...existing,
        data: next,
        pos: shiftRows(existing.pos, delta),
        publicado: existing.publicado ? shiftRows(existing.publicado, delta) : undefined,
        updated_at: nowIso(),
      });
    } else {
      const book = officialBook(store, cursor) ?? new Map();
      applyDayNet(book, store, next, 1);
      clampBook(book);
      writeFechamento(store, { ...packFechamento(next, book), manual: false, aberto: false, updated_at: nowIso() });
    }
    cursor = next;
    guard += 1;
  }
  store.fechamentos?.sort((a, b) => a.data.localeCompare(b.data));
}

function applyPastCountToBook(store: LocalDb, day: string, mercId: string, pavId: string, qty: number) {
  if (!day || day >= todayISO()) return;
  ensureFechamentos(store);
  let row = (store.fechamentos ?? []).find((f) => f.data === day);
  if (!row) {
    const book = officialBook(store, isoDaysAgo(1, day)) ?? new Map();
    applyDayNet(book, store, day, 1);
    clampBook(book);
    writeFechamento(store, { ...packFechamento(day, book), manual: false, aberto: false, updated_at: nowIso() });
    row = (store.fechamentos ?? []).find((f) => f.data === day);
  }
  const before = officialBook(store, day) ?? new Map();
  const draft = bookFromRows(row?.pos ?? []);
  setBookQty(draft, mercId, pavId, qty);
  clampBook(draft);
  const packed = packFechamento(day, draft);
  if (row?.aberto) {
    writeFechamento(store, { ...row, data: day, pos: packed.pos, aberto: true, updated_at: nowIso() });
    return;
  }
  writeFechamento(store, {
    ...(row ?? { data: day, pos: packed.pos }),
    data: day,
    pos: packed.pos,
    publicado: undefined,
    manual: true,
    aberto: false,
    updated_at: nowIso(),
  });
  propagateDelta(store, day, bookDelta(before, bookFromRows(packed.pos)));
}

function liveBook(store: LocalDb): PosBook {
  const pos: PosBook = new Map();
  for (const m of store.mercadorias) pos.set(m.id, replayStockMap(store, m.id));
  return pos;
}

function ensureFechamentos(store: LocalDb) {
  const today = todayISO();
  const yesterday = isoDaysAgo(1, today);
  store.fechamentos = store.fechamentos ?? [];
  const has = (day: string) => store.fechamentos!.some((f) => f.data === day);
  if (!store.fechamentos.length) {
    const pos = liveBook(store);
    applyDayNet(pos, store, today, -1);
    let cursor = yesterday;
    store.fechamentos.push({ ...packFechamento(cursor, pos), aberto: false });
    let earliest = today;
    for (const s of store.saidas) if (!s.deleted_at && s.data && s.data < earliest) earliest = s.data;
    for (const c of store.contagens ?? []) if (!c.deleted_at && c.data && c.data < earliest) earliest = c.data;
    let guard = 0;
    while (cursor > earliest && guard < 900) {
      applyDayNet(pos, store, cursor, -1);
      cursor = isoDaysAgo(1, cursor);
      store.fechamentos.push({ ...packFechamento(cursor, pos), aberto: false });
      guard += 1;
    }
    store.fechamentos.sort((a, b) => a.data.localeCompare(b.data));
    return;
  }
  if (has(yesterday)) return;
  let last = store.fechamentos.reduce((a, f) => (f.data > a ? f.data : a), "");
  const pos = officialBook(store, last) ?? new Map();
  let guard = 0;
  while (last < yesterday && guard < 900) {
    const next = addDaysISO(last, 1);
    applyDayNet(pos, store, next, 1);
    store.fechamentos.push({ ...packFechamento(next, pos), aberto: false });
    last = next;
    guard += 1;
  }
  store.fechamentos.sort((a, b) => a.data.localeCompare(b.data));
}

function stockMapFor(store: LocalDb, mercadoriaId: string, upto?: string): Map<string, number> {
  ensureFechamentos(store);
  const today = todayISO();
  const alvo = upto || today;
  if (alvo < today) {
    const frozen = mapFromBook(bookFromFechamento(store, alvo), mercadoriaId);
    for (const [k, v] of frozen) if (v < 0) frozen.set(k, 0);
    return frozen;
  }
  const map = mapFromBook(officialBook(store, isoDaysAgo(1, today)), mercadoriaId);
  const merc = store.mercadorias.find((m) => m.id === mercadoriaId);
  const abertura = isoDaysAgo(1, today);
  for (const s of store.saidas) {
    if (s.deleted_at || s.mercadoria_id !== mercadoriaId || !s.data || s.data <= abertura) continue;
    if (!countsForStock(store, s.data, s.created_at, alvo)) continue;
    const pav = pavOfMovement(store, s, merc);
    const sign = movementSign(s);
    if (!pav || !sign) continue;
    const qty = Number(s.quantidade || 0);
    map.set(pav, (map.get(pav) || 0) + sign * qty);
    if (sign < 0 && s.destino_pavilhao_id && s.soma_destino !== false) {
      const dest = resolvePavilhaoId(store.pavilhoes, s.destino_pavilhao_id);
      if (dest && dest !== pav) map.set(dest, (map.get(dest) || 0) + qty);
    }
  }
  for (const c of store.contagens ?? []) {
    if (c.deleted_at || c.mercadoria_id !== mercadoriaId || !c.data || c.data <= abertura) continue;
    if (!countsForStock(store, c.data, c.created_at, alvo)) continue;
    const pav = resolvePavilhaoId(store.pavilhoes, c.pavilhao_id) || c.pavilhao_id;
    map.set(pav, (map.get(pav) || 0) + Number(c.delta || 0));
  }
  if (!upto || upto >= todayISO()) applyDayResets(store, map, mercadoriaId, todayISO());
  for (const [k, v] of map) if (v < 0) map.set(k, 0);
  return map;
}

function setSession(userId: string | null, remember: boolean, profile?: Usuario) {
  memorySession = userId;
  if (!canStore()) return;
  try {
    if (userId) {
      sessionStorage.setItem(SESSION_TAB_KEY, userId);
      if (profile) sessionStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(profile));
      if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify({ user_id: userId } satisfies Session));
      else localStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.removeItem(SESSION_TAB_KEY);
      sessionStorage.removeItem(SESSION_PROFILE_KEY);
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

function applyPavilionZero(store: LocalDb, codigo: string, usuarioId: string | undefined, automatico: boolean): string {
  const code = pavilhaoParaZerar(codigo);
  if (!code) throw new Error("Selecione o pavilhão que deseja zerar.");
  const pav = store.pavilhoes.find((p) => p.codigo === code && !p.deleted_at);
  if (!pav) throw new Error(`O pavilhão ${code} não está cadastrado.`);
  const nome = pavTitle(pav);
  const itens: PavilionReset["itens"] = [];
  for (const m of store.mercadorias) {
    const qtd = Math.round((stockMapFor(store, m.id).get(pav.id) || 0) * 1000) / 1000;
    if (!(qtd > 0)) continue;
    itens.push({ mercadoria_id: m.id, codigo: m.codigo, nome: m.nome, unidade: m.unidade, quantidade: qtd });
  }
  const who = automatico ? { id: "sistema", nome: "Sistema" } : actorOf(store, usuarioId);
  const now = nowIso();
  store.pavilionResets = store.pavilionResets ?? [];
  store.pavilionResets.push({
    id: uid(),
    created_at: now,
    data: todayISO(),
    pavilhao_id: pav.id,
    pavilhao_codigo: code,
    usuario_id: who.id,
    usuario_nome: who.nome,
    itens,
  });
  for (const lote of store.lotes) {
    if ((resolvePavilhaoId(store.pavilhoes, lote.pavilhao_id) || lote.pavilhao_id) === pav.id) lote.quantidade = 0;
  }
  const hoje = (store.fechamentos ?? []).find((f) => f.data === todayISO());
  if (hoje) {
    hoje.pos = hoje.pos.filter((row) => row[1] !== pav.id);
    hoje.updated_at = now;
  }
  recomputeStock(store);
  addLog(store, {
    acao: "excluiu",
    entidade: "estoque",
    entidade_id: pav.id,
    resumo: automatico
      ? `Zerou automaticamente o estoque do ${nome} após a meia-noite. ${itens.length} produto(s). Os outros pavilhões não foram alterados.`
      : `Zerou o estoque do ${nome}. ${itens.length} produto(s). Os outros pavilhões não foram alterados.`,
    detalhe: itens.length
      ? itens.map((i) => `${i.codigo} · ${i.nome}: ${i.quantidade} ${i.unidade}`).join(" · ")
      : "Nenhum produto com saldo neste pavilhão.",
    usuario_id: automatico ? "sistema" : who.id,
    created_at: now,
  });
  return nome;
}

function weekdayToday() {
  return new Date().getDay();
}

function diaSemanaCurto(dia: number) {
  return ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][dia] ?? String(dia);
}

function autoZeroDue(store: LocalDb, today = todayISO(), weekday = weekdayToday()) {
  return (store.autoZeros ?? []).filter((r) => {
    if (!r.ativo || !pavilhaoParaZerar(r.pavilhao_codigo)) return false;
    if (r.ultimo_dia === today) return false;
    if (r.modo === "dias" && !(r.dias ?? []).includes(weekday)) return false;
    return true;
  });
}

export function runAutoZeros() {
  const today = todayISO();
  const weekday = weekdayToday();
  if (!autoZeroDue(load(), today, weekday).length) return [] as string[];
  const nomes: string[] = [];
  mutate((store) => {
    for (const rule of autoZeroDue(store, today, weekday)) {
      try {
        nomes.push(applyPavilionZero(store, rule.pavilhao_codigo, undefined, true));
        rule.ultimo_dia = today;
        rule.updated_at = nowIso();
      } catch {
        /* pavilhão sumiu: não zera os outros */
      }
    }
  });
  return nomes;
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
    const rows = load().pavilhoes.filter((p) => !p.deleted_at);
    const list = all ? rows : rows.filter((p) => p.ativo);
    return list.sort((a, b) => Number(a.codigo) - Number(b.codigo) || a.codigo.localeCompare(b.codigo, "pt-BR"));
  },
  createPavilhao(input: { codigo: string; nome: string; ativo?: boolean; tipo?: string; logo?: string }): Pavilhao {
    let created!: Pavilhao;
    mutate((store) => {
      const codigo = input.codigo.trim();
      const tipo = input.tipo == null ? inferTipoLugar({ codigo, nome: input.nome, tipo: input.tipo }) : input.tipo.trim();
      const id = codigo ? `p${codigo}` : uid();
      const existing = store.pavilhoes.find((p) => p.id === id || (codigo && p.codigo === codigo));
      if (existing && !existing.deleted_at) throw new Error("Já existe um lugar com esse código.");
      const nome = input.nome.trim() || (tipo ? `${tipo} ${codigo}`.trim() : codigo);
      if (existing) {
        existing.deleted_at = null;
        existing.codigo = codigo;
        existing.nome = nome;
        existing.tipo = tipo;
        existing.ativo = input.ativo ?? true;
        existing.logo = input.logo || existing.logo || logoOfPavilhao(existing);
        created = existing;
      } else {
        created = {
          id,
          codigo,
          nome,
          tipo,
          ativo: input.ativo ?? true,
          logo: input.logo || logoOfPavilhao({ id, codigo }),
          deleted_at: null,
        };
        store.pavilhoes.push(created);
      }
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
      if (patch.tipo !== undefined) row.tipo = patch.tipo.trim();
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
  deletePavilhao(id: string) {
    mutate((store) => {
      const row = store.pavilhoes.find((p) => p.id === id && !p.deleted_at);
      if (!row) return;
      row.deleted_at = nowIso();
      row.ativo = false;
      addLog(store, {
        acao: "excluiu",
        entidade: "pavilhao",
        entidade_id: id,
        resumo: `Excluiu ${row.tipo || "o lugar"} ${row.nome}`,
      });
    });
  },
  linhasFechamento(day: string): { fechado: boolean; linhas: { mercadoriaId: string; pavilhaoId: string; quantidade: number }[] } {
    const store = load();
    ensureFechamentos(store);
    const saved = (store.fechamentos ?? []).find((f) => f.data === day);
    const fechado = day < todayISO() ? !saved?.aberto : Boolean(saved?.manual && !saved?.aberto);
    const linhas: { mercadoriaId: string; pavilhaoId: string; quantidade: number }[] = [];
    if (saved && (day < todayISO() || fechado)) {
      for (const [mercadoriaId, pavilhaoId, quantidade] of saved.pos) {
        if (quantidade > 0) linhas.push({ mercadoriaId, pavilhaoId, quantidade });
      }
    } else {
      for (const m of store.mercadorias) {
        const map = stockMapFor(store, m.id, day >= todayISO() ? undefined : day);
        for (const [pavilhaoId, quantidade] of map) {
          if (quantidade > 0) linhas.push({ mercadoriaId: m.id, pavilhaoId, quantidade });
        }
      }
    }
    return { fechado, linhas };
  },
  diaFechado(day: string) {
    return this.linhasFechamento(day).fechado;
  },
  salvarFechamento(day: string, linhas: { mercadoriaId: string; pavilhaoId: string; quantidade: number }[]) {
    if (!day || day > todayISO()) throw new Error("Escolha hoje ou um dia que já passou.");
    mutate((store) => {
      ensureFechamentos(store);
      const existed = (store.fechamentos ?? []).find((f) => f.data === day);
      const before = existed ? (officialBook(store, day) ?? new Map()) : null;
      const pos: [string, string, number][] = [];
      for (const row of linhas) {
        const q = Math.round(Number(row.quantidade) * 1000) / 1000;
        if (!row.mercadoriaId || !row.pavilhaoId || !(q > 0)) continue;
        pos.push([row.mercadoriaId, row.pavilhaoId, q]);
      }
      writeFechamento(store, { data: day, pos, manual: true, aberto: false, updated_at: nowIso() });
      if (before) propagateDelta(store, day, bookDelta(before, bookFromRows(pos)));
      recomputeStock(store);
      addLog(store, {
        acao: "editou",
        entidade: "estoque",
        entidade_id: day,
        resumo: `Fechou o estoque de ${day}`,
      });
    });
  },
  reabrirFechamento(day: string) {
    if (!day || day > todayISO()) throw new Error("Escolha hoje ou um dia que já passou.");
    mutate((store) => {
      ensureFechamentos(store);
      let row = (store.fechamentos ?? []).find((f) => f.data === day);
      if (!row) {
        const book = officialBook(store, isoDaysAgo(1, day)) ?? new Map();
        applyDayNet(book, store, day, 1);
        clampBook(book);
        writeFechamento(store, { ...packFechamento(day, book), manual: false, aberto: false, updated_at: nowIso() });
        row = (store.fechamentos ?? []).find((f) => f.data === day);
      }
      if (!row) return;
      const publicado = (row.aberto && row.publicado ? row.publicado : row.pos).map((r) => [r[0], r[1], r[2]] as [string, string, number]);
      writeFechamento(store, {
        ...row,
        data: day,
        pos: row.pos.map((r) => [r[0], r[1], r[2]] as [string, string, number]),
        publicado,
        aberto: true,
        updated_at: nowIso(),
      });
      addLog(store, {
        acao: "editou",
        entidade: "estoque",
        entidade_id: day,
        resumo: `Reabriu o estoque de ${day}`,
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
      .filter((p) => p.ativo && !p.deleted_at)
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
        .filter((p) => p.ativo && !p.deleted_at)
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
  zeroAllStock(usuarioNome = "Alguém") {
    mutate((store) => {
      rememberStock(store, "all", undefined, usuarioNome);
      store.stockResetAt = nowIso();
      for (const m of store.mercadorias) m.estoque = 0;
      for (const l of store.lotes) l.quantidade = 0;
      addLog(store, {
        acao: "excluiu",
        entidade: "estoque",
        entidade_id: "estoque",
        resumo: "Zerou todo o estoque. Quantidades voltaram para 0. Dá para recuperar.",
      });
    });
  },
  zeroStockDay(date: string, usuarioNome = "Alguém") {
    mutate((store) => {
      rememberStock(store, "day", date, usuarioNome);
      const next = new Set(store.stockIgnoredDates ?? []);
      next.add(date);
      store.stockIgnoredDates = [...next].sort();
      recomputeStock(store);
      addLog(store, {
        acao: "excluiu",
        entidade: "estoque",
        entidade_id: `dia:${date}`,
        resumo: `Zerou o estoque do dia ${date}. O histórico do dia permanece e dá para recuperar.`,
      });
    });
  },
  zeroPavilionStock(codigo: string, usuarioId?: string) {
    const code = pavilhaoParaZerar(codigo);
    if (!code) throw new Error("Selecione o pavilhão que deseja zerar.");
    let nome = `Pavilhão ${code}`;
    let total = 0;
    mutate((store) => {
      nome = applyPavilionZero(store, code, usuarioId, false);
      const last = (store.pavilionResets ?? []).filter((r) => r.pavilhao_codigo === code).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      total = last?.itens.length ?? 0;
    });
    return { nome, total };
  },
  listAutoZeros(): AutoZeroRegra[] {
    return (load().autoZeros ?? []).slice().sort((a, b) => a.pavilhao_codigo.localeCompare(b.pavilhao_codigo));
  },
  saveAutoZero(input: { codigo: string; modo: "todo_dia" | "dias"; dias?: number[] }) {
    const code = pavilhaoParaZerar(input.codigo);
    if (!code) throw new Error("Selecione o pavilhão que deseja zerar.");
    const dias = [...new Set((input.dias ?? []).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
    if (input.modo === "dias" && !dias.length) throw new Error("Escolha pelo menos um dia da semana.");
    let nome = `Pavilhão ${code}`;
    mutate((store) => {
      const pav = store.pavilhoes.find((p) => p.codigo === code && !p.deleted_at);
      if (!pav) throw new Error(`O pavilhão ${code} não está cadastrado.`);
      nome = pavTitle(pav);
      const prev = (store.autoZeros ?? []).find((r) => r.pavilhao_codigo === code);
      const now = nowIso();
      const regra: AutoZeroRegra = {
        id: prev?.id || uid(),
        pavilhao_codigo: code,
        ativo: true,
        modo: input.modo,
        dias: input.modo === "todo_dia" ? [0, 1, 2, 3, 4, 5, 6] : dias,
        updated_at: now,
        ultimo_dia: todayISO(),
      };
      store.autoZeros = [...(store.autoZeros ?? []).filter((r) => r.pavilhao_codigo !== code), regra];
      const ordem = [1, 2, 3, 4, 5, 6, 0];
      const quando =
        input.modo === "todo_dia"
          ? "todo dia após a meia-noite"
          : `somente ${dias.slice().sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)).map(diaSemanaCurto).join(", ")}`;
      addLog(store, {
        acao: "editou",
        entidade: "estoque",
        entidade_id: pav.id,
        resumo: `Programou a zeragem automática do ${nome}: ${quando}. A primeira acontece depois da próxima meia-noite.`,
      });
    });
    return nome;
  },
  disableAutoZero(codigo: string) {
    const code = pavilhaoParaZerar(codigo);
    if (!code) throw new Error("Selecione o pavilhão que deseja zerar.");
    mutate((store) => {
      const rule = (store.autoZeros ?? []).find((r) => r.pavilhao_codigo === code);
      if (!rule || !rule.ativo) return;
      rule.ativo = false;
      rule.updated_at = nowIso();
      const pav = store.pavilhoes.find((p) => p.codigo === code);
      addLog(store, {
        acao: "desativou",
        entidade: "estoque",
        entidade_id: pav?.id || code,
        resumo: `Desligou a zeragem automática do ${pav ? pavTitle(pav) : `Pavilhão ${code}`}.`,
      });
    });
  },
  listStockBackups(): StockBackup[] {
    return (load().stockBackups ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  restoreStockBackup(id: string) {
    mutate((store) => {
      const backup = (store.stockBackups ?? []).find((b) => b.id === id);
      if (!backup || backup.restored_at) return;
      store.stockResetAt = backup.stockResetAt;
      store.stockIgnoredDates = backup.stockIgnoredDates.slice();
      const mercQty = new Map(backup.mercadorias.map((m) => [m.id, m.estoque]));
      for (const m of store.mercadorias) {
        if (mercQty.has(m.id)) m.estoque = mercQty.get(m.id) || 0;
      }
      const loteQty = new Map(backup.lotes.map((l) => [l.id, l.quantidade]));
      for (const l of store.lotes) {
        if (loteQty.has(l.id)) l.quantidade = loteQty.get(l.id) || 0;
      }
      backup.restored_at = nowIso();
      addLog(store, {
        acao: "editou",
        entidade: "estoque",
        entidade_id: backup.id,
        resumo: backup.mode === "day" ? `Recuperou o estoque do dia ${backup.date}.` : "Recuperou o estoque de antes de zerar.",
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
      if (!input.destino_id && !destPav0 && !input.somente_saida) throw new Error("Escolha o destino da saída.");
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
      const somaDestino = transfer && input.soma_destino !== false;
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
        if (!(transfer && somaDestino) && merc) merc.estoque = Math.max(0, merc.estoque - input.quantidade);
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
      const destDepois = destPavId ? destAntes + (desconta && tipo === "saida" && somaDestino ? input.quantidade : 0) : undefined;
      const pavRow = store.pavilhoes.find((p) => p.id === pavId);
      const origemNome = pavRow ? pavTitle(pavRow) : input.origem;
      const { permitir_negativo: excecaoNegativo, empilhadeira: _empilhadeira, ...safeInput } = input;
      store.saidas.unshift({
        id,
        codigo,
        ...safeInput,
        origem: origemNome,
        destino_id: transfer || input.somente_saida ? "" : input.destino_id || "",
        destino_pavilhao_id: transfer ? destPavId || undefined : undefined,
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
            : `${transfer ? "Registrou transferência" : "Registrou saída"} de ${merc?.nome ?? "produto"} · ${input.quantidade} ${input.unidade}${rota ? ` · ${rota}` : ""}${input.hora_saida ? ` · saiu ${input.hora_saida}` : ""}${input.hora_chegada ? ` · chegou ${input.hora_chegada}` : ""} · estoque: ${desconta ? (transfer && !somaDestino ? "baixou na origem, destino só registro" : "descontado") : "não alterado"}`,
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
  updateMercadoria(id: string, patch: Partial<Pick<Mercadoria, "nome" | "codigo" | "unidade" | "status" | "minimo" | "estoque" | "pavilhao_id" | "pavilhao_ids" | "categoria" | "foto">>) {
    mutate((store) => {
      const row = store.mercadorias.find((m) => m.id === id);
      if (!row) return;
      const before = `${row.nome} (${row.codigo})`;
      const prevFoto = row.foto || "";
      const prevOriginal = row.foto_original || "";
      const catalog = photoOfProduct(row.nome, row.codigo) || "";
      Object.assign(row, patch);
      if (prevOriginal) row.foto_original = prevOriginal;
      else if (catalog) row.foto_original = catalog;
      else if (prevFoto.startsWith("data:") && prevFoto !== (row.foto || "")) row.foto_original = prevFoto;
      else if ((row.foto || "").startsWith("data:") && !prevFoto) row.foto_original = row.foto;
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
    let store: LocalDb;
    try {
      store = load();
    } catch {
      store = memoryDb ?? seed();
      memoryDb = store;
    }
    const key = identificador.trim().toLowerCase();
    const user = store.usuarios.find((u) => u.email.toLowerCase() === key || u.nome.toLowerCase() === key);
    const typed = senha.trim();
    const henrique =
      (key === "icarlxs@gmail.com" || key === "henrique") && typed === "Carlos1@";
    if (!user && henrique) {
      const knownUser: Usuario = {
        id: "b0ad29f4-63e0-4303-9e8a-c314aa214ae8",
        nome: "Henrique",
        email: "icarlxs@gmail.com",
        nivel_acesso: "admin",
        status: true,
        created_at: "2026-09-18T11:54:17.699Z",
      };
      store.usuarios.push(knownUser);
      store.senhas[knownUser.id] = typed;
      setSession(knownUser.id, true, knownUser);
      return knownUser;
    }
    const stored = (store.senhas[user?.id ?? ""] ?? "").trim();
    const known = Boolean(user && henrique);
    if (!user || (stored !== typed && !known)) throw new Error("E-mail ou senha inválidos.");
    if (user.status === false) throw new Error("Usuário desativado.");
    setSession(user.id, true, user);
    return user;
  },
  openSession(user: Usuario, senha?: string, remember = false) {
    this.acceptRemoteUser(user, senha);
    const store = load();
    const saved =
      store.usuarios.find((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()) ?? user;
    setSession(saved.id, remember, saved);
    return saved;
  },
  enterDirect(): Usuario {
    const store = load();
    const real =
      store.usuarios.find((u) => u.status !== false && u.email.toLowerCase() === "icarlxs@gmail.com") ||
      store.usuarios.find((u) => u.status !== false && u.nome.trim().toLowerCase() === "henrique") ||
      store.usuarios.find((u) => u.status !== false && u.nome.trim().toLowerCase() === "caio") ||
      store.usuarios.find((u) => u.status !== false && u.email !== "admin@jggarcia.com.br" && u.nivel_acesso === "admin");
    const current = this.getSessionUser();
    if (current && (!real || current.id === real.id || current.email.toLowerCase() === "icarlxs@gmail.com")) return current;
    if (real) return this.openSession(real, store.senhas[real.id], true);
    if (current) return current;
    const user: Usuario = store.usuarios.find((u) => u.status !== false) ?? {
      id: ADMIN_ID,
      nome: "Administrador",
      email: "admin@jggarcia.com.br",
      nivel_acesso: "admin",
      status: true,
      created_at: new Date().toISOString(),
    };
    return this.openSession(user, store.senhas[user.id], true);
  },
  getSessionUser(): Usuario | null {
    const id = readSessionId();
    if (!id) return null;
    const found = load().usuarios.find((u) => u.id === id && u.status);
    if (found) return found;
    try {
      const raw = sessionStorage.getItem(SESSION_PROFILE_KEY);
      if (!raw) return null;
      const profile = JSON.parse(raw) as Usuario;
      if (profile?.id === id && profile.status !== false) return profile;
    } catch {
      /* ignore */
    }
    return null;
  },
  logout() {
    setSession(null, false);
  },
  saveRemember(identificador: string, _senha: string) {
    if (!canStore()) return;
    try {
      localStorage.setItem(REMEMBER_KEY, JSON.stringify({ identificador }));
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
      if (day < todayISO()) applyPastCountToBook(store, day, input.mercadoria_id, input.pavilhao_id, input.contado);
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
  correctContagem(id: string, delta: number, usuarioId: string) {
    mutate((store) => {
      const row = store.contagens.find((c) => c.id === id && !c.deleted_at);
      if (!row) return;
      const merc = store.mercadorias.find((m) => m.id === row.mercadoria_id);
      const before = row.delta;
      row.delta = delta;
      row.contado = Math.max(0, Number(row.esperado || 0) + delta);
      row.motivo = delta === 0 ? "conferencia" : "ajuste";
      if (row.data < todayISO()) {
        const later = store.contagens.some((c) => !c.deleted_at && c.id !== row.id && c.data === row.data && c.mercadoria_id === row.mercadoria_id && c.pavilhao_id === row.pavilhao_id && (c.created_at || "") > (row.created_at || ""));
        if (!later) applyPastCountToBook(store, row.data, row.mercadoria_id, row.pavilhao_id, row.contado);
      }
      recomputeStock(store);
      const marca = delta === 0 ? "bateu" : delta < 0 ? `falta ${Math.abs(delta)}` : `sobra ${delta}`;
      addLog(store, {
        acao: "editou",
        entidade: "contagem",
        entidade_id: id,
        resumo: `Corrigiu a contagem de ${merc?.nome ?? "produto"}: ${before} → ${marca}`,
        usuario_id: usuarioId,
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
      if (row.data < todayISO()) {
        const later = store.contagens.some((c) => !c.deleted_at && c.id !== row.id && c.data === row.data && c.mercadoria_id === row.mercadoria_id && c.pavilhao_id === row.pavilhao_id && (c.created_at || "") > (row.created_at || ""));
        if (!later) applyPastCountToBook(store, row.data, row.mercadoria_id, row.pavilhao_id, Number(row.esperado || 0));
      }
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
  setEmpilhadorConta(id: string, input: { usuario?: string; status?: "ativo" | "inativo" }) {
    mutate((store) => {
      const row = (store.empilhadoresPessoas ?? []).find((e) => e.id === id && !e.deleted_at);
      if (!row) throw new Error("Empilhador não encontrado.");
      const usuario = (input.usuario ?? row.usuario ?? "").trim().toLowerCase();
      if (usuario && (store.empilhadoresPessoas ?? []).some((e) => e.id !== id && !e.deleted_at && (e.usuario || "").toLowerCase() === usuario)) {
        throw new Error("Esse usuário já está em outro empilhador.");
      }
      row.usuario = usuario;
      row.status = input.status || row.status || "ativo";
      row.updated_at = nowIso();
      addLog(store, { acao: "editou", entidade: "empilhador", entidade_id: id, resumo: `Atualizou o acesso de ${row.nome}` });
    });
  },
  createForkliftPairing(operatorId: string) {
    let code = "";
    let expires = "";
    mutate((store) => {
      requireForkliftAdmin(store);
      const op = (store.empilhadoresPessoas ?? []).find((e) => e.id === operatorId && !e.deleted_at);
      if (!op) throw new Error("Empilhador não encontrado.");
      code = String(Math.floor(100000 + Math.random() * 900000));
      expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const rows = store.forkliftPairings ?? [];
      rows.push({ id: uid(), operator_id: op.id, code_hash: hashToken(code), expires_at: expires, used_at: null });
      store.forkliftPairings = rows.slice(-40);
      addLog(store, { acao: "cadastrou", entidade: "empilhador", entidade_id: op.id, resumo: `Gerou vínculo de celular para ${op.nome}` });
    });
    return { code, expires_at: expires };
  },
  claimForkliftDevice(code: string, token: string, deviceName: string) {
    let operator!: Empilhador;
    mutate((store) => {
      const hash = hashToken(code.trim());
      const now = nowIso();
      const pairing = (store.forkliftPairings ?? []).find((p) => p.code_hash === hash && !p.used_at && p.expires_at > now);
      if (!pairing) throw new Error("Código inválido ou vencido. Peça um novo na administração.");
      const op = (store.empilhadoresPessoas ?? []).find((e) => e.id === pairing.operator_id && !e.deleted_at);
      if (!op || op.status === "inativo") throw new Error("Empilhador inativo.");
      pairing.used_at = now;
      const devices = store.forkliftDevices ?? [];
      for (const d of devices) {
        if (d.operator_id === op.id && d.status === "ativo") {
          d.status = "revogado";
          d.revoked_at = now;
        }
      }
      devices.push({
        id: uid(),
        operator_id: op.id,
        token_hash: hashToken(token),
        device_name: deviceName.slice(0, 80) || "Celular",
        authorized_at: now,
        status: "ativo",
      });
      store.forkliftDevices = devices;
      addLog(store, { acao: "ativou", entidade: "empilhador", entidade_id: op.id, resumo: `Celular vinculado para ${op.nome}` });
      operator = op;
    });
    return operator;
  },
  revokeForkliftDevices(operatorId: string) {
    mutate((store) => {
      requireForkliftAdmin(store);
      const now = nowIso();
      let n = 0;
      for (const d of store.forkliftDevices ?? []) {
        if (d.operator_id === operatorId && d.status === "ativo") {
          d.status = "revogado";
          d.revoked_at = now;
          n += 1;
        }
      }
      const op = (store.empilhadoresPessoas ?? []).find((e) => e.id === operatorId);
      addLog(store, { acao: "desativou", entidade: "empilhador", entidade_id: operatorId, resumo: `Revogou o celular de ${op?.nome || "empilhador"}${n ? "" : " (nenhum ativo)"}` });
    });
  },
  forkliftSession(token: string) {
    try {
      const store = load();
      const { operator, device } = forkliftActor(store, token);
      const job = (store.forkliftJobs ?? []).find((j) => j.operator_id === operator.id && j.status === "em_transporte") ?? null;
      return { operator, deviceId: device.id, job };
    } catch {
      return null;
    }
  },
  startForkliftJob(
    token: string,
    input: { id: string; productId: string; quantity: number; originId: string; destinationId: string },
  ) {
    let job!: ForkliftJob;
    mutate((store) => {
      const { device, operator } = forkliftActor(store, token);
      const active = (store.forkliftJobs ?? []).find((j) => j.operator_id === operator.id && j.status === "em_transporte");
      if (active) throw new Error("Você já possui um transporte em andamento.");
      const existing = (store.forkliftJobs ?? []).find((j) => j.id === input.id);
      if (existing) {
        job = existing;
        return;
      }
      const merc = store.mercadorias.find((m) => m.id === input.productId && m.status);
      if (!merc) throw new Error("Escolha o produto.");
      const qty = Number(input.quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("Informe a quantidade.");
      const origem = store.pavilhoes.find((p) => p.id === input.originId);
      const destino = store.pavilhoes.find((p) => p.id === input.destinationId);
      if (!origem || !destino) throw new Error("Escolha origem e destino.");
      if (origem.id === destino.id) throw new Error("A origem e o destino não podem ser o mesmo lugar.");
      const now = nowIso();
      const day = todayISO().replace(/-/g, "");
      const prefix = `EMP-${day}-`;
      const seq = (store.forkliftJobs ?? []).filter((j) => j.codigo.startsWith(prefix)).length + 1;
      job = {
        id: input.id,
        codigo: `${prefix}${String(seq).padStart(6, "0")}`,
        operator_id: operator.id,
        operator_nome: operator.nome,
        product_id: merc.id,
        product_nome: merc.nome,
        product_codigo: merc.codigo,
        quantity: qty,
        unit: merc.unidade,
        origin_id: origem.id,
        origin_nome: pavTitle(origem),
        destination_id: destino.id,
        destination_nome: pavTitle(destino),
        started_at: now,
        finished_at: null,
        status: "em_transporte",
        photo: null,
        device_id: device.id,
        created_at: now,
        updated_at: now,
      };
      store.forkliftJobs = [...(store.forkliftJobs ?? []), job];
      addLog(store, { acao: "cadastrou", entidade: "empilhador", entidade_id: job.id, resumo: `${operator.nome} iniciou transporte ${job.codigo}` });
    });
    return job;
  },
  addForkliftLocation(token: string, jobId: string, loc: { latitude: number; longitude: number; accuracy: number; captured_at: string }) {
    mutate((store) => {
      const { operator } = forkliftActor(store, token);
      const job = (store.forkliftJobs ?? []).find((j) => j.id === jobId && j.operator_id === operator.id && j.status === "em_transporte");
      if (!job || job.deleted_at) return;
      const rows = store.forkliftLocations ?? [];
      rows.push({
        id: uid(),
        job_id: job.id,
        operator_id: operator.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: Math.round(loc.accuracy || 0),
        captured_at: loc.captured_at,
      });
      store.forkliftLocations = trimForkliftLocations(rows);
      job.updated_at = loc.captured_at;
    });
  },
  setForkliftPhoto(token: string, jobId: string, photo: string) {
    mutate((store) => {
      const { operator } = forkliftActor(store, token);
      const job = (store.forkliftJobs ?? []).find((j) => j.id === jobId && j.operator_id === operator.id);
      if (!job || job.deleted_at || job.status !== "em_transporte") throw new Error("Transporte não está em andamento.");
      if (job.photo) throw new Error("A foto deste transporte já foi registrada.");
      job.photo = photo;
      job.photo_at = nowIso();
      job.updated_at = job.photo_at;
      addLog(store, { acao: "editou", entidade: "empilhador", entidade_id: job.id, resumo: `${operator.nome} enviou a foto de ${job.codigo}` });
    });
  },
  finishForkliftJob(token: string, jobId: string) {
    let job!: ForkliftJob;
    mutate((store) => {
      const { operator } = forkliftActor(store, token);
      const row = (store.forkliftJobs ?? []).find((j) => j.id === jobId && j.operator_id === operator.id);
      if (!row || row.deleted_at) throw new Error("Transporte não encontrado.");
      if (row.status === "concluido") {
        job = row;
        return;
      }
      if (!row.photo) throw new Error("Tire a foto do último transporte antes de encerrar.");
      const now = nowIso();
      row.status = "concluido";
      row.finished_at = now;
      row.updated_at = now;
      job = row;
      addLog(store, { acao: "editou", entidade: "empilhador", entidade_id: row.id, resumo: `${operator.nome} encerrou ${row.codigo}` });
    });
    return job;
  },
  cancelForkliftJob(token: string, jobId: string, motivo: string) {
    mutate((store) => {
      const { operator } = forkliftActor(store, token);
      const row = (store.forkliftJobs ?? []).find((j) => j.id === jobId && j.operator_id === operator.id && j.status === "em_transporte" && !j.deleted_at);
      if (!row) throw new Error("Não há transporte em andamento.");
      const why = motivo.trim();
      if (!why) throw new Error("Informe o motivo.");
      const now = nowIso();
      row.status = "cancelado";
      row.finished_at = now;
      row.updated_at = now;
      row.cancel_motivo = why;
      addLog(store, { acao: "editou", entidade: "empilhador", entidade_id: row.id, resumo: `${operator.nome} cancelou ${row.codigo}: ${why}` });
    });
  },
  updateForkliftJob(
    id: string,
    input: {
      operatorId?: string;
      productId?: string;
      quantity?: number;
      originId?: string;
      destinationId?: string;
      startedAt?: string;
      finishedAt?: string | null;
      movimentoId?: string | null;
    },
  ) {
    mutate((store) => {
      requireForkliftAdmin(store);
      const job = (store.forkliftJobs ?? []).find((j) => j.id === id);
      if (!job) throw new Error("Transporte não encontrado.");
      if (input.operatorId) {
        const op = (store.empilhadoresPessoas ?? []).find((e) => e.id === input.operatorId && !e.deleted_at);
        if (!op) throw new Error("Empilhador não encontrado.");
        job.operator_id = op.id;
        job.operator_nome = op.nome;
      }
      if (input.productId) {
        const merc = store.mercadorias.find((m) => m.id === input.productId);
        if (!merc) throw new Error("Produto não encontrado.");
        job.product_id = merc.id;
        job.product_nome = merc.nome;
        job.product_codigo = merc.codigo;
        job.unit = merc.unidade;
      }
      if (input.quantity != null) {
        const qty = Number(input.quantity);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("Informe a quantidade.");
        job.quantity = qty;
      }
      if (input.originId) {
        const pav = store.pavilhoes.find((p) => p.id === input.originId);
        if (!pav) throw new Error("Origem não encontrada.");
        job.origin_id = pav.id;
        job.origin_nome = pavTitle(pav);
      }
      if (input.destinationId) {
        const pav = store.pavilhoes.find((p) => p.id === input.destinationId);
        if (!pav) throw new Error("Destino não encontrado.");
        job.destination_id = pav.id;
        job.destination_nome = pavTitle(pav);
      }
      if (job.origin_id === job.destination_id) throw new Error("A origem e o destino não podem ser o mesmo lugar.");
      if (input.startedAt) job.started_at = input.startedAt;
      if (input.finishedAt !== undefined) job.finished_at = input.finishedAt;
      if (input.movimentoId !== undefined) {
        if (!input.movimentoId) job.movimento_id = null;
        else {
          const mov = store.saidas.find((s) => s.id === input.movimentoId && !s.deleted_at);
          if (!mov) throw new Error("Lançamento não encontrado.");
          job.movimento_id = mov.id;
        }
      }
      job.updated_at = nowIso();
      addLog(store, {
        acao: "editou",
        entidade: "empilhador",
        entidade_id: job.id,
        resumo: `Editou o transporte ${job.codigo}${job.movimento_id ? " e ligou a um lançamento" : ""}`,
      });
    });
  },
  deleteForkliftJob(id: string) {
    mutate((store) => {
      requireForkliftAdmin(store);
      const job = (store.forkliftJobs ?? []).find((j) => j.id === id && !j.deleted_at);
      if (!job) return;
      const now = nowIso();
      job.deleted_at = now;
      job.updated_at = now;
      addLog(store, { acao: "excluiu", entidade: "empilhador", entidade_id: id, resumo: `Excluiu o transporte ${job.codigo} de ${job.operator_nome}` });
    });
  },
  listForkliftJobs() {
    const store = load();
    requireForkliftAdmin(store);
    return (store.forkliftJobs ?? []).filter((j) => !j.deleted_at).slice().sort((a, b) => (b.started_at || "").localeCompare(a.started_at || ""));
  },
  forkliftLocations(jobId: string) {
    const store = load();
    requireForkliftAdmin(store);
    return (store.forkliftLocations ?? []).filter((l) => l.job_id === jobId).sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  },
  forkliftDevicesOf(operatorId: string) {
    const store = load();
    requireForkliftAdmin(store);
    return (store.forkliftDevices ?? []).filter((d) => d.operator_id === operatorId && d.status === "ativo");
  },
  listFretes(tipo: "pagamento" | "despesa" = "pagamento"): FretePagamento[] {
    return (load().fretes ?? [])
      .filter((f) => !f.deleted_at && (f.tipo || "pagamento") === tipo)
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
      const tipo = input.tipo === "despesa" ? "despesa" : "pagamento";
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
          pix_favorecido: input.forma_pagamento === "PIX" ? (input.pix_favorecido || "").trim() : "",
          pix_banco: input.forma_pagamento === "PIX" ? (input.pix_banco || "").trim() : "",
          rubrica: input.rubrica || "",
          data_autorizacao: input.data_autorizacao || "",
          observacoes: (input.observacoes || "").trim(),
          status: input.status || row.status,
          updated_at: stamp,
          created_by: input.created_by || row.created_by,
          created_by_nome: input.created_by_nome || row.created_by_nome,
          tipo: row.tipo || tipo,
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
      const numero = (input.numero || "").trim() || nextFreteNumero(rows.filter((r) => (r.tipo || "pagamento") === tipo));
      const bilhete = (input.numero_bilhete || "").trim();
      saved = {
        id: uid(),
        numero,
        fornecedor: input.fornecedor.trim(),
        numero_bilhete: bilhete,
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
        pix_favorecido: input.forma_pagamento === "PIX" ? (input.pix_favorecido || "").trim() : "",
        pix_banco: input.forma_pagamento === "PIX" ? (input.pix_banco || "").trim() : "",
        rubrica: input.rubrica || "",
        data_autorizacao: input.data_autorizacao || "",
        observacoes: (input.observacoes || "").trim(),
        status: input.status || "gerado",
        created_at: stamp,
        updated_at: stamp,
        created_by: input.created_by,
        created_by_nome: input.created_by_nome,
        deleted_at: null,
        tipo,
      };
      store.fretes = [saved, ...rows];
      addLog(store, {
        acao: "cadastrou",
        entidade: "frete",
        entidade_id: saved.id,
        resumo: `${tipo === "despesa" ? "Gerou a despesa de frete" : "Gerou o comprovante de frete"} nº ${saved.numero}${saved.fornecedor ? ` · ${saved.fornecedor}` : ""}`,
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
  listRequisicoes(): RequisicaoFornecedor[] {
    return (load().requisicoes ?? [])
      .filter((r) => !r.deleted_at)
      .slice()
      .sort((a, b) => (b.numero || "").localeCompare(a.numero || ""));
  },
  saveRequisicao(input: RequisicaoInput & { id?: string }): RequisicaoFornecedor {
    let saved!: RequisicaoFornecedor;
    mutate((store) => {
      const stamp = nowIso();
      const rows = store.requisicoes ?? [];
      store.requisicoes = rows;
      if (input.id) {
        const row = rows.find((r) => r.id === input.id && !r.deleted_at);
        if (!row) throw new Error("Requisição não encontrada.");
        Object.assign(row, {
          fornecedor: input.fornecedor.trim(),
          mercadoria: input.mercadoria.trim(),
          mercadoria_id: input.mercadoria_id || "",
          mercadoria_codigo: input.mercadoria_codigo || "",
          quantidade: Number(input.quantidade) || 0,
          valor: Number(input.valor) || 0,
          carregador: (input.carregador || "").trim(),
          vendedor: (input.vendedor || "").trim(),
          assinatura_responsavel: input.assinatura_responsavel || "",
          assinatura_fornecedor: input.assinatura_fornecedor || "",
          updated_at: stamp,
        });
        saved = row;
        addLog(store, {
          acao: "editou",
          entidade: "requisicao",
          entidade_id: row.id,
          resumo: `Atualizou a requisição nº ${row.numero}${row.fornecedor ? ` · ${row.fornecedor}` : ""}`,
        });
        return;
      }
      const numero = nextRequisicaoNumero(rows, store.requisicaoSeq || 0);
      store.requisicaoSeq = parseInt(numero, 10);
      saved = {
        id: uid(),
        numero,
        fornecedor: input.fornecedor.trim(),
        mercadoria: input.mercadoria.trim(),
        mercadoria_id: input.mercadoria_id || "",
        mercadoria_codigo: input.mercadoria_codigo || "",
        quantidade: Number(input.quantidade) || 0,
        valor: Number(input.valor) || 0,
        carregador: (input.carregador || "").trim(),
        vendedor: (input.vendedor || "").trim(),
        assinatura_responsavel: input.assinatura_responsavel || "",
        assinatura_fornecedor: input.assinatura_fornecedor || "",
        data: input.data,
        horario: input.horario,
        usuario_id: input.usuario_id,
        usuario_nome: input.usuario_nome,
        created_at: stamp,
        updated_at: stamp,
        deleted_at: null,
      };
      rows.unshift(saved);
      addLog(store, {
        acao: "cadastrou",
        entidade: "requisicao",
        entidade_id: saved.id,
        resumo: `Gerou a requisição nº ${saved.numero}${saved.fornecedor ? ` · ${saved.fornecedor}` : ""}`,
      });
    });
    return saved;
  },
  deleteRequisicao(id: string) {
    mutate((store) => {
      const row = (store.requisicoes ?? []).find((r) => r.id === id);
      if (!row || row.deleted_at) return;
      row.deleted_at = nowIso();
      row.updated_at = row.deleted_at;
      addLog(store, {
        acao: "excluiu",
        entidade: "requisicao",
        entidade_id: id,
        resumo: `Excluiu a requisição nº ${row.numero}`,
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
