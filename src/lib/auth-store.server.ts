import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { NivelAcesso, Usuario } from "./types";
import { getSql } from "@/lib/db";
import { parseAuthCookie, writeAuthCookie } from "@/lib/client-ip.server";
import { deviceLabelFromUa, isPhysicalPhone, parseUserAgent } from "./device-meta";

type Ticket = {
  secret: string;
  expiresAt: number;
  status: "pending" | "approved" | "consumed";
  userId?: string;
  fails: number;
};

type Device = {
  userId: string;
  secret: string;
  label: string;
  createdAt: string;
  lastIp: string;
  ips: string[];
  lastSeen: string;
  userAgent: string;
  print: string;
};

type Pairing = {
  userId: string;
  expiresAt: number;
};

type Station = {
  userId: string;
  secret: string;
  ip: string;
  lastSeen: string;
};

type PhoneLock = {
  deviceId: string;
  ip: string;
  lastSeen: number;
};

type AuthState = {
  usuarios: Usuario[];
  senhas: Record<string, string>;
  tickets: Record<string, Ticket>;
  devices: Record<string, Device>;
  pairings: Record<string, Pairing>;
  stations: Record<string, Station>;
  apagados: string[];
  phoneLocks: Record<string, PhoneLock>;
};

const FILE = path.join(process.cwd(), "data", "jg-auth.json");

const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
const OP_ID = "00000000-0000-0000-0000-000000000002";

function nowIso() {
  return new Date().toISOString();
}

function seed(): AuthState {
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
    senhas: { [ADMIN_ID]: "Jg@2026", [OP_ID]: "Op@2026" },
    tickets: {},
    devices: {},
    pairings: {},
    stations: {},
    apagados: [],
    phoneLocks: {},
  };
}

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

let cache: AuthState | null = null;
let chain = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function asBool(v: unknown) {
  return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}

async function hydrateFromSql(): Promise<AuthState> {
  const sql = await getSql();
  const users = await sql<{
    id: string;
    nome: string;
    email: string;
    senha: string;
    nivel_acesso: string;
    status: unknown;
    created_at: string;
  }>`select id, nome, email, senha, nivel_acesso, status, created_at from jg_auth_users`;
  const devices = await sql<{
    id: string;
    user_id: string;
    secret: string;
    label: string;
    created_at: string;
    last_ip: string;
    ips: unknown;
    last_seen: string;
    user_agent: string;
    print: string;
  }>`select id, user_id, secret, label, created_at, last_ip, ips, last_seen, user_agent, print from jg_auth_devices`;
  const stations = await sql<{
    id: string;
    user_id: string;
    secret: string;
    ip: string;
    last_seen: string;
  }>`select id, user_id, secret, ip, last_seen from jg_auth_stations`;
  const tickets = await sql<{
    id: string;
    secret: string;
    expires_at: number | string;
    status: string;
    user_id: string | null;
    fails: number;
  }>`select id, secret, expires_at, status, user_id, fails from jg_auth_tickets`;
  const pairings = await sql<{
    token: string;
    user_id: string;
    expires_at: number | string;
  }>`select token, user_id, expires_at from jg_auth_pairings`;

  const state: AuthState = {
    usuarios: users.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      nivel_acesso: (u.nivel_acesso === "admin" ? "admin" : "operador") as NivelAcesso,
      status: asBool(u.status),
      created_at: u.created_at,
    })),
    senhas: Object.fromEntries(users.map((u) => [u.id, u.senha ?? ""])),
    tickets: {},
    devices: {},
    pairings: {},
    stations: {},
    apagados: [],
    phoneLocks: {},
  };
  try {
    await sql.query(`create table if not exists jg_auth_deleted (key text primary key, deleted_at timestamptz not null default now())`);
    const gone = await sql<{ key: string }>`select key from jg_auth_deleted`;
    state.apagados = gone.map((g) => g.key);
  } catch {
    state.apagados = [];
  }
  try {
    await sql.query(
      `create table if not exists jg_auth_phone_locks (user_id text primary key, device_id text not null, ip text, last_seen bigint not null)`,
    );
    const locks = await sql<{ user_id: string; device_id: string; ip: string; last_seen: string | number }>`select user_id, device_id, ip, last_seen from jg_auth_phone_locks`;
    for (const row of locks) {
      state.phoneLocks[row.user_id] = {
        deviceId: row.device_id,
        ip: row.ip || "",
        lastSeen: Number(row.last_seen) || 0,
      };
    }
  } catch {
    state.phoneLocks = state.phoneLocks ?? {};
  }
  for (const d of devices) {
    const ips = Array.isArray(d.ips) ? (d.ips as string[]) : typeof d.ips === "string" ? (JSON.parse(d.ips || "[]") as string[]) : [];
    state.devices[d.id] = {
      userId: d.user_id,
      secret: d.secret,
      label: d.label,
      createdAt: d.created_at,
      lastIp: d.last_ip || "",
      ips,
      lastSeen: d.last_seen || "",
      userAgent: d.user_agent || "",
      print: d.print || "",
    };
  }
  for (const s of stations) {
    state.stations[s.id] = { userId: s.user_id, secret: s.secret, ip: s.ip || "", lastSeen: s.last_seen || "" };
  }
  for (const t of tickets) {
    state.tickets[t.id] = {
      secret: t.secret,
      expiresAt: Number(t.expires_at),
      status: (t.status as Ticket["status"]) || "pending",
      userId: t.user_id || undefined,
      fails: Number(t.fails) || 0,
    };
  }
  for (const p of pairings) {
    state.pairings[p.token] = { userId: p.user_id, expiresAt: Number(p.expires_at) };
  }
  state.usuarios = state.usuarios.filter((u) => !isBuried(state, u.id, u.email));
  return state;
}

async function importFileIfAny(state: AuthState) {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as AuthState;
    if (!Array.isArray(parsed.usuarios)) return state;
    if (Array.isArray(parsed.apagados)) {
      state.apagados = [...new Set([...(state.apagados ?? []), ...parsed.apagados])];
    }
    if (parsed.phoneLocks && typeof parsed.phoneLocks === "object") {
      state.phoneLocks = { ...parsed.phoneLocks, ...state.phoneLocks };
    }
    for (const u of parsed.usuarios) {
      if (isBuried(state, u.id, u.email)) continue;
      if (!state.usuarios.some((x) => x.id === u.id || x.email.toLowerCase() === u.email.toLowerCase())) {
        state.usuarios.push(u);
        if (parsed.senhas?.[u.id]) state.senhas[u.id] = parsed.senhas[u.id];
      } else if (parsed.senhas?.[u.id] && !state.senhas[u.id]) {
        const row = state.usuarios.find((x) => x.id === u.id || x.email.toLowerCase() === u.email.toLowerCase());
        if (row) state.senhas[row.id] = parsed.senhas[u.id];
      }
    }
    for (const [id, d] of Object.entries(parsed.devices ?? {})) {
      if (!state.devices[id]) state.devices[id] = d;
    }
    for (const [id, s] of Object.entries(parsed.stations ?? {})) {
      if (!state.stations[id]) state.stations[id] = s;
    }
  } catch {
    /* no file — normal on deploy */
  }
  return state;
}

function isBuried(state: AuthState, id?: string, email?: string) {
  const keys = state.apagados ?? [];
  if (id && keys.includes(id)) return true;
  if (email && keys.includes(email.trim().toLowerCase())) return true;
  return false;
}

function bury(state: AuthState, id: string, email?: string) {
  state.apagados = state.apagados ?? [];
  for (const k of [id, (email || "").trim().toLowerCase()]) {
    if (k && !state.apagados.includes(k)) state.apagados.push(k);
  }
}

function unbury(state: AuthState, id: string, email?: string) {
  const drop = new Set([id, (email || "").trim().toLowerCase()].filter(Boolean));
  state.apagados = (state.apagados ?? []).filter((k) => !drop.has(k));
}

function aliasesOf(identificador: string) {
  const idf = norm(identificador);
  const set = new Set<string>([idf]);
  if (idf === "admin" || idf === "administrador") {
    set.add("admin@jggarcia.com.br");
    set.add("administrador");
  }
  if (idf === "operador") {
    set.add("operador@jggarcia.com.br");
    set.add("operador");
  }
  return set;
}

function findUser(state: AuthState, identificador: string) {
  const keys = aliasesOf(identificador);
  return state.usuarios.find((u) => keys.has(norm(u.email)) || keys.has(norm(u.nome))) ?? null;
}

function ensureDefaults(state: AuthState) {
  if (state.usuarios.length > 0) return false;
  const seeded = seed();
  state.usuarios = seeded.usuarios;
  state.senhas = { ...seeded.senhas };
  return true;
}

async function readState(): Promise<AuthState> {
  try {
    let state = await hydrateFromSql();
    const before = state.usuarios.length;
    state = await importFileIfAny(state);
    const addedDefaults = ensureDefaults(state);
    if (addedDefaults || state.usuarios.length !== before) {
      await persist(state);
      return state;
    }
    cache = state;
    return state;
  } catch {
    if (cache && cache.usuarios.length) {
      cache = await importFileIfAny(cache);
      return cache;
    }
    const seeded = seed();
    cache = await importFileIfAny(seeded);
    ensureDefaults(cache);
    return cache;
  }
}

async function flushUser(user: Usuario, senha: string) {
  const sql = await getSql();
  await sql.query(`delete from jg_auth_deleted where key = $1 or lower(key) = lower($2)`, [user.id, user.email]);
  await sql.query(`delete from jg_auth_users where lower(email) = lower($1) and id <> $2`, [user.email, user.id]);
  await sql.query(
    `insert into jg_auth_users (id, nome, email, senha, nivel_acesso, status, created_at)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (id) do update set
       nome = excluded.nome,
       email = excluded.email,
       senha = case when excluded.senha = '' then jg_auth_users.senha else excluded.senha end,
       nivel_acesso = excluded.nivel_acesso,
       status = excluded.status`,
    [user.id, user.nome, user.email, senha, user.nivel_acesso, user.status, user.created_at],
  );
}

async function persist(state: AuthState) {
  if (!state.usuarios.length) return;
  cache = state;
  try {
    const sql = await getSql();
    try {
      await sql.query(
        `create table if not exists jg_auth_deleted (key text primary key, deleted_at timestamptz not null default now())`,
      );
      for (const k of state.apagados ?? []) {
        await sql.query(`insert into jg_auth_deleted (key) values ($1) on conflict (key) do nothing`, [k]);
        await sql.query(`delete from jg_auth_users where id = $1 or lower(email) = lower($1)`, [k]);
      }
    } catch {
      /* tabela de exclusão extra */
    }
    for (const u of state.usuarios) {
      const senha = state.senhas[u.id] ?? "";
      await sql.query(`delete from jg_auth_users where lower(email) = lower($1) and id <> $2`, [u.email, u.id]);
      await sql.query(
        `insert into jg_auth_users (id, nome, email, senha, nivel_acesso, status, created_at)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do update set
           nome = excluded.nome,
           email = excluded.email,
           senha = case when excluded.senha = '' then jg_auth_users.senha else excluded.senha end,
           nivel_acesso = excluded.nivel_acesso,
           status = excluded.status`,
        [u.id, u.nome, u.email, senha, u.nivel_acesso, u.status, u.created_at],
      );
    }
    try {
      await sql.query(
        `create table if not exists jg_auth_phone_locks (user_id text primary key, device_id text not null, ip text, last_seen bigint not null)`,
      );
      await sql.query(`delete from jg_auth_phone_locks`);
      for (const [userId, lock] of Object.entries(state.phoneLocks ?? {})) {
        await sql.query(
          `insert into jg_auth_phone_locks (user_id, device_id, ip, last_seen) values ($1,$2,$3,$4)`,
          [userId, lock.deviceId, lock.ip, lock.lastSeen],
        );
      }
    } catch {
      /* lock extra */
    }
    for (const [id, d] of Object.entries(state.devices)) {
      await sql.query(
        `insert into jg_auth_devices (id, user_id, secret, label, created_at, last_ip, ips, last_seen, user_agent, print)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
         on conflict (id) do update set
           user_id = excluded.user_id,
           secret = excluded.secret,
           label = excluded.label,
           last_ip = excluded.last_ip,
           ips = excluded.ips,
           last_seen = excluded.last_seen,
           user_agent = excluded.user_agent,
           print = excluded.print`,
        [id, d.userId, d.secret, d.label, d.createdAt, d.lastIp, JSON.stringify(d.ips ?? []), d.lastSeen, d.userAgent, d.print],
      );
    }
    for (const [id, s] of Object.entries(state.stations)) {
      await sql.query(
        `insert into jg_auth_stations (id, user_id, secret, ip, last_seen)
         values ($1,$2,$3,$4,$5)
         on conflict (id) do update set user_id = excluded.user_id, secret = excluded.secret, ip = excluded.ip, last_seen = excluded.last_seen`,
        [id, s.userId, s.secret, s.ip, s.lastSeen],
      );
    }
    await sql.query(`delete from jg_auth_tickets`);
    for (const [id, t] of Object.entries(state.tickets)) {
      await sql.query(
        `insert into jg_auth_tickets (id, secret, expires_at, status, user_id, fails) values ($1,$2,$3,$4,$5,$6)`,
        [id, t.secret, t.expiresAt, t.status, t.userId ?? null, t.fails ?? 0],
      );
    }
    await sql.query(`delete from jg_auth_pairings`);
    for (const [token, p] of Object.entries(state.pairings)) {
      await sql.query(`insert into jg_auth_pairings (token, user_id, expires_at) values ($1,$2,$3)`, [
        token,
        p.userId,
        p.expiresAt,
      ]);
    }
  } catch {
    /* cai no arquivo */
  }
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(state), "utf8");
    await rename(tmp, FILE);
  } catch {
    /* memória cobre o processo se o disco falhar */
  }
}

function publicUser(u: Usuario): Usuario {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    nivel_acesso: u.nivel_acesso,
    status: u.status,
    created_at: u.created_at,
  };
}

function authToken(userId: string, senha: string) {
  return createHash("sha256").update(`${userId}|${senha}|jg-auth-v1`).digest("hex");
}

function stampAuth(user: Usuario, senha: string) {
  writeAuthCookie(user.id, authToken(user.id, senha ?? ""));
}

function userFromRequest(state: AuthState): Usuario | null {
  const cookie = parseAuthCookie();
  if (!cookie) return null;
  const user = state.usuarios.find((u) => u.id === cookie.userId && u.status);
  if (!user) return null;
  if (cookie.token !== authToken(user.id, state.senhas[user.id] ?? "")) return null;
  return user;
}

function adminFromRequest(state: AuthState): Usuario | null {
  const user = userFromRequest(state);
  if (!user || user.nivel_acesso !== "admin") return null;
  return user;
}

function pruneTickets(state: AuthState) {
  const now = Date.now();
  for (const [id, t] of Object.entries(state.tickets)) {
    if (t.expiresAt < now || t.status === "consumed") delete state.tickets[id];
  }
  for (const [id, p] of Object.entries(state.pairings ?? {})) {
    if (p.expiresAt < now) delete state.pairings[id];
  }
}

function rememberIp(device: Device, ip: string, ua: string, print = "") {
  device.ips = Array.isArray(device.ips) ? device.ips : [];
  device.lastIp = ip || device.lastIp || "";
  device.lastSeen = nowIso();
  if (ua) device.userAgent = ua.slice(0, 180);
  if (print) device.print = print;
  if (ip && !device.ips.includes(ip)) {
    device.ips = [ip, ...device.ips].slice(0, 12);
  }
}

function findDevice(state: AuthState, deviceId?: string, deviceSecret?: string) {
  if (!deviceId || !deviceSecret) return null;
  const row = state.devices[deviceId];
  if (!row || row.secret !== deviceSecret) return null;
  return { id: deviceId, row };
}

const PHONE_BUSY =
  "Esta conta já está em outro telefone. Entre com o usuário que o administrador criou para você.";
const SEAT_MS = 15 * 60 * 1000;

function newest(a: { row: Device }, b: { row: Device }) {
  return (b.row.lastSeen || "").localeCompare(a.row.lastSeen || "");
}

function deviceHasIp(d: Device, ip: string) {
  if (!ip || ip === "desconhecido") return false;
  return d.lastIp === ip || (d.ips ?? []).includes(ip);
}

function findOwnedDevice(
  state: AuthState,
  userId: string,
  creds?: { deviceId?: string; secret?: string } | null,
) {
  const byCreds = findDevice(state, creds?.deviceId, creds?.secret);
  if (byCreds && byCreds.row.userId === userId) return byCreds;
  return null;
}

function userIdByDeviceToken(state: AuthState, creds?: { deviceId?: string; secret?: string } | null) {
  const found = findDevice(state, creds?.deviceId, creds?.secret);
  return found?.row.userId ?? null;
}

function seatStale(lock?: PhoneLock) {
  if (!lock) return true;
  if (!lock.deviceId) return true;
  return Date.now() - (lock.lastSeen || 0) > SEAT_MS;
}

function takePhoneSeat(
  state: AuthState,
  userId: string,
  deviceId: string,
  ip: string,
  print = "",
): { ok: true } | { ok: false; occupied: true; error: string } {
  state.phoneLocks = state.phoneLocks ?? {};
  const lock = state.phoneLocks[userId];
  const locked = lock ? state.devices[lock.deviceId] : undefined;
  if (!lock || seatStale(lock) || !locked) {
    state.phoneLocks[userId] = { deviceId, ip: ip || lock?.ip || "", lastSeen: Date.now() };
    return { ok: true };
  }
  if (lock.deviceId === deviceId) {
    lock.ip = ip || lock.ip;
    lock.lastSeen = Date.now();
    return { ok: true };
  }
  if (print && locked.print && locked.print === print) {
    state.phoneLocks[userId] = { deviceId, ip: ip || lock.ip, lastSeen: Date.now() };
    return { ok: true };
  }
  return { ok: false, occupied: true, error: PHONE_BUSY };
}

function bindPhone(
  state: AuthState,
  user: Usuario,
  ip: string,
  ua: string,
  print: string,
  creds?: { deviceId?: string; secret?: string } | null,
  label = "",
) {
  const phone = isPhysicalPhone(ua);
  const existing = findOwnedDevice(state, user.id, creds);
  const resolvedLabel = (label || deviceLabelFromUa(ua)).slice(0, 80);
  if (existing) {
    if (phone) {
      const seat = takePhoneSeat(state, user.id, existing.id, ip, print);
      if (!seat.ok) return seat;
    }
    rememberIp(existing.row, ip, ua, print);
    if (resolvedLabel) existing.row.label = resolvedLabel;
    return { ok: true as const, deviceId: existing.id, secret: existing.row.secret, fresh: false as const };
  }
  if (phone) {
    const lock = state.phoneLocks[user.id];
    const locked = lock && !seatStale(lock) ? state.devices[lock.deviceId] : undefined;
    if (locked && locked.userId === user.id) {
      return { ok: false as const, occupied: true as const, error: PHONE_BUSY };
    }
  }
  const made = newDevice(user.id, resolvedLabel, ip, ua, print);
  if (phone) {
    const seat = takePhoneSeat(state, user.id, made.id, ip, print);
    if (!seat.ok) return seat;
  }
  state.devices[made.id] = made.row;
  return { ok: true as const, deviceId: made.id, secret: made.secret, fresh: true as const };
}

function newDevice(userId: string, label: string, ip: string, ua: string, print = ""): { id: string; secret: string; row: Device } {
  const id = crypto.randomUUID();
  const secret = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const row: Device = {
    userId,
    secret,
    label: (label || "Celular").slice(0, 80),
    createdAt: nowIso(),
    lastIp: ip,
    ips: ip ? [ip] : [],
    lastSeen: nowIso(),
    userAgent: (ua || "").slice(0, 180),
    print,
  };
  return { id, secret, row };
}

export async function listTeam() {
  return withLock(async () => {
    const state = await readState();
    if (!adminFromRequest(state)) return { users: [] as Usuario[], apagados: [] as string[] };
    return {
      users: state.usuarios.filter((u) => u.status).map(publicUser),
      apagados: state.apagados ?? [],
    };
  });
}

export async function upsertUser(input: {
  id?: string;
  nome: string;
  email: string;
  senha?: string;
  nivel_acesso: string;
  status?: boolean;
}) {
  return withLock(async () => {
    const state = await readState();
    if (!adminFromRequest(state)) throw new Error("Somente o administrador pode cadastrar a equipe.");
    const email = input.email.trim().toLowerCase();
    let row = input.id ? state.usuarios.find((u) => u.id === input.id) : undefined;
    if (!row) row = state.usuarios.find((u) => u.email.toLowerCase() === email);
    if (row) {
      if (state.usuarios.some((u) => u.id !== row!.id && u.email.toLowerCase() === email)) {
        throw new Error("Já existe um usuário com este e-mail.");
      }
      unbury(state, row.id, email);
      row.nome = input.nome.trim();
      row.email = email;
      row.nivel_acesso = (input.nivel_acesso === "admin" ? "admin" : "operador") as NivelAcesso;
      if (typeof input.status === "boolean") row.status = input.status;
    if (input.senha?.trim()) state.senhas[row.id] = input.senha.trim();
      await persist(state);
      await flushUser(row, state.senhas[row.id] ?? "");
      return publicUser(row);
    }
    unbury(state, input.id || "", email);
    if (state.usuarios.some((u) => u.email.toLowerCase() === email)) {
      throw new Error("Já existe um usuário com este e-mail.");
    }
    const created: Usuario = {
      id: input.id || crypto.randomUUID(),
      nome: input.nome.trim(),
      email,
      nivel_acesso: (input.nivel_acesso === "admin" ? "admin" : "operador") as NivelAcesso,
      status: input.status ?? true,
      created_at: nowIso(),
    };
    state.usuarios.push(created);
    if (input.senha?.trim()) state.senhas[created.id] = input.senha.trim();
    await persist(state);
    await flushUser(created, state.senhas[created.id] ?? "");
    return publicUser(created);
  });
}

export async function deleteUser(id: string) {
  return withLock(async () => {
    const state = await readState();
    if (!adminFromRequest(state)) return { ok: false as const, error: "Somente o administrador pode excluir." };
    const row = state.usuarios.find((u) => u.id === id);
    if (!row) return { ok: true as const };
    const outrosAdmins = state.usuarios.filter((u) => u.id !== id && u.nivel_acesso === "admin" && u.status);
    if (row.nivel_acesso === "admin" && outrosAdmins.length === 0) {
      return { ok: false as const, error: "Não dá para excluir o último administrador." };
    }
    bury(state, row.id, row.email);
    state.usuarios = state.usuarios.filter((u) => u.id !== id);
    delete state.senhas[id];
    for (const [did, d] of Object.entries(state.devices)) {
      if (d.userId === id) delete state.devices[did];
    }
    for (const [sid, s] of Object.entries(state.stations)) {
      if (s.userId === id) delete state.stations[sid];
    }
    for (const [token, p] of Object.entries(state.pairings)) {
      if (p.userId === id) delete state.pairings[token];
    }
    for (const [tid, t] of Object.entries(state.tickets)) {
      if (t.userId === id) delete state.tickets[tid];
    }
    try {
      const sql = await getSql();
      await sql.query(`delete from jg_auth_devices where user_id = $1`, [id]);
      await sql.query(`delete from jg_auth_stations where user_id = $1`, [id]);
      await sql.query(`delete from jg_auth_pairings where user_id = $1`, [id]);
      await sql.query(`delete from jg_auth_tickets where user_id = $1`, [id]);
      await sql.query(`delete from jg_auth_users where id = $1`, [id]);
    } catch {
      /* persist abaixo ainda grava o estado sem o perfil */
    }
    await persist(state);
    return { ok: true as const };
  });
}

export async function importUsers(users: { user: Usuario; senha?: string }[]) {
  return withLock(async () => {
    const state = await readState();
    if (!adminFromRequest(state)) return [] as Usuario[];
    for (const item of users) {
      const email = item.user.email.trim().toLowerCase();
      if (isBuried(state, item.user.id, email)) continue;
      let row = state.usuarios.find((u) => u.id === item.user.id || u.email.toLowerCase() === email);
      if (!row) {
        row = {
          ...item.user,
          email,
        };
        state.usuarios.push(row);
      } else {
        row.nome = item.user.nome;
        row.email = email;
        row.nivel_acesso = item.user.nivel_acesso;
        row.status = item.user.status;
      }
      if (item.senha) state.senhas[row.id] = item.senha;
    }
    await persist(state);
    return state.usuarios.filter((u) => u.status).map(publicUser);
  });
}

export async function authenticate(
  identificador: string,
  senha: string,
  ip = "",
  ua = "",
  print = "",
  creds?: { deviceId?: string; secret?: string } | null,
  rememberDevice = false,
) {
  return withLock(async () => {
    const state = await readState();
    const pass = senha.trim();
    const user = findUser(state, identificador.trim());
    if (!user) return { ok: false as const, error: "E-mail ou senha inválidos." };
    if ((state.senhas[user.id] ?? "").trim() !== pass) {
      return { ok: false as const, error: "E-mail ou senha inválidos." };
    }
    if (!user.status) return { ok: false as const, error: "Usuário desativado." };
    const existing = findOwnedDevice(state, user.id, creds);
    if (existing || rememberDevice) {
      const bound = bindPhone(state, user, ip, ua, print, creds, deviceLabelFromUa(ua));
      if (bound.ok) {
        await persist(state);
        stampAuth(user, state.senhas[user.id] ?? "");
        return {
          ok: true as const,
          user: publicUser(user),
          senha: state.senhas[user.id],
          deviceId: bound.deviceId,
          secret: bound.secret,
          freshDevice: bound.fresh,
          ip,
          meta: parseUserAgent(ua),
        };
      }
    }
    stampAuth(user, state.senhas[user.id] ?? "");
    return { ok: true as const, user: publicUser(user), senha: state.senhas[user.id], ip, meta: parseUserAgent(ua) };
  });
}

export async function createTicket() {
  return withLock(async () => {
    const state = await readState();
    pruneTickets(state);
    const id = crypto.randomUUID();
    const secret = crypto.randomUUID().replaceAll("-", "");
    const expiresAt = Date.now() + 30 * 60 * 1000;
    state.tickets[id] = { secret, expiresAt, status: "pending", fails: 0 };
    await persist(state);
    return { id, secret, expiresAt };
  });
}

export async function approveTicket(id: string, secret: string, identificador: string, senha: string) {
  return withLock(async () => {
    const state = await readState();
    pruneTickets(state);
    const t = state.tickets[id];
    if (!t) return { ok: false as const, error: "QR expirado. Gere outro no computador." };
    if (t.secret !== secret) return { ok: false as const, error: "QR inválido." };
    if (t.expiresAt < Date.now()) return { ok: false as const, error: "QR expirado. Gere outro no computador." };
    if (t.status !== "pending") return { ok: false as const, error: "Este QR já foi usado." };
    if ((t.fails ?? 0) >= 5) {
      delete state.tickets[id];
      await persist(state);
      return { ok: false as const, error: "Muitas tentativas. Gere outro QR no computador." };
    }
    const idf = norm(identificador);
    const pass = senha.trim();
    const user = findUser(state, identificador);
    if (!user || (state.senhas[user.id] ?? "") !== pass) {
      t.fails = (t.fails ?? 0) + 1;
      await persist(state);
      return { ok: false as const, error: "E-mail ou senha inválidos." };
    }
    if (!user.status) return { ok: false as const, error: "Usuário desativado." };
    t.status = "approved";
    t.userId = user.id;
    await persist(state);
    return { ok: true as const, user: publicUser(user) };
  });
}

export async function linkDevice(identificador: string, senha: string, label: string, ip = "", ua = "", print = "") {
  return withLock(async () => {
    const state = await readState();
    const pass = senha.trim();
    const user = findUser(state, identificador);
    if (!user || (state.senhas[user.id] ?? "") !== pass) {
      return { ok: false as const, error: "E-mail ou senha inválidos." };
    }
    if (!user.status) return { ok: false as const, error: "Usuário desativado." };
    const bound = bindPhone(state, user, ip, ua, print, null, label);
    if (bound.ok) {
      await persist(state);
      stampAuth(user, state.senhas[user.id] ?? "");
      return { ok: true as const, deviceId: bound.deviceId, secret: bound.secret, user: publicUser(user), ip };
    }
    stampAuth(user, state.senhas[user.id] ?? "");
    return { ok: true as const, deviceId: "", secret: "", user: publicUser(user), ip };
  });
}

export async function createPairing(userId: string) {
  return withLock(async () => {
    const state = await readState();
    if (!adminFromRequest(state)) return { ok: false as const, error: "Somente o administrador pode gerar crachá." };
    const user = state.usuarios.find((u) => u.id === userId);
    if (!user || !user.status) return { ok: false as const, error: "Usuário não encontrado." };
    const token = `${crypto.randomUUID().replaceAll("-", "")}`;
    state.pairings[token] = { userId: user.id, expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000 };
    await persist(state);
    return { ok: true as const, token, nome: user.nome, expiresAt: state.pairings[token].expiresAt };
  });
}

export async function claimPairing(
  token: string,
  label: string,
  ip = "",
  ua = "",
  existing?: { deviceId: string; secret: string } | null,
  print = "",
) {
  return withLock(async () => {
    const state = await readState();
    pruneTickets(state);
    const pairing = state.pairings[token];
    if (!pairing || pairing.expiresAt < Date.now()) {
      return { ok: false as const, error: "QR de crachá expirado. Peça outro ao administrador." };
    }
    const user = state.usuarios.find((u) => u.id === pairing.userId);
    if (!user || !user.status) return { ok: false as const, error: "Usuário desativado." };
    const bound = bindPhone(state, user, ip, ua, print, existing, label);
    if (!bound.ok) return bound;
    await persist(state);
    return { ok: true as const, deviceId: bound.deviceId, secret: bound.secret, user: publicUser(user), ip };
  });
}

export async function approveByDevice(
  id: string,
  secret: string,
  deviceId: string,
  deviceSecret: string,
  ip = "",
  ua = "",
) {
  return unlockTicket(id, secret, { deviceId, secret: deviceSecret }, ip, ua);
}

export async function unlockTicket(
  id: string,
  secret: string,
  creds: { deviceId?: string; secret?: string } | null,
  ip = "",
  ua = "",
  print = "",
) {
  return withLock(async () => {
    const state = await readState();
    pruneTickets(state);
    const t = state.tickets[id];
    if (!t) return { ok: false as const, error: "QR expirado. Gere outro no computador." };
    if (t.secret !== secret) return { ok: false as const, error: "QR inválido." };
    if (t.expiresAt < Date.now()) return { ok: false as const, error: "QR expirado. Gere outro no computador." };

    const found = findDevice(state, creds?.deviceId, creds?.secret);
    const user = found ? state.usuarios.find((u) => u.id === found.row.userId) : undefined;
    if (!user || !user.status) {
      return { ok: false as const, error: "Este dispositivo ainda não foi reconhecido. Entre com e-mail e senha." };
    }
    const bound = bindPhone(state, user, ip, ua, print, creds, deviceLabelFromUa(ua));
    if (!bound.ok) return bound;
    if (t.status === "consumed") {
      return { ok: false as const, error: "Este QR já foi usado. Peça um novo no computador." };
    }
    t.status = "approved";
    t.userId = user.id;
    await persist(state);
    stampAuth(user, state.senhas[user.id] ?? "");
    return {
      ok: true as const,
      user: publicUser(user),
      ip,
      deviceId: bound.deviceId,
      secret: bound.secret,
    };
  });
}

export async function loginByDevice(
  creds: { deviceId?: string; secret?: string } | null,
  ip = "",
  ua = "",
  print = "",
) {
  return withLock(async () => {
    const state = await readState();
    const found = findDevice(state, creds?.deviceId, creds?.secret);
    const user = found ? state.usuarios.find((u) => u.id === found.row.userId) : undefined;
    if (!user || !user.status) {
      return { ok: false as const, error: "Este dispositivo ainda não foi reconhecido. Entre com e-mail e senha." };
    }
    const bound = bindPhone(state, user, ip, ua, print, creds, deviceLabelFromUa(ua));
    if (!bound.ok) return bound;
    await persist(state);
    stampAuth(user, state.senhas[user.id] ?? "");
    return {
      ok: true as const,
      user: publicUser(user),
      senha: state.senhas[user.id] ?? "",
      deviceId: bound.deviceId,
      secret: bound.secret,
      ip,
    };
  });
}

export async function rememberStation(userId: string, ip = "") {
  return withLock(async () => {
    const state = await readState();
    const user = state.usuarios.find((u) => u.id === userId);
    if (!user || !user.status) return { ok: false as const, error: "Usuário desativado." };
    const existing = Object.entries(state.stations).find(([, s]) => s.userId === userId && s.ip === ip);
    if (existing) {
      existing[1].lastSeen = nowIso();
      existing[1].ip = ip || existing[1].ip;
      await persist(state);
      return { ok: true as const, id: existing[0], secret: existing[1].secret, user: publicUser(user) };
    }
    const id = crypto.randomUUID();
    const secret = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
    state.stations[id] = { userId, secret, ip, lastSeen: nowIso() };
    await persist(state);
    return { ok: true as const, id, secret, user: publicUser(user) };
  });
}

export async function resumeStation(id: string, secret: string, ip = "") {
  return withLock(async () => {
    const state = await readState();
    const row = state.stations[id];
    if (!row || row.secret !== secret) return { ok: false as const, error: "Este computador não está vinculado." };
    const user = state.usuarios.find((u) => u.id === row.userId);
    if (!user || !user.status) return { ok: false as const, error: "Usuário desativado." };
    row.lastSeen = nowIso();
    if (ip) row.ip = ip;
    await persist(state);
    return { ok: true as const, user: publicUser(user), senha: state.senhas[user.id] ?? "" };
  });
}

export async function peekStation(id: string, secret: string) {
  return withLock(async () => {
    const state = await readState();
    const row = state.stations[id];
    if (!row || row.secret !== secret) return { ok: false as const };
    const user = state.usuarios.find((u) => u.id === row.userId);
    if (!user || !user.status) return { ok: false as const };
    return { ok: true as const, user: publicUser(user) };
  });
}

export async function listDevices() {
  return withLock(async () => {
    const state = await readState();
    if (!adminFromRequest(state)) return [];
    return Object.entries(state.devices).map(([id, d]) => {
      const user = state.usuarios.find((u) => u.id === d.userId);
      return {
        id,
        label: d.label,
        createdAt: d.createdAt,
        userId: d.userId,
        nome: user?.nome ?? "—",
        email: user?.email ?? "",
        lastIp: d.lastIp ?? "",
        lastSeen: d.lastSeen ?? d.createdAt,
      };
    });
  });
}

export async function revokeDevice(id: string) {
  return withLock(async () => {
    const state = await readState();
    delete state.devices[id];
    for (const [uid, lock] of Object.entries(state.phoneLocks ?? {})) {
      if (lock.deviceId === id) delete state.phoneLocks[uid];
    }
    await persist(state);
    try {
      const sql = await getSql();
      await sql.query(`delete from jg_auth_devices where id = $1`, [id]);
    } catch {
      /* persist already wrote */
    }
    return { ok: true as const };
  });
}

export async function pingPhoneSeat(deviceId?: string, deviceSecret?: string, ip = "", print = "") {
  return withLock(async () => {
    const state = await readState();
    const found = findDevice(state, deviceId, deviceSecret);
    if (!found) return { ok: false as const };
    const seat = takePhoneSeat(state, found.row.userId, found.id, ip, print);
    if (!seat.ok) return seat;
    rememberIp(found.row, ip, "", print);
    await persist(state);
    return { ok: true as const };
  });
}

export async function releasePhoneSeat(deviceId?: string, deviceSecret?: string) {
  return withLock(async () => {
    const state = await readState();
    const found = findDevice(state, deviceId, deviceSecret);
    if (!found) return { ok: true as const };
    const lock = state.phoneLocks[found.row.userId];
    if (lock && lock.deviceId === found.id) delete state.phoneLocks[found.row.userId];
    await persist(state);
    return { ok: true as const };
  });
}

export async function pollTicket(id: string, secret: string) {
  return withLock(async () => {
    const state = await readState();
    pruneTickets(state);
    const t = state.tickets[id];
    if (!t || t.secret !== secret) return { status: "missing" as const };
    if (t.expiresAt < Date.now()) return { status: "expired" as const };
    if (t.status === "pending") return { status: "pending" as const };
    if (t.status === "consumed") return { status: "consumed" as const };
    const user = t.userId ? state.usuarios.find((u) => u.id === t.userId) : undefined;
    t.status = "consumed";
    delete state.tickets[id];
    await persist(state);
    if (!user) return { status: "missing" as const };
    stampAuth(user, state.senhas[user.id] ?? "");
    return { status: "approved" as const, user: publicUser(user), senha: state.senhas[user.id] ?? "" };
  });
}

export async function resetPassword(email: string, nome: string, novaSenha: string) {
  return withLock(async () => {
    const state = await readState();
    if (!adminFromRequest(state)) return { ok: false as const, error: "Redefinição de senha só pelo administrador." };
    const user = state.usuarios.find((u) => norm(u.email) === norm(email));
    if (!user || !user.status) return { ok: false as const, error: "Não encontramos essa conta." };
    if (norm(user.nome) !== norm(nome)) return { ok: false as const, error: "O nome não confere com o cadastro." };
    const pass = novaSenha.trim();
    if (pass.length < 4) return { ok: false as const, error: "A nova senha precisa ter pelo menos 4 caracteres." };
    state.senhas[user.id] = pass;
    await persist(state);
    return { ok: true as const, user: publicUser(user) };
  });
}

export async function probeAccess(print = "", creds?: { deviceId?: string; secret?: string } | null, ip = "", ua = "") {
  return withLock(async () => {
    const state = await readState();
    const meta = parseUserAgent(ua);
    const found = findDevice(state, creds?.deviceId, creds?.secret);
    const user = found ? state.usuarios.find((u) => u.id === found.row.userId && u.status) : undefined;
    const known = Boolean(user);
    return {
      sessionId: crypto.randomUUID(),
      ip: ip || "desconhecido",
      os: meta.os,
      browser: meta.browser,
      deviceKind: meta.deviceKind,
      known,
      knownLabel: found?.row.label || "",
      knownUser: user?.nome || "",
      createdAt: nowIso(),
    };
  });
}
