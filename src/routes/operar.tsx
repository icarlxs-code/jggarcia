import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/lib/store";
import { useDb } from "@/lib/use-db";
import { fold } from "@/lib/utils";
import { formatNumber, todayISO } from "@/lib/format";
import { pavTitle } from "@/lib/catalog";
import { notify } from "@/lib/notify";
import { clearDeviceToken, formatDurationText, formatElapsed, randomToken, readDeviceToken, saveDeviceToken } from "@/lib/forklift-device";
import type { ForkliftJob, Mercadoria, Pavilhao } from "@/lib/types";

export const Route = createFileRoute("/operar")({
  validateSearch: (s: Record<string, unknown>): { vincular?: string } => ({
    vincular: typeof s.vincular === "string" ? s.vincular : undefined,
  }),
  component: OperarPage,
});

const CANCEL_MOTIVOS = ["Carga incorreta", "Quantidade incorreta", "Destino incorreto", "Serviço cancelado", "Outro"];

function OperarPage() {
  const { vincular } = Route.useSearch();
  const live = useDb();
  const [token, setToken] = useState<string | null>(null);
  const [code, setCode] = useState(vincular || "");
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [step, setStep] = useState<"form" | "foto" | "feito">("form");
  const [busca, setBusca] = useState("");
  const [merc, setMerc] = useState<Mercadoria | null>(null);
  const [qtd, setQtd] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [gps, setGps] = useState<"off" | "on" | "negado">("off");
  const [lastFix, setLastFix] = useState<string | null>(null);
  const [done, setDone] = useState<ForkliftJob | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivo, setMotivo] = useState(CANCEL_MOTIVOS[0]);
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);

  const claimed = useRef(false);

  useEffect(() => {
    setToken(readDeviceToken());
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prev = link?.href;
    if (link) link.href = "/empilhador.webmanifest";
    return () => {
      if (link && prev) link.href = prev;
    };
  }, []);

  useEffect(() => {
    if (!vincular || claimed.current || readDeviceToken()) return;
    claimed.current = true;
    const tokenNovo = randomToken();
    try {
      db.claimForkliftDevice(vincular, tokenNovo, navigator.userAgent.slice(0, 60));
      saveDeviceToken(tokenNovo);
      setToken(tokenNovo);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Código inválido.");
    }
  }, [vincular]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void import("@/lib/store").then((m) => m.hydrateFromCloud());
    };
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, []);

  const session = token ? live.forkliftSession(token) : null;
  const job = session?.job ?? null;
  const lugares = live.listPavilhoes();
  const produtos = live.listMercadorias(true);

  const sugestoes = useMemo(() => {
    const term = fold(busca.trim());
    if (!term || merc) return [];
    return produtos
      .filter((m) => fold(m.nome).includes(term) || fold(m.codigo).includes(term) || fold(m.codigo).replace(/^0+/, "").includes(term.replace(/^0+/, "")))
      .slice(0, 8);
  }, [busca, merc, produtos]);

  useEffect(() => {
    if (!token || !job) {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
      setGps("off");
      return;
    }
    if (!navigator.geolocation) {
      setGps("negado");
      return;
    }
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGps("on");
        const at = new Date(pos.timestamp).toISOString();
        setLastFix(at);
        if (Date.now() - lastSent.current < 8000) return;
        lastSent.current = Date.now();
        try {
          db.addForkliftLocation(token, job.id, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            captured_at: at,
          });
        } catch {
          /* sem rede o lançamento local continua */
        }
      },
      () => setGps("negado"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
    );
    return () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    };
  }, [token, job?.id]);

  async function vincularCelular() {
    const tokenNovo = randomToken();
    try {
      const op = db.claimForkliftDevice(code, tokenNovo, navigator.userAgent.slice(0, 60));
      saveDeviceToken(tokenNovo);
      setToken(tokenNovo);
      notify.success(`Celular vinculado. Olá, ${op.nome}.`);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível vincular.");
    }
  }

  function iniciar() {
    if (!token || !merc) return;
    const n = Number(String(qtd).replace(",", "."));
    try {
      db.startForkliftJob(token, { id: crypto.randomUUID(), productId: merc.id, quantity: n, originId: origem, destinationId: destino });
      setStep("form");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível iniciar.");
    }
  }

  async function onPhoto(file: File) {
    if (!token || !job) return;
    const photo = await compressPhoto(file);
    try {
      db.setForkliftPhoto(token, job.id, photo);
      notify.success("Foto registrada.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível enviar a foto.");
    }
  }

  function encerrar() {
    if (!token || !job) return;
    try {
      const row = db.finishForkliftJob(token, job.id);
      setDone(row);
      setStep("feito");
      setMerc(null);
      setQtd("");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível encerrar.");
    }
  }

  function cancelar() {
    if (!token || !job) return;
    try {
      db.cancelForkliftJob(token, job.id, motivo);
      setCancelOpen(false);
      setStep("form");
      notify.success("Cancelamento registrado.");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Não foi possível cancelar.");
    }
  }

  if (!token || !session) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 bg-background px-5 py-10 text-foreground">
        <h1 className="page-title">Vincular celular</h1>
        <p className="text-sm text-muted-foreground">Peça o código na administração. Este aparelho fica só com a sua conta.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="000000"
          aria-label="Código de 6 dígitos"
          maxLength={6}
          className="field-glow h-16 rounded-2xl border border-border bg-card text-center font-mono text-3xl font-semibold tracking-[0.4em] placeholder:text-muted-foreground/40"
        />
        <button type="button" onClick={() => void vincularCelular()} className="jg-btn bg-primary h-14 rounded-2xl text-lg font-semibold text-primary-foreground">
          Vincular este celular
        </button>
      </main>
    );
  }

  const nome = session.operator.nome;

  if (step === "feito" && done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
        <div className="rounded-3xl border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">{done.origin_nome}</p>
          <p className="my-3 text-3xl">✓</p>
          <p className="text-sm font-medium text-muted-foreground">{done.destination_nome}</p>
          <h1 className="mt-4 text-2xl font-semibold">Transporte concluído</h1>
          <p className="mt-3 text-lg">{done.product_nome}</p>
          <p className="text-muted-foreground">
            {formatNumber(done.quantity)} {done.unit}
          </p>
          <p className="mt-2 text-sm">Tempo total: {done.finished_at ? formatDurationText(done.started_at, done.finished_at) : "—"}</p>
        </div>
        <button type="button" onClick={() => { setDone(null); setStep("form"); }} className="h-14 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
          Novo transporte
        </button>
      </main>
    );
  }

  if (job) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 py-8">
        {!online ? <p className="rounded-xl bg-amber-100 px-3 py-2 text-center text-sm font-medium text-amber-950">Sem conexão. Tentando reconectar...</p> : null}
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Transporte em andamento</p>
        <h1 className="text-3xl font-semibold">{nome}</h1>
        <section className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xl font-semibold">{job.product_nome}</p>
          <p className="mt-1 text-lg tabular-nums">
            {formatNumber(job.quantity)} {job.unit}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">{job.origin_nome}</p>
          <p className="text-center text-lg">↓</p>
          <p className="text-sm font-medium">{job.destination_nome}</p>
          <p className="mt-6 text-center font-mono text-5xl font-semibold tabular-nums">{formatElapsed(job.started_at, now)}</p>
        </section>
        <p className="text-sm">
          <span className={gps === "on" ? "text-primary" : "text-amber-700"}>● {gps === "on" ? "Localização ativa" : gps === "negado" ? "Localização negada" : "Aguardando localização"}</span>
          {lastFix ? <span className="mt-1 block text-muted-foreground">Última atualização: {new Date(lastFix).toLocaleTimeString("pt-BR")}</span> : null}
          <span className="mt-1 block text-xs text-muted-foreground">A localização só funciona durante este transporte.</span>
        </p>
        {step === "foto" ? (
          <div className="space-y-3">
            <p className="text-lg font-medium">Tire uma foto do último transporte.</p>
            {job.photo ? <p className="text-sm font-medium text-primary">Foto registrada</p> : null}
            <label className="flex h-14 cursor-pointer items-center justify-center rounded-2xl border border-border bg-card text-lg font-semibold">
              Abrir câmera
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPhoto(f); }} />
            </label>
            <button type="button" disabled={!job.photo} onClick={encerrar} className="h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-primary-foreground disabled:opacity-40">
              Encerrar serviço
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setStep("foto")} className="h-14 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
            Finalizar transporte
          </button>
        )}
        <button type="button" onClick={() => setCancelOpen(true)} className="h-12 rounded-2xl border border-border text-sm">
          Solicitar cancelamento
        </button>
        {cancelOpen ? (
          <div className="space-y-2 rounded-2xl border border-border p-3">
            {CANCEL_MOTIVOS.map((m) => (
              <button key={m} type="button" onClick={() => setMotivo(m)} className={`block h-11 w-full rounded-xl border px-3 text-left ${motivo === m ? "border-primary bg-primary/10" : "border-border"}`}>
                {m}
              </button>
            ))}
            <button type="button" onClick={cancelar} className="h-12 w-full rounded-xl bg-foreground text-background">
              Confirmar cancelamento
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  const n = Number(String(qtd).replace(",", "."));
  const pronto = !!merc && n > 0 && origem && destino && origem !== destino;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 py-8">
      {!online ? <p className="rounded-xl bg-amber-100 px-3 py-2 text-center text-sm font-medium text-amber-950">Sem conexão. Tentando reconectar...</p> : null}
      <div>
        <p className="text-sm text-muted-foreground">Olá, {nome}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Pronto para iniciar um transporte?</h1>
      </div>
      <label className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produto</span>
        <input
          value={merc ? `${merc.codigo} · ${merc.nome}` : busca}
          onChange={(e) => { setBusca(e.target.value); setMerc(null); }}
          placeholder="Digite o produto ou código"
          className="h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg"
        />
      </label>
      {sugestoes.length > 0 ? (
        <ul className="overflow-hidden rounded-2xl border border-border bg-card">
          {sugestoes.map((m) => (
            <li key={m.id}>
              <button type="button" className="block w-full px-4 py-3 text-left" onClick={() => { setMerc(m); setBusca(""); }}>
                <span className="block font-medium">{m.nome}</span>
                <span className="text-xs text-muted-foreground">{m.codigo}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantidade</span>
        <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" placeholder="0" className="h-20 w-full rounded-2xl border border-border bg-card text-center text-4xl font-semibold tabular-nums" />
        {merc ? <p className="text-center text-sm text-muted-foreground">{merc.unidade}</p> : null}
      </label>
      <PlacePick label="Retirar de" value={origem} places={lugares} onChange={setOrigem} />
      <PlacePick label="Levar para" value={destino} places={lugares} onChange={setDestino} />
      {origem && destino && origem === destino ? <p className="text-sm text-destructive">A origem e o destino precisam ser diferentes.</p> : null}
      {pronto && merc ? (
        <section className="rounded-3xl border border-border bg-card p-5 text-center">
          <p className="text-lg font-semibold">{merc.nome}</p>
          <p className="tabular-nums">{formatNumber(n)} {merc.unidade}</p>
          <p className="mt-3 text-sm">{lugares.find((p) => p.id === origem) ? pavTitle(lugares.find((p) => p.id === origem)!) : ""}</p>
          <p>↓</p>
          <p className="text-sm">{lugares.find((p) => p.id === destino) ? pavTitle(lugares.find((p) => p.id === destino)!) : ""}</p>
          <p className="mt-2 text-xs text-muted-foreground">Empilhador: {nome}</p>
        </section>
      ) : null}
      <button type="button" disabled={!pronto} onClick={iniciar} className="h-16 rounded-2xl bg-primary text-xl font-semibold text-primary-foreground disabled:opacity-40">
        Iniciar transporte
      </button>
      <button type="button" className="text-xs text-muted-foreground" onClick={() => { clearDeviceToken(); setToken(null); }}>
        Sair deste celular
      </button>
      <p className="sr-only">{todayISO()}</p>
    </main>
  );
}

function PlacePick({ label, value, places, onChange }: { label: string; value: string; places: Pavilhao[]; onChange: (id: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-14 w-full rounded-2xl border border-border bg-card px-4 text-lg">
        <option value="">Escolher</option>
        {places.map((p) => (
          <option key={p.id} value={p.id}>
            {pavTitle(p)}
          </option>
        ))}
      </select>
    </label>
  );
}

async function compressPhoto(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Foto inválida"));
      img.src = url;
    });
    const max = 720;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.62);
  } finally {
    URL.revokeObjectURL(url);
  }
}
