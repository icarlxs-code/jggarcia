import type { Contagem, Lote, Mercadoria, Pavilhao } from "./types";
import { pavTitle } from "./catalog";
import { formatNumber } from "./format";

export type AttentionAlert = {
  id: string;
  title: string;
  detail: string;
  to: "/contagem" | "/lotes";
  search?: { pav: string; produto: string };
};

const MUTE_KEY = "jg-alert-mute-v1";

function readMutes(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(MUTE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadMutedAlerts(userId?: string | null): Set<string> {
  const id = userId || "_anon";
  return new Set(readMutes()[id] ?? []);
}

export function muteAlert(userId: string | null | undefined, alertId: string) {
  const id = userId || "_anon";
  const all = readMutes();
  const next = new Set(all[id] ?? []);
  next.add(alertId);
  all[id] = [...next].slice(-200);
  try {
    localStorage.setItem(MUTE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** Só a última contagem de cada produto no lugar, e só se não bateu. */
export function attentionAlerts(opts: {
  contagens: Contagem[];
  mercadorias: Mercadoria[];
  pavilhoes: Pavilhao[];
  lotes?: Lote[];
}): AttentionAlert[] {
  const latest = new Map<string, Contagem>();
  for (const c of opts.contagens) {
    if (c.deleted_at) continue;
    const key = `${c.mercadoria_id}\t${c.pavilhao_id}`;
    const prev = latest.get(key);
    if (!prev || (c.created_at || "") > (prev.created_at || "")) latest.set(key, c);
  }

  const alerts: AttentionAlert[] = [];
  const open = [...latest.values()].filter((c) => c.delta !== 0).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  for (const c of open) {
    const merc = opts.mercadorias.find((m) => m.id === c.mercadoria_id);
    const pav = opts.pavilhoes.find((p) => p.id === c.pavilhao_id);
    const falta = c.delta < 0;
    const nome = merc?.nome ?? "Produto";
    const onde = pav ? pavTitle(pav) : "lugar";
    alerts.push({
      id: `diverge-${c.id}`,
      title: falta ? "Não bateu · falta" : "Não bateu · sobra",
      detail: `${nome} · ${onde} · no sistema ${formatNumber(c.esperado)}, contado ${formatNumber(c.contado)} ${c.unidade}.`,
      to: "/contagem",
      search: { pav: c.pavilhao_id, produto: c.mercadoria_id },
    });
  }

  for (const l of opts.lotes ?? []) {
    alerts.push({
      id: `lote-${l.id}`,
      title: "Lote vencido",
      detail: `${l.codigo} venceu e ainda está no controle.`,
      to: "/lotes",
    });
  }

  return alerts;
}