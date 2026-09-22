import { type FormEvent, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, QrCode, RefreshCw, Smartphone, User } from "lucide-react";
import QRCode from "qrcode";
import { useSession } from "@/lib/session";
import { db } from "@/lib/store";
import { pollQrLogin, rememberQrStation, startQrLogin, loginThisDevice, linkQrDevice, probeLoginAccess, forgetThisDevice } from "@/lib/qr-auth";
import { devicePrint, readLocalDevice } from "@/lib/device-print";
import { deviceLabelFromUa } from "@/lib/device-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { ViewportToggle } from "@/components/viewport-toggle";
import { useViewport } from "@/lib/use-viewport";
import { cn } from "@/lib/utils";

export function LoginScreen({
  mediaActive = true,
  entering = false,
  leaving = false,
}: {
  mediaActive?: boolean;
  entering?: boolean;
  leaving?: boolean;
}) {
  const { signIn } = useSession();
  const [mode, setMode] = useState<"senha" | "qr">("senha");
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [probe, setProbe] = useState<{
    ip: string;
    os: string;
    browser: string;
    deviceKind: string;
    known: boolean;
    knownUser: string;
    knownLabel: string;
  } | null>(null);

  useEffect(() => {
    const saved = db.loadRemember();
    if (!saved) return;
    setIdentificador(saved.identificador);
    setSenha(saved.senha);
    setRemember(true);
  }, []);

  useEffect(() => {
    const saved = readLocalDevice();
    void probeLoginAccess({ data: { print: devicePrint(), deviceId: saved.deviceId, deviceSecret: saved.deviceSecret } })
      .then((info) => {
        setProbe({
          ip: info.ip,
          os: info.os,
          browser: info.browser,
          deviceKind: info.deviceKind,
          known: info.known,
          knownUser: "knownUser" in info ? String(info.knownUser || "") : "",
          knownLabel: "knownLabel" in info ? String(info.knownLabel || "") : "",
        });
      })
      .catch(() => undefined);
  }, []);

  async function entrar(e?: FormEvent) {
    e?.preventDefault();
    if (submitting) return;
    if (!identificador.trim() || !senha) {
      setError("Informe e-mail e senha.");
      setShake((n) => n + 1);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const err = await signIn(identificador.trim(), senha, remember);
      if (err) {
        setError(err);
        setShake((n) => n + 1);
      }
    } catch {
      setError("Não foi possível entrar. Tente de novo.");
      setShake((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cn("login-shell", entering && "is-entering", leaving && "is-leaving")}>
      <aside className="login-panel" aria-hidden>
        <div className="login-panel-media">
          {mediaActive ? (
            <video
              className="login-video"
              src="/login-video.mp4?v=17"
              poster="/login-poster.jpg?v=17"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            <img src="/login-poster.jpg?v=17" alt="" className="login-video" />
          )}
        </div>
      </aside>

      <main className="login-form-wrap">
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <ViewportToggle compact />
          <ThemeToggle />
        </div>
        <div className="login-neo w-full max-w-sm space-y-5">
          <img src="/logo.png" alt="JG Garcia" className="mx-auto h-16 w-auto object-contain" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Acesso da equipe JG Garcia.</p>
            {probe ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Este computador: {probe.browser} · {probe.os}
                {probe.deviceKind === "phone" ? " · celular" : probe.deviceKind === "tablet" ? " · tablet" : ""}
                {probe.ip && probe.ip !== "desconhecido" ? ` · IP ${probe.ip}` : ""}
                {probe.known && probe.knownUser
                  ? ` · reconhecido neste navegador como ${probe.knownUser}`
                  : " · dispositivo ainda não reconhecido"}
              </p>
            ) : null}
          </div>

          <div className={cn("login-mode-tabs", mode === "qr" && "is-qr")}>
            <span className="login-mode-pill" aria-hidden />
            <button
              type="button"
              className={cn(mode !== "qr" && "is-on")}
              onClick={() => setMode("senha")}
            >
              Senha
            </button>
            <button
              type="button"
              className={cn(mode === "qr" && "is-on")}
              onClick={() => setMode("qr")}
            >
              <span className="login-qr-desktop">QR Code</span>
              <span className="login-qr-phone">Dispositivo</span>
            </button>
          </div>

          <div className="login-mode-stage">
            <div className={cn("login-mode-track", mode === "qr" && "is-qr")}>
              <div className="login-mode-pane" inert={mode === "qr" ? true : undefined} aria-hidden={mode === "qr"}>
                <form onSubmit={entrar} className={cn("space-y-5", shake ? "form-shake" : "")} autoComplete={remember ? "on" : "off"}>
                  {error ? (
                    <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="login-id">E-mail</Label>
                    <div className="login-zoom relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-id"
                        value={identificador}
                        onChange={(e) => setIdentificador(e.target.value)}
                        className="field-glow pl-10"
                        autoComplete="username"
                        placeholder="e-mail da equipe"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-senha">Senha</Label>
                    <div className="login-zoom relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-senha"
                        type={show ? "text" : "password"}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        className="field-glow pl-10 pr-11"
                        autoComplete={remember ? "current-password" : "off"}
                        placeholder="senha"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShow((v) => !v)}
                        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Lembrar senha neste aparelho
                  </label>

                  <Button type="submit" className="h-11 w-full active:scale-100" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {submitting ? "Entrando" : "Entrar"}
                  </Button>
                </form>
              </div>
              <div className="login-mode-pane" inert={mode !== "qr" ? true : undefined} aria-hidden={mode !== "qr"}>
                <QrLoginPanel remember={remember} active={mode === "qr"} probe={probe} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function QrLoginPanel({
  remember,
  active,
  probe,
}: {
  remember: boolean;
  active: boolean;
  probe: { known: boolean; knownUser: string; knownLabel: string; ip: string; os: string; browser: string } | null;
}) {
  const { signInUser } = useSession();
  const phone = useViewport() === "phone";
  const [img, setImg] = useState<string | null>(null);
  const [left, setLeft] = useState(300);
  const [status, setStatus] = useState("Aguardando a leitura do QR…");
  const [err, setErr] = useState<string | null>(null);
  const [busyStation, setBusyStation] = useState(false);
  const [firstAccess, setFirstAccess] = useState(false);
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [show, setShow] = useState(false);
  const ticket = useRef<{ id: string; secret: string; expiresAt: number } | null>(null);
  const misses = useRef(0);

  function saveLocalDevice(deviceId: string, secret: string) {
    try {
      localStorage.setItem("jg-device", JSON.stringify({ deviceId, secret }));
      sessionStorage.setItem("jg-device", JSON.stringify({ deviceId, secret }));
    } catch {
      /* ignore */
    }
  }

  function forgetLocalDevice() {
    try {
      localStorage.removeItem("jg-device");
      sessionStorage.removeItem("jg-device");
    } catch {
      /* ignore */
    }
    void forgetThisDevice({ data: {} }).catch(() => undefined);
  }

  async function persistStation(userId: string) {
    try {
      const st = await rememberQrStation({ data: { userId } });
      if (st.ok) localStorage.setItem("jg-station", JSON.stringify({ id: st.id, secret: st.secret }));
    } catch {
      /* ignore */
    }
  }

  function deviceLabel() {
    return deviceLabelFromUa(navigator.userAgent);
  }

  async function enterThisPhone() {
    setBusyStation(true);
    setErr(null);
    try {
      const saved = readLocalDevice();
      const res = await loginThisDevice({
        data: { ...saved, print: devicePrint() },
      });
      if (!res.ok) {
        setFirstAccess(true);
        return;
      }
      saveLocalDevice(res.deviceId, res.secret);
      void persistStation(res.user.id);
      db.recordAccess({
        usuario_id: res.user.id,
        acao: "login",
        resumo: `${res.user.nome} — Login realizado — ${probe?.browser || "Navegador"} / ${probe?.os || ""} — IP ${res.ip || "—"}`,
        detalhe: deviceLabel(),
      });
      signInUser(res.user, res.senha, remember);
    } catch {
      setFirstAccess(true);
    } finally {
      setBusyStation(false);
    }
  }

  async function concluirPrimeiroAcesso(e: FormEvent) {
    e.preventDefault();
    if (!identificador.trim() || !senha) {
      setErr("Informe o e-mail e a senha cadastrados pelo administrador.");
      return;
    }
    setBusyStation(true);
    setErr(null);
    try {
      const linked = await linkQrDevice({
        data: { identificador: identificador.trim(), senha, label: deviceLabel(), print: devicePrint() },
      });
      if (!linked.ok) {
        setErr(linked.error);
        return;
      }
      if (linked.deviceId && linked.secret) saveLocalDevice(linked.deviceId, linked.secret);
      void persistStation(linked.user.id);
      db.recordAccess({
        usuario_id: linked.user.id,
        acao: "reconheceu",
        resumo: `${linked.user.nome} — Novo dispositivo reconhecido — ${probe?.os || ""} / ${probe?.browser || ""}`,
        detalhe: linked.ip ? `IP ${linked.ip} · ${deviceLabel()}` : deviceLabel(),
      });
      signInUser(linked.user, senha, remember);
    } catch {
      setErr("Não foi possível concluir o primeiro acesso.");
    } finally {
      setBusyStation(false);
    }
  }

  async function issue() {
    try {
      setErr(null);
      const t = await startQrLogin({ data: {} });
      ticket.current = { id: t.id, secret: t.secret, expiresAt: t.expiresAt };
      const href = `${window.location.origin}/qr-acesso?t=${t.id}.${t.secret}`;
      setLeft(Math.max(1, Math.round((t.expiresAt - Date.now()) / 1000)));
      setStatus("Aponte a câmera do celular. A leitura libera este computador.");
      misses.current = 0;
      setImg(await QRCode.toDataURL(href, { width: 240, margin: 1, color: { dark: "#0c241b", light: "#fcfcfc" } }));
    } catch {
      setErr("Não foi possível gerar o QR. Toque em Novo QR para tentar de novo.");
      setImg(null);
    }
  }

  useEffect(() => {
    if (phone || !active) return;
    void issue();
    const timer = window.setInterval(() => {
      const cur = ticket.current;
      if (!cur) return;
      const s = Math.round((cur.expiresAt - Date.now()) / 1000);
      if (s <= 0) {
        void issue();
        return;
      }
      setLeft(s);
    }, 1000);
    const poll = window.setInterval(async () => {
      const cur = ticket.current;
      if (!cur) return;
      try {
        const res = await pollQrLogin({ data: { id: cur.id, secret: cur.secret } });
        if (res.status === "approved") {
          setStatus("QR lido. Entrando…");
          void persistStation(res.user.id);
          signInUser(res.user, res.senha, remember);
          return;
        }
        if (res.status === "expired") {
          void issue();
          return;
        }
        if (res.status === "missing") {
          misses.current += 1;
          if (misses.current >= 4) void issue();
        } else {
          misses.current = 0;
        }
      } catch {
        /* next poll */
      }
    }, 900);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(poll);
    };
  }, [phone, remember, signInUser, active]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  if (phone) {
    if (firstAccess) {
      return (
        <form onSubmit={concluirPrimeiroAcesso} className="space-y-4">
          {err ? (
            <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
              {err}
            </div>
          ) : null}
          <div>
            <h3 className="text-base font-semibold">Primeiro acesso</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Este navegador ainda não tem um token de acesso. Entre com o e-mail e a senha que o administrador cadastrou. O reconhecimento fica só neste aparelho — o IP entra só no histórico de segurança e nunca escolhe a conta.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-email">E-mail</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="dev-email"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                className="pl-10"
                autoComplete="username"
                autoCapitalize="none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-senha">Senha</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="dev-senha"
                type={show ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="pl-10 pr-11"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="h-11 w-full active:scale-100" disabled={busyStation}>
            {busyStation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busyStation ? "Salvando" : "Concluir primeiro acesso"}
          </Button>
        </form>
      );
    }

    return (
      <div className="space-y-4">
        {err ? (
          <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
            {err}
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {probe?.known && probe.knownUser
            ? `Este navegador já foi reconhecido como ${probe.knownUser}${probe.knownLabel ? ` (${probe.knownLabel})` : ""}. Só entra nesta conta — o IP da rede não escolhe ninguém.`
            : "Reconhece apenas este navegador, com o token gravado aqui. Nunca entra na conta de outra pessoa pelo IP da rede."}
        </p>
        <Button type="button" className="h-11 w-full active:scale-100" onClick={() => void enterThisPhone()} disabled={busyStation}>
          {busyStation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
          {busyStation
            ? "Reconhecendo"
            : probe?.known && probe.knownUser
              ? `Entrar como ${probe.knownUser}`
              : "Reconhecer este dispositivo"}
        </Button>
        {probe?.known && probe.knownUser ? (
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              forgetLocalDevice();
              setFirstAccess(true);
              setErr(null);
            }}
          >
            Não sou {probe.knownUser.split(" ")[0]} — entrar com outra conta
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {err ? (
        <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
          {err}
        </div>
      ) : null}
      <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-4">
        {img ? <img src={img} alt="QR Code para entrar" className="h-52 w-52 rounded-lg" /> : <Loader2 className="h-8 w-8 animate-spin text-primary" />}
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <QrCode className="h-4 w-4" /> {status}
        </p>
        <p className="mt-1 tabular text-xs text-muted-foreground">Expira em {mm}:{ss}</p>
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={() => void issue()}>
        <RefreshCw /> Novo QR
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        O celular que ler este QR entra com a conta daquele telefone e libera este computador.
      </p>
    </div>
  );
}