import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, Smartphone, User } from "lucide-react";
import { approveQrDevice, claimQrPairing, linkQrDevice, loginThisDevice, rememberQrStation } from "@/lib/qr-auth";
import { devicePrint } from "@/lib/device-print";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/qr-acesso")({
  validateSearch: (s: Record<string, unknown>) => ({
    t: typeof s.t === "string" ? s.t : "",
    p: typeof s.p === "string" ? s.p : "",
  }),
  component: QrAcesso,
});

const DEVICE_KEY = "jg-device";

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  return "Celular";
}

function readDevice(): { deviceId: string; secret: string } | null {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(DEVICE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { deviceId?: string; secret?: string };
      if (parsed.deviceId && parsed.secret) return { deviceId: parsed.deviceId, secret: parsed.secret };
    } catch {
      /* next */
    }
  }
  try {
    const cookie = document.cookie
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("jg-qr-device=") || s.startsWith("jg-qr-dev="));
    if (cookie) {
      const value = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
      const [deviceId, secret] = value.split(".");
      if (deviceId && secret) return { deviceId, secret };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveDevice(deviceId: string, secret: string) {
  const raw = JSON.stringify({ deviceId, secret });
  try {
    localStorage.setItem(DEVICE_KEY, raw);
    sessionStorage.setItem(DEVICE_KEY, raw);
    const value = encodeURIComponent(`${deviceId}.${secret}`);
    document.cookie = `jg-qr-device=${value}; path=/; max-age=34560000; samesite=lax`;
    document.cookie = `jg-qr-dev=${value}; path=/; max-age=34560000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

function QrAcesso() {
  const { t, p } = Route.useSearch();
  const navigate = useNavigate();
  const { signInUser } = useSession();
  const ticket = useMemo(() => {
    const [id, secret] = t.split(".");
    if (!id || !secret) return null;
    return { id, secret };
  }, [t]);
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needLink, setNeedLink] = useState(true);
  const [status, setStatus] = useState("Lendo o IP deste telefone…");

  async function enterApp(user: { id: string; nome: string }, senha = "", deviceId?: string, secret?: string) {
    if (deviceId && secret) saveDevice(deviceId, secret);
    setWho(user.nome);
    setDone(true);
    signInUser(user as never, senha, true);
    try {
      const st = await rememberQrStation({ data: { userId: user.id } });
      if (st.ok) localStorage.setItem("jg-station", JSON.stringify({ id: st.id, secret: st.secret }));
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      void navigate({ to: "/" });
    }, 400);
  }

  async function unlockHere(deviceId?: string, secret?: string, quiet = false) {
    const print = devicePrint();
    if (ticket) {
      const res = await approveQrDevice({
        data: { id: ticket.id, secret: ticket.secret, deviceId, deviceSecret: secret, print },
      });
      if (res.ok) {
        await enterApp(res.user, "", res.deviceId, res.secret);
        return true;
      }
      if ("occupied" in res && res.occupied) {
        setError(res.error);
        return false;
      }
    }
    const local = await loginThisDevice({
      data: { deviceId, deviceSecret: secret, print },
    });
    if (!local.ok) {
      if (!quiet) setError("occupied" in local && local.occupied ? local.error : null);
      return false;
    }
    await enterApp(local.user, local.senha || "", local.deviceId, local.secret);
    return true;
  }

  useEffect(() => {
    let cancel = false;
    const timer = window.setTimeout(() => {
      if (cancel) return;
      setStatus("");
      setNeedLink(true);
    }, 4000);
    void (async () => {
      try {
        const saved = readDevice();
        const print = devicePrint();
        if (p) {
          const linked = await claimQrPairing({
            data: {
              token: p,
              label: deviceLabel(),
              deviceId: saved?.deviceId,
              deviceSecret: saved?.secret,
              print,
            },
          });
          if (cancel) return;
          if (!linked.ok) {
            setError(linked.error);
            setNeedLink(true);
            return;
          }
          saveDevice(linked.deviceId, linked.secret);
          const ok = await unlockHere(linked.deviceId, linked.secret, true);
          if (!cancel && !ok) setNeedLink(true);
          return;
        }
        const ok = await unlockHere(saved?.deviceId, saved?.secret, true);
        if (!cancel && !ok) {
          setNeedLink(true);
          setStatus("Este telefone ainda não está vinculado. Entre com e-mail e senha.");
        }
      } catch {
        if (!cancel) {
          setNeedLink(true);
          setStatus("");
        }
      } finally {
        window.clearTimeout(timer);
        if (!cancel) setStatus("");
      }
    })();
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
    // Reconhece uma vez ao abrir. O formulário já está na tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  async function vincular(e?: { preventDefault(): void }) {
    e?.preventDefault();
    if (!identificador.trim() || !senha) {
      setError("Na primeira vez neste celular, confirme e-mail e senha.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const linked = await linkQrDevice({
        data: { identificador: identificador.trim(), senha, label: deviceLabel(), print: devicePrint() },
      });
      if (!linked.ok) {
        setError(linked.error);
        return;
      }
      saveDevice(linked.deviceId, linked.secret);
      const ok = await unlockHere(linked.deviceId, linked.secret);
      if (!ok) {
        await enterApp(linked.user, senha, linked.deviceId, linked.secret);
      }
    } catch {
      setError("Não foi possível vincular. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate-screen">
      <div className="gate-card">
        <img src="/logo.png" alt="JG Garcia" className="login-logo" />
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            {done ? "Acesso liberado" : "Entrar"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {status || (ticket ? "Confirme a conta para liberar o acesso." : "O IP deste telefone é lido ao abrir a página.")}
          </p>
        </div>

        {done ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 font-medium">Acesso liberado{who ? ` para ${who}` : ""}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {ticket ? "Liberando o computador…" : "Abrindo o sistema neste telefone…"}
            </p>
          </div>
        ) : needLink ? (
          <form
            method="post"
            action="#"
            onSubmit={(e) => {
              e.preventDefault();
              void vincular(e);
            }}
            className="login-auth-form"
          >
            {error ? (
              <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="qr-email">E-mail</Label>
              <div className="login-zoom relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="qr-email"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  className="pl-10"
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="e-mail da equipe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-senha">Senha</Label>
              <div className="login-zoom relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="qr-senha"
                  type={show ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="pl-10 pr-11"
                  autoComplete="current-password"
                  placeholder="senha"
                />
                <button
                  type="button"
                  className="login-eye absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="button"
              className="login-submit h-11 w-full active:scale-100"
              disabled={busy}
              onClick={() => void vincular()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              {busy ? "Confirmando" : "Entrar"}
            </Button>
          </form>
        ) : (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Reconhecendo este telefone…
          </div>
        )}
      </div>
    </div>
  );
}
