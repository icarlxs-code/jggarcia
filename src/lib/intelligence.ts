import type { Mercadoria, Saida } from "./types";

export type SmartAlert = {
  id: string;
  level: "warn" | "crit";
  title: string;
  detail: string;
  at: string;
};

function median(nums: number[]) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function ts(s: Saida) {
  return Date.parse(s.created_at) || 0;
}

export function detectIssues(movs: Saida[], produtos: Mercadoria[]): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const recent = movs.filter((m) => now - ts(m) < day).sort((a, b) => ts(b) - ts(a));

  for (const m of recent.slice(0, 40)) {
    const tipo = m.tipo ?? "saida";
    const twins = recent.filter(
      (o) =>
        o.id !== m.id &&
        o.mercadoria_id === m.mercadoria_id &&
        (o.tipo ?? "saida") === tipo &&
        Math.abs(ts(o) - ts(m)) < 4 * 60 * 1000 &&
        Math.abs(o.quantidade - m.quantidade) / Math.max(o.quantidade, m.quantidade, 1) < 0.08,
    );
    if (twins.length) {
      alerts.push({
        id: `dup-${m.id}`,
        level: "warn",
        title: "Possível lançamento duplicado",
        detail: `${m.mercadoria?.nome ?? "Produto"} · ${m.quantidade} ${m.unidade} lançado de novo em poucos minutos.`,
        at: m.created_at,
      });
    }

    const hist = movs
      .filter((o) => o.id !== m.id && o.mercadoria_id === m.mercadoria_id && (o.tipo ?? "saida") === tipo)
      .slice(0, 20)
      .map((o) => o.quantidade)
      .filter((n) => n > 0);
    if (hist.length >= 5) {
      const med = median(hist);
      if (med >= 8 && m.quantidade >= med * 3.2) {
        alerts.push({
          id: `alto-${m.id}`,
          level: "crit",
          title: tipo === "entrada" ? "Entrada bem acima do normal" : "Saída bem acima do normal",
          detail: `${m.mercadoria?.nome ?? "Produto"} · ${m.quantidade} ${m.unidade}. O usual deste item é cerca de ${Math.round(med)} ${m.unidade}.`,
          at: m.created_at,
        });
      }
    }

    if (tipo === "saida" && m.desconta_estoque !== false && !m.destino_pavilhao_id) {
      const prod = produtos.find((p) => p.id === m.mercadoria_id);
      if (prod && prod.estoque <= 0 && m.quantidade > 0) {
        alerts.push({
          id: `zero-${m.id}`,
          level: "crit",
          title: "Saída zerou o estoque",
          detail: `${m.mercadoria?.nome ?? "Produto"} ficou em 0 após a saída de ${m.quantidade} ${m.unidade}.`,
          at: m.created_at,
        });
      }
    }
  }

  const seen = new Set<string>();
  return alerts.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

const SEEN_KEY = "jg-smart-alerts-seen";

export function loadSeenAlerts(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function markAlertSeen(id: string) {
  const set = loadSeenAlerts();
  set.add(id);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-80)));
  } catch {
    /* ignore */
  }
}
