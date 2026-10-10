import type { Atalho, AuditLog, Contagem, Destino, Empilhador, Fornecedor, FretePagamento, Lote, Mercadoria, Pavilhao, Saida, Usuario } from "./types";

export type CloudPayload = {
  usuarios: Usuario[];
  mercadorias: Mercadoria[];
  destinos: Destino[];
  fornecedores: Fornecedor[];
  pavilhoes: Pavilhao[];
  lotes: Lote[];
  saidas: Saida[];
  logs: AuditLog[];
  contagens: Contagem[];
  contadores?: string[];
  atalhos?: Atalho[];
  operadores?: string[];
  empilhadeiras?: string[];
  empilhadoresPessoas?: Empilhador[];
  fretes?: FretePagamento[];
  stockResetAt?: string | null;
};

function byId<T extends { id: string }>(rows: T[] | undefined): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows ?? []) {
    if (row?.id) map.set(row.id, row);
  }
  return map;
}

function mergeRows<T extends { id: string }>(a: T[] = [], b: T[] = []): T[] {
  const map = byId(a);
  for (const row of b) {
    const prev = map.get(row.id);
    if (!prev) {
      map.set(row.id, row);
      continue;
    }
    map.set(row.id, { ...prev, ...row });
  }
  return [...map.values()];
}

function mergeAtalhos(a: Atalho[] = [], b: Atalho[] = []): Atalho[] {
  const map = byId(a);
  for (const row of b) {
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

function mergeEmpilhadores(a: Empilhador[] = [], b: Empilhador[] = []): Empilhador[] {
  const map = byId(a);
  const byName = new Map<string, Empilhador>();
  for (const row of map.values()) {
    if (row.nome) byName.set(row.nome.toLowerCase(), row);
  }
  for (const row of b) {
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

function mergeMercadorias(a: Mercadoria[] = [], b: Mercadoria[] = []): Mercadoria[] {
  const map = byId(a);
  for (const row of b) {
    const prev = map.get(row.id) ?? [...map.values()].find((x) => x.codigo === row.codigo);
    if (!prev) {
      map.set(row.id, row);
      continue;
    }
    map.set(prev.id, {
      ...prev,
      ...row,
      id: prev.id,
      estoque: Math.max(Number(prev.estoque) || 0, Number(row.estoque) || 0),
      minimo: Math.max(Number(prev.minimo) || 0, Number(row.minimo) || 0),
    });
  }
  return [...map.values()];
}

export function mergePayload(a: CloudPayload | null | undefined, b: CloudPayload | null | undefined): CloudPayload {
  const left = a ?? emptyPayload();
  const right = b ?? emptyPayload();
  const stockResetAt = [left.stockResetAt, right.stockResetAt].filter(Boolean).sort().pop() || null;
  const saidas = mergeRows(left.saidas, right.saidas);
  const mercadorias = mergeMercadorias(left.mercadorias, right.mercadorias);
  const lotes = mergeRows(left.lotes, right.lotes);
  if (stockResetAt) {
    const qty = new Map<string, number>();
    for (const s of saidas) {
      if (s.deleted_at) continue;
      if ((s.created_at || "") <= stockResetAt) continue;
      if ((s.tipo ?? "saida") === "saida" && s.desconta_estoque === false) continue;
      if ((s.tipo ?? "saida") === "saida" && s.destino_pavilhao_id) continue;
      const sign = (s.tipo ?? "saida") === "entrada" ? 1 : -1;
      qty.set(s.mercadoria_id, (qty.get(s.mercadoria_id) || 0) + sign * Number(s.quantidade || 0));
    }
    for (const m of mercadorias) m.estoque = Math.max(0, qty.get(m.id) || 0);
    for (const l of lotes) l.quantidade = 0;
  }
  return {
    ...left,
    ...right,
    usuarios: mergeRows(left.usuarios, right.usuarios),
    mercadorias,
    destinos: mergeRows(left.destinos, right.destinos),
    fornecedores: mergeRows(left.fornecedores, right.fornecedores),
    pavilhoes: mergeRows(left.pavilhoes, right.pavilhoes),
    lotes,
    saidas,
    logs: mergeRows(left.logs, right.logs).sort((x, y) => (y.created_at || "").localeCompare(x.created_at || "")),
    contagens: mergeRows(left.contagens, right.contagens),
    contadores: [...new Set([...(left.contadores ?? []), ...(right.contadores ?? [])])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    atalhos: mergeAtalhos(left.atalhos, right.atalhos),
    operadores: [...new Set([...(left.operadores ?? []), ...(right.operadores ?? [])])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    empilhadeiras: [...new Set([...(left.empilhadeiras ?? []), ...(right.empilhadeiras ?? [])])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    empilhadoresPessoas: mergeEmpilhadores(left.empilhadoresPessoas, right.empilhadoresPessoas),
    fretes: mergeRows(left.fretes, right.fretes),
    stockResetAt,
  };
}

export function emptyPayload(): CloudPayload {
  return {
    usuarios: [],
    mercadorias: [],
    destinos: [],
    fornecedores: [],
    pavilhoes: [],
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
    stockResetAt: null,
  };
}

function weight(p: CloudPayload) {
  return (p.saidas?.length || 0) + (p.usuarios?.length || 0) + (p.destinos?.length || 0) + (p.logs?.length || 0) + (p.mercadorias?.length || 0) + (p.contagens?.length || 0);
}

function unionById<T extends { id: string }>(current: T[] = [], older: T[] = []): T[] {
  const map = new Map<string, T>();
  for (const row of older) if (row?.id) map.set(row.id, row);
  for (const row of current) if (row?.id) map.set(row.id, row);
  return [...map.values()];
}

function peopleFromLogs(payload: CloudPayload): Usuario[] {
  const found = new Map<string, Usuario>();
  for (const log of payload.logs ?? []) {
    const id = log.usuario_id;
    const nome = log.usuario_nome?.trim();
    if (!id || id === "sistema" || !nome) continue;
    const slug = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    found.set(id, {
      id,
      nome,
      email: `${slug || "equipe"}@jggarcia.com.br`,
      nivel_acesso: "admin",
      status: true,
      created_at: log.created_at || "2026-09-18T11:54:17.699Z",
    });
  }
  return [...found.values()];
}

function restoreHistory(current: CloudPayload, history: CloudPayload[]): CloudPayload {
  let saidas = current.saidas ?? [];
  let lotes = current.lotes ?? [];
  let logs = current.logs ?? [];
  let mercadorias = current.mercadorias ?? [];
  let usuarios = current.usuarios ?? [];
  let fretes = current.fretes ?? [];
  let contagens = current.contagens ?? [];
  for (const old of history) {
    saidas = unionById(saidas, old.saidas);
    lotes = unionById(lotes, old.lotes);
    logs = unionById(logs, old.logs);
    mercadorias = unionById(mercadorias, old.mercadorias);
    usuarios = unionById(usuarios, old.usuarios);
    fretes = unionById(fretes, old.fretes);
    contagens = unionById(contagens, old.contagens);
    usuarios = unionById(usuarios, peopleFromLogs(old));
  }
  usuarios = unionById(usuarios, peopleFromLogs({ ...current, logs }));
  return { ...current, saidas, lotes, logs, mercadorias, usuarios, fretes, contagens };
}

export async function databaseUsage() {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  try {
    const rows = await sql.query<{
      db_bytes: number;
      payload_bytes: number;
      revisions: number;
      revisions_bytes: number;
    }>(
      `select
        pg_database_size(current_database())::float8 as db_bytes,
        coalesce((select pg_column_size(payload)::float8 from jg_store where id = 'main'), 0) as payload_bytes,
        coalesce((select count(*)::float8 from jg_store_revisions), 0) as revisions,
        coalesce((select coalesce(sum(pg_column_size(payload)), 0)::float8 from jg_store_revisions), 0) as revisions_bytes`,
    );
    const row = rows[0];
    return {
      ok: true as const,
      dbBytes: Number(row?.db_bytes || 0),
      payloadBytes: Number(row?.payload_bytes || 0),
      revisions: Number(row?.revisions || 0),
      revisionsBytes: Number(row?.revisions_bytes || 0),
    };
  } catch {
    return { ok: false as const, dbBytes: 0, payloadBytes: 0, revisions: 0, revisionsBytes: 0 };
  }
}

export async function pullPayload(): Promise<CloudPayload | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql.query<{ payload: CloudPayload }>("select payload from jg_store where id = $1", ["main"]);
  const current = rows[0]?.payload ?? null;
  if (!current) return null;
  const history: CloudPayload[] = [];
  try {
    const revisions = await sql.query<{ payload: CloudPayload }>(
      "select payload from jg_store_revisions order by created_at desc limit 40",
    );
    for (const row of revisions) if (row.payload) history.push(row.payload);
  } catch {
    /* sem revisões */
  }
  try {
    const auth = await sql.query<{
      id: string;
      nome: string;
      email: string;
      nivel_acesso: string;
      status: unknown;
      created_at: string;
    }>("select id, nome, email, nivel_acesso, status, created_at from jg_auth_users");
    if (auth.length) {
      history.push({
        ...emptyPayload(),
        usuarios: auth.map((user) => ({
          id: user.id,
          nome: user.nome,
          email: user.email,
          nivel_acesso: user.nivel_acesso === "admin" ? "admin" : "operador",
          status: user.status !== false && user.status !== "f" && user.status !== "false" && user.status !== 0,
          created_at: user.created_at,
        })),
      });
    }
  } catch {
    /* tabela de login é separada */
  }
  const restored = restoreHistory(current, history);
  const before = (current.usuarios?.length || 0) + (current.saidas?.length || 0) + (current.lotes?.length || 0);
  const after = (restored.usuarios?.length || 0) + (restored.saidas?.length || 0) + (restored.lotes?.length || 0);
  if (after > before) {
    await sql.query(
      `insert into jg_store (id, payload, updated_at) values ('main', $1::jsonb, now())
       on conflict (id) do update set payload = excluded.payload, updated_at = now()`,
      [JSON.stringify(restored)],
    );
    return restored;
  }
  return current;
}

export async function pushPayload(incoming: CloudPayload): Promise<CloudPayload> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const current = await pullPayload();
  if (current && weight(incoming) === 0 && weight(current) > 0) {
    return current;
  }
  const merged = mergePayload(current, incoming);
  if (current && weight(merged) < weight(current)) {
    return current;
  }
  const raw = JSON.stringify(merged);
  await sql.query(
    `insert into jg_store (id, payload, updated_at) values ('main', $1::jsonb, now())
     on conflict (id) do update set payload = excluded.payload, updated_at = now()`,
    [raw],
  );
  try {
    await sql.query(`insert into jg_store_revisions (payload) values ($1::jsonb)`, [raw]);
    await sql.query(
      `delete from jg_store_revisions where id not in (select id from jg_store_revisions order by created_at desc limit 40)`,
    );
  } catch {
    /* revisão é extra; o snapshot principal já gravou */
  }
  return merged;
}
