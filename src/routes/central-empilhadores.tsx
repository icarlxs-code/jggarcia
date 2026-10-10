import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { fold, cn } from "@/lib/utils";
import { formatDateTimeBR, formatNumber, todayISO } from "@/lib/format";
import { formatDurationText, formatElapsed } from "@/lib/forklift-device";
import { notify } from "@/lib/notify";
import { pavTitle } from "@/lib/catalog";
import type { ForkliftJob } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OpNote } from "@/components/motion/lottie-clip";

export const Route = createFileRoute("/central-empilhadores")({
  component: () => <Navigate to="/empilhadores" />,
});

type Aba = "agora" | "hoje" | "historico";

export function ForkliftBoard({ foco = "" }: { foco?: string }) {
  const live = useDb();
  const [aba, setAba] = useState<Aba>("hoje");
  const [q, setQ] = useState(foco);
  const [open, setOpen] = useState<ForkliftJob | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const hoje = todayISO();

  useEffect(() => {
    if (!foco) return;
    setQ(foco);
    setAba("hoje");
  }, [foco]);

  useEffect(() => {
    function onFork(event: Event) {
      const detail = (event as CustomEvent<{ action?: string; id?: string }>).detail;
      if (!detail?.id) return;
      const job = db.listForkliftJobs().find((j) => j.id === detail.id);
      if (!job) return;
      if (detail.action === "excluir") {
        db.deleteForkliftJob(job.id);
        setOpen(null);
        notify.success("Transporte excluído.");
        return;
      }
      setAba(job.status === "em_transporte" ? "agora" : job.started_at.startsWith(hoje) ? "hoje" : "historico");
      setOpen(job);
      setMapOpen(true);
    }
    window.addEventListener("jg-forklift", onFork);
    return () => window.removeEventListener("jg-forklift", onFork);
  }, [hoje]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    const pull = window.setInterval(() => {
      if (document.visibilityState === "visible") void import("@/lib/store").then((m) => m.hydrateFromCloud());
    }, 3000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(pull);
    };
  }, []);

  const jobs = live.listForkliftJobs();
  const term = fold(q.trim());
  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (aba === "agora" && job.status !== "em_transporte") return false;
      if (aba === "hoje" && !job.started_at.startsWith(hoje)) return false;
      if (aba === "historico" && job.status === "em_transporte") return false;
      if (!term) return true;
      return [job.operator_nome, job.product_nome, job.product_codigo, job.origin_nome, job.destination_nome, job.codigo, job.started_at.slice(0, 10)]
        .some((v) => fold(v).includes(term));
    });
  }, [jobs, aba, hoje, term]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["agora", "hoje", "historico"] as Aba[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={cn("h-10 rounded-full border px-4 text-sm font-medium", aba === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}
          >
            {id === "agora" ? "Agora" : id === "hoje" ? "Hoje" : "Histórico"}
          </button>
        ))}
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Empilhador, produto, código, origem, destino, data ou ID"
        className="h-11 w-full rounded-xl border border-border bg-card px-3"
      />
      {filtered.length === 0 ? (
        <OpNote
          src="/lottie/galpao.json"
          clipClassName="lottie-clip h-20 w-32 shrink-0"
          title={aba === "agora" ? "Nenhum transporte em andamento" : "Nenhum transporte neste filtro"}
          detail={aba === "agora" ? "Quando uma saída sair com empilhador, ela aparece aqui." : "Troque a aba ou limpe a busca."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} now={now} onOpen={() => { setOpen(job); setMapOpen(false); }} />
          ))}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          {open ? <JobDetail key={open.id} job={jobs.find((j) => j.id === open.id) || open} now={now} mapOpen={mapOpen} onMap={() => setMapOpen(true)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function tone(job: ForkliftJob, ageSec: number | null) {
  if (job.status !== "em_transporte") return "border-border bg-card";
  if (ageSec == null || ageSec > 180) return "border-red-300 bg-red-50";
  if (ageSec > 45) return "border-amber-300 bg-amber-50";
  return "border-emerald-300 bg-emerald-50";
}

function linkedLabel(id?: string | null) {
  if (!id) return "";
  const mov = db.getSaida(id);
  if (!mov) return "Lançamento removido";
  const tipo = (mov.tipo ?? "saida") === "entrada" ? "Entrada" : "Saída";
  return `${tipo} ${mov.codigo || mov.id.slice(0, 6)}`;
}

function JobCard({ job, now, onOpen }: { job: ForkliftJob; now: number; onOpen: () => void }) {
  const locs = db.forkliftLocations(job.id);
  const last = locs[locs.length - 1];
  const age = last ? Math.round((now - new Date(last.captured_at).getTime()) / 1000) : null;
  const link = linkedLabel(job.movimento_id);
  const map = last
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${last.longitude - 0.004}%2C${last.latitude - 0.003}%2C${last.longitude + 0.004}%2C${last.latitude + 0.003}&layer=mapnik&marker=${last.latitude}%2C${last.longitude}`
    : "";
  return (
    <article
      data-ctx="transporte"
      data-id={job.id}
      data-nome={job.operator_nome}
      data-extra={job.codigo}
      data-produto={job.product_id}
      onClick={onOpen}
      className={cn("flex min-w-0 max-w-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card text-left", tone(job, age))}
    >
      <div className="h-32 max-h-32 overflow-hidden bg-muted sm:h-36 sm:max-h-36">
        {job.photo ? <img src={job.photo} alt={`Foto de ${job.operator_nome}`} className="block h-full w-full max-w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-muted-foreground">Sem foto</div>}
      </div>
      <div className="space-y-0.5 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{job.operator_nome}</p>
          <span className="shrink-0 text-[10px] font-medium uppercase text-muted-foreground">{job.status === "em_transporte" ? "Em transporte" : job.status === "concluido" ? "Concluído" : "Cancelado"}</span>
        </div>
        <p className="truncate text-sm">{job.product_nome}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{formatNumber(job.quantity)} {job.unit}</p>
        <p className="truncate text-xs">{job.origin_nome} → {job.destination_nome}</p>
        <p className="font-mono text-sm font-semibold tabular-nums">{job.status === "em_transporte" ? formatElapsed(job.started_at, now) : job.finished_at ? formatDurationText(job.started_at, job.finished_at) : "—"}</p>
        {link ? <p className="truncate text-[11px] text-muted-foreground">{link}</p> : null}
      </div>
      {last ? (
        <div className="mt-auto border-t border-border">
          <iframe title={`Localização de ${job.operator_nome}`} src={map} className="pointer-events-none hidden h-24 w-full sm:block" loading="lazy" />
          <p className="px-3 py-1.5 text-[11px] leading-4 text-muted-foreground">
            Última localização {new Date(last.captured_at).toLocaleTimeString("pt-BR")}
            <span className="mt-0.5 block tabular-nums">{last.latitude.toFixed(5)}, {last.longitude.toFixed(5)} · ± {Math.round(last.accuracy)} m</span>
          </p>
        </div>
      ) : (
        <p className="mt-auto px-3 pb-2.5 text-[11px] text-muted-foreground">Sem localização recebida</p>
      )}
    </article>
  );
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function JobDetail({ job, now, mapOpen, onMap }: { job: ForkliftJob; now: number; mapOpen: boolean; onMap: () => void }) {
  const live = useDb();
  const locs = db.forkliftLocations(job.id);
  const last = locs[locs.length - 1];
  const age = last ? Math.max(0, Math.round((now - new Date(last.captured_at).getTime()) / 1000)) : null;
  const src = last ? `https://www.openstreetmap.org/export/embed.html?bbox=${last.longitude - 0.01}%2C${last.latitude - 0.01}%2C${last.longitude + 0.01}%2C${last.latitude + 0.01}&layer=mapnik&marker=${last.latitude}%2C${last.longitude}` : "";
  const [operatorId, setOperatorId] = useState(job.operator_id);
  const [productId, setProductId] = useState(job.product_id);
  const [qty, setQty] = useState(String(job.quantity));
  const [originId, setOriginId] = useState(job.origin_id);
  const [destinationId, setDestinationId] = useState(job.destination_id);
  const [started, setStarted] = useState(toLocalInput(job.started_at));
  const [finished, setFinished] = useState(toLocalInput(job.finished_at));
  const [movQ, setMovQ] = useState("");
  const people = live.listEmpilhadores();
  const places = live.listPavilhoes();
  const products = live.listMercadorias(false);
  const dia = (started || job.started_at).slice(0, 10);
  const moves = live.listSaidas({ from: dia, to: dia }).filter((s) => {
    const tipo = (s.tipo ?? "saida") === "entrada" ? "entrada" : "saida";
    const blob = fold(`${s.codigo || ""} ${s.mercadoria?.nome || ""} ${tipo} ${s.quantidade}`);
    if (movQ.trim() && !blob.includes(fold(movQ.trim()))) return false;
    if (!movQ.trim() && s.mercadoria_id !== productId) return false;
    return true;
  }).slice(0, 20);
  const linked = job.movimento_id ? live.getSaida(job.movimento_id) : null;

  function save() {
    try {
      db.updateForkliftJob(job.id, {
        operatorId,
        productId,
        quantity: Number(String(qty).replace(",", ".")),
        originId,
        destinationId,
        startedAt: started ? new Date(started).toISOString() : job.started_at,
        finishedAt: finished ? new Date(finished).toISOString() : job.finished_at ?? null,
      });
      notify.success("Transporte atualizado.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  function link(id: string | null) {
    try {
      db.updateForkliftJob(job.id, { movimentoId: id });
      notify.success(id ? "Ligado ao lançamento." : "Ligação removida.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível ligar.");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{job.codigo}</DialogTitle>
      </DialogHeader>
      {job.photo ? <img src={job.photo} alt="Comprovante" className="max-h-56 w-full rounded-xl object-cover" /> : null}
      <p className="font-mono text-3xl font-semibold tabular-nums">{job.status === "em_transporte" ? formatElapsed(job.started_at, now) : job.finished_at ? formatDurationText(job.started_at, job.finished_at) : ""}</p>
      <p className="text-sm text-muted-foreground">{last ? `Localização há ${age}s · ± ${Math.round(last.accuracy)} m` : "Sem localização"}</p>
      {last && !mapOpen ? <button type="button" onClick={onMap} className="h-10 rounded-xl border border-border px-3 text-sm font-medium">Ver localização</button> : null}
      {mapOpen && src ? <iframe title="Localização" src={src} className="h-56 w-full rounded-xl border border-border" /> : null}

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Editar transporte</p>
        <select value={operatorId} onChange={(e) => setOperatorId(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
          {people.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
          {products.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className="h-10 w-full rounded-xl border border-border px-3 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <select value={originId} onChange={(e) => setOriginId(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-2 text-sm">
            {places.map((p) => <option key={p.id} value={p.id}>{pavTitle(p)}</option>)}
          </select>
          <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-2 text-sm">
            {places.map((p) => <option key={p.id} value={p.id}>{pavTitle(p)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="datetime-local" value={started} onChange={(e) => setStarted(e.target.value)} className="h-10 rounded-xl border border-border px-2 text-sm" />
          <input type="datetime-local" value={finished} onChange={(e) => setFinished(e.target.value)} className="h-10 rounded-xl border border-border px-2 text-sm" />
        </div>
        <button type="button" onClick={save} className="h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">Salvar alterações</button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("jg-forklift", { detail: { action: "excluir", id: job.id } }))}
          className="h-10 w-full rounded-xl border border-destructive text-sm font-medium text-destructive"
        >
          Excluir transporte
        </button>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ligar a uma entrada ou saída de {dia.split("-").reverse().join("/")}</p>
        {linked ? (
          <p className="text-sm">
            Ligado a {(linked.tipo ?? "saida") === "entrada" ? "entrada" : "saída"} {linked.codigo} · {linked.mercadoria?.nome} · {formatNumber(linked.quantidade)} {linked.unidade}
            <button type="button" className="ml-2 text-primary" onClick={() => link(null)}>Desligar</button>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Ainda não está ligado a um lançamento.</p>
        )}
        <input value={movQ} onChange={(e) => setMovQ(e.target.value)} placeholder="Buscar por nota, produto ou data" className="h-10 w-full rounded-xl border border-border px-3 text-sm" />
        <ul className="max-h-40 overflow-y-auto rounded-xl border border-border">
          {moves.map((s) => (
            <li key={s.id}>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => link(s.id)}>
                {(s.tipo ?? "saida") === "entrada" ? "Entrada" : "Saída"} {s.codigo || "—"} · {s.mercadoria?.nome} · {formatNumber(s.quantidade)} · {formatDateTimeBR(s.data)}
              </button>
            </li>
          ))}
          {moves.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum lançamento nesta data.</li> : null}
        </ul>
      </div>
    </>
  );
}
