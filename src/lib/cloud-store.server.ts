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

export async function pullPayload(): Promise<CloudPayload | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql.query<{ payload: CloudPayload }>("select payload from jg_store where id = $1", ["main"]);
  return rows[0]?.payload ?? null;
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
