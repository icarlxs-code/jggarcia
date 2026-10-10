const LOCAL_KEYS = ["jg-garcia-db-v3", "jg-garcia-db-v3-bak", "jg-garcia-outbox"];
/** Fallback antigo. O banco principal agora usa o IndexedDB, com a cota real do navegador. */
export const LOCAL_DB_LIMIT = 5 * 1024 * 1024;

export interface LocalDbSpace {
  usado: number;
  limite: number;
  livre: number;
  partes: { nome: string; bytes: number }[];
  quotaNavegador: number | null;
  usoNavegador: number | null;
}

function sizeOf(value: unknown) {
  try {
    return new Blob([JSON.stringify(value ?? null)]).size;
  } catch {
    return 0;
  }
}

export function readLocalDbSpace(): LocalDbSpace {
  let raw = "";
  let usado = 0;
  if (typeof localStorage !== "undefined") {
    for (const key of LOCAL_KEYS) {
      const value = localStorage.getItem(key);
      if (!value) continue;
      usado += new Blob([key + value]).size;
      if (key === "jg-garcia-db-v3") raw = value;
    }
  }
  const partes: { nome: string; bytes: number }[] = [];
  if (raw) {
    try {
      const data = JSON.parse(raw) as {
        mercadorias?: { foto?: string; foto_original?: string }[];
        saidas?: unknown[];
        logs?: unknown[];
        contagens?: unknown[];
        forkliftJobs?: { photo?: string }[];
        fechamentos?: unknown[];
      };
      const fotos = (data.mercadorias ?? []).reduce((n, m) => n + sizeOf(m.foto) + sizeOf(m.foto_original), 0);
      const fotosEmpilhador = (data.forkliftJobs ?? []).reduce((n, j) => n + sizeOf(j.photo), 0);
      partes.push(
        { nome: "Fotos dos produtos", bytes: fotos },
        { nome: "Fotos dos empilhadores", bytes: fotosEmpilhador },
        { nome: "Saídas e entradas", bytes: sizeOf(data.saidas) },
        { nome: "Contagens", bytes: sizeOf(data.contagens) },
        { nome: "Fechamentos", bytes: sizeOf(data.fechamentos) },
        { nome: "Histórico", bytes: sizeOf(data.logs) },
      );
    } catch {
      /* json inválido */
    }
  }
  return {
    usado,
    limite: LOCAL_DB_LIMIT,
    livre: Math.max(0, LOCAL_DB_LIMIT - usado),
    partes: partes.filter((p) => p.bytes > 0).sort((a, b) => b.bytes - a.bytes),
    quotaNavegador: null,
    usoNavegador: null,
  };
}

export async function readDeviceDbSpace(): Promise<LocalDbSpace> {
  const { idbGet } = await import("./idb-store");
  let raw = "";
  try {
    raw = (await idbGet("jg-garcia-db-v3")) || "";
  } catch {
    raw = "";
  }
  if (!raw && typeof localStorage !== "undefined") raw = localStorage.getItem("jg-garcia-db-v3") || "";
  const base = readLocalDbSpace();
  const usado = raw ? new Blob([raw]).size : base.usado;
  let limite = 0;
  let usoNavegador: number | null = null;
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota) limite = est.quota;
    if (est?.usage != null) usoNavegador = est.usage;
  } catch {
    limite = 0;
  }
  const partes = raw ? partsFrom(raw) : base.partes;
  return {
    usado,
    limite: limite || LOCAL_DB_LIMIT,
    livre: Math.max(0, (limite || LOCAL_DB_LIMIT) - (usoNavegador ?? usado)),
    partes,
    quotaNavegador: limite || null,
    usoNavegador,
  };
}

function partsFrom(raw: string): { nome: string; bytes: number }[] {
  try {
    const data = JSON.parse(raw) as {
      mercadorias?: { foto?: string; foto_original?: string }[];
      saidas?: unknown[];
      logs?: unknown[];
      contagens?: unknown[];
      forkliftJobs?: { photo?: string }[];
      fechamentos?: unknown[];
    };
    const fotos = (data.mercadorias ?? []).reduce((n, m) => n + sizeOf(m.foto) + sizeOf(m.foto_original), 0);
    const fotosEmpilhador = (data.forkliftJobs ?? []).reduce((n, j) => n + sizeOf(j.photo), 0);
    return [
      { nome: "Fotos dos produtos", bytes: fotos },
      { nome: "Fotos dos empilhadores", bytes: fotosEmpilhador },
      { nome: "Saídas e entradas", bytes: sizeOf(data.saidas) },
      { nome: "Contagens", bytes: sizeOf(data.contagens) },
      { nome: "Fechamentos", bytes: sizeOf(data.fechamentos) },
      { nome: "Histórico", bytes: sizeOf(data.logs) },
    ].filter((p) => p.bytes > 0);
  } catch {
    return [];
  }
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} GB`;
  }
  if (bytes < 1024) return `${Math.round(bytes).toLocaleString("pt-BR")} B`;
  if (mb < 1) {
    return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: bytes < 10 * 1024 ? 1 : 0 })} KB`;
  }
  return `${mb.toLocaleString("pt-BR", { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}