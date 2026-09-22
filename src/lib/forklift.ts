import { destinoDaSaida, lugarDaSaida, pavTitle } from "./catalog";
import { formatDateBR, formatMinutes } from "./format";
import type { Pavilhao, Saida } from "./types";

export interface ForkliftTrip {
  id: string;
  data: string;
  operador: string;
  empilhadeira: string;
  from: string;
  to: string;
  route: string;
  minutos: number;
  produto: string;
  quantidade: number;
  unidade: string;
}

export interface OperatorRank {
  nome: string;
  trips: number;
  avg: number;
  fastest: number;
  slowest: number;
  vsTeam: number;
}

export interface RouteDay {
  data: string;
  minutos: number;
  operador: string;
}

export interface RouteInsight {
  route: string;
  trips: number;
  avg: number;
  fastest: RouteDay;
  slowest: RouteDay;
}

export interface TripVerdict {
  trip: ForkliftTrip;
  routeAvg: number;
  ownAvg: number;
  label: string;
  pace: "rapido" | "medio" | "lento";
}

function mean(ns: number[]) {
  if (!ns.length) return 0;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

export function forkliftTrips(saidas: Saida[], pavilhoes: Pavilhao[]): ForkliftTrip[] {
  const out: ForkliftTrip[] = [];
  for (const s of saidas) {
    if ((s.tipo ?? "saida") !== "saida") continue;
    if (s.deleted_at) continue;
    const minutos = Number(s.tempo_transporte);
    if (!Number.isFinite(minutos) || minutos < 0) continue;
    const from = lugarDaSaida(pavilhoes, s);
    const to = destinoDaSaida(pavilhoes, s);
    out.push({
      id: s.id,
      data: s.data,
      operador: (s.operador_nome || "").trim(),
      empilhadeira: (s.empilhadeira || "").trim(),
      from,
      to,
      route: `${from} → ${to}`,
      minutos,
      produto: s.mercadoria?.nome ?? "Produto",
      quantidade: Number(s.quantidade) || 0,
      unidade: s.unidade,
    });
  }
  return out.sort((a, b) => `${b.data}`.localeCompare(a.data) || b.minutos - a.minutos);
}

export function forkliftRanking(trips: ForkliftTrip[]) {
  const named = trips.filter((t) => t.operador);
  const teamAvg = mean(named.map((t) => t.minutos));
  const byOp = new Map<string, number[]>();
  for (const t of named) {
    const list = byOp.get(t.operador) ?? [];
    list.push(t.minutos);
    byOp.set(t.operador, list);
  }
  const rank: OperatorRank[] = [...byOp.entries()]
    .map(([nome, mins]) => {
      const avg = mean(mins);
      return {
        nome,
        trips: mins.length,
        avg,
        fastest: Math.min(...mins),
        slowest: Math.max(...mins),
        vsTeam: teamAvg ? avg - teamAvg : 0,
      };
    })
    .sort((a, b) => a.avg - b.avg || b.trips - a.trips);

  const byRoute = new Map<string, ForkliftTrip[]>();
  for (const t of trips) {
    const list = byRoute.get(t.route) ?? [];
    list.push(t);
    byRoute.set(t.route, list);
  }
  const routes: RouteInsight[] = [...byRoute.entries()]
    .map(([route, list]) => {
      const sorted = list.slice().sort((a, b) => a.minutos - b.minutos);
      const fast = sorted[0];
      const slow = sorted[sorted.length - 1];
      return {
        route,
        trips: list.length,
        avg: mean(list.map((t) => t.minutos)),
        fastest: { data: fast.data, minutos: fast.minutos, operador: fast.operador || "—" },
        slowest: { data: slow.data, minutos: slow.minutos, operador: slow.operador || "—" },
      };
    })
    .sort((a, b) => b.trips - a.trips);

  const routeAvg = new Map(routes.map((r) => [r.route, r.avg]));
  const ownAvg = new Map<string, number>();
  for (const t of named) {
    const key = `${t.operador}|${t.route}`;
    const list = named.filter((x) => x.operador === t.operador && x.route === t.route).map((x) => x.minutos);
    ownAvg.set(key, mean(list));
  }

  const verdicts: TripVerdict[] = named.map((trip) => {
    const rAvg = routeAvg.get(trip.route) || trip.minutos;
    const oAvg = ownAvg.get(`${trip.operador}|${trip.route}`) || trip.minutos;
    const deltaRoute = trip.minutos - rAvg;
    let pace: TripVerdict["pace"] = "medio";
    let label = `Na média desta rota (${formatMinutes(rAvg)})`;
    if (deltaRoute <= -2) {
      pace = "rapido";
      label = `${formatMinutes(Math.abs(deltaRoute))} mais rápido que a média ${trip.route}`;
    } else if (deltaRoute >= 3) {
      pace = "lento";
      label = `${formatMinutes(deltaRoute)} acima da média desta rota`;
    }
    if (oAvg && Math.abs(trip.minutos - oAvg) >= 2) {
      const ownDelta = trip.minutos - oAvg;
      label +=
        ownDelta < 0
          ? ` · ${formatMinutes(Math.abs(ownDelta))} abaixo do usual dele`
          : ` · ${formatMinutes(ownDelta)} acima do usual dele`;
    }
    return { trip, routeAvg: rAvg, ownAvg: oAvg, label, pace };
  });

  return {
    teamAvg,
    rank,
    routes,
    verdicts,
    fastest: rank[0] ?? null,
    namedCount: named.length,
  };
}

export function atalhoLabel(opts: {
  kind: "entrada" | "saida" | "transferencia";
  origemNome?: string;
  destinoNome?: string;
  produtoNome?: string;
}) {
  const from = opts.origemNome || "origem";
  const to = opts.destinoNome || "destino";
  const prod = opts.produtoNome ? ` · ${opts.produtoNome}` : "";
  if (opts.kind === "entrada") return `Entrada no ${from}${prod}`;
  if (opts.kind === "transferencia") return `${from} → ${to}${prod}`;
  return `Saída ${from} → ${to}${prod}`;
}

export function pavLabelOf(pavilhoes: Pavilhao[], id?: string) {
  if (!id) return "";
  const p = pavilhoes.find((x) => x.id === id);
  return p ? pavTitle(p) : "";
}

export function formatTripDay(iso: string) {
  return formatDateBR(iso);
}
