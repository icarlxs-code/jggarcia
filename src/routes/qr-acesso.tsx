import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  const [busy, setBusy] = useState(true);
  const [done, setDone] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needLink, setNeedLink] = useState(false);
  const once = useRef(false);

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

  async function askLogin() {
    setNeedLink(true);
  }

  async function unlockHere(deviceId?: string, secret?: string) {
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
      setError("occupied" in local && local.occupied ? local.error : null);
      return false;
    }
    await enterApp(local.user, local.senha, local.deviceId, local.secret);
    return true;
  }

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    void (async () => {
      try {
        const saved = readDevice();
        if (p) {
          const linked = await claimQrPairing({
            data: {
              token: p,
              label: deviceLabel(),
              deviceId: saved?.deviceId,
              deviceSecret: saved?.secret,
              print: devicePrint(),
            },
          });
          if (!linked.ok) {
            setError(linked.error);
            await askLogin();
            return;
          }
          saveDevice(linked.deviceId, linked.secret);
          const ok = await unlockHere(linked.deviceId, linked.secret);
          if (!ok) await askLogin();
          return;
        }
        const ok = await unlockHere(saved?.deviceId, saved?.secret);
        if (!ok) await askLogin();
      } catch {
        setError("Não foi possível falar com o sistema. Tente de novo.");
        await askLogin();
      } finally {
        setBusy(false);
      }
    })();
  }, [p, ticket]);

  async function vincular(e: FormEvent) {
    e.preventDefault();
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
    <div className="flex min-h-dvh items-center justify-center bg-[#fcfcfc] px-5 py-10">
      <div className="w-full max-w-sm space-y-5">
        <img src="/logo.png" alt="JG Garcia" className="mx-auto h-16 w-auto object-contain" />
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            {done ? "Acesso liberado" : needLink ? "Primeiro acesso" : "Reconhecendo dispositivo"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {needLink
              ? "Este telefone ainda não está reconhecido. Entre com o e-mail e a senha cadastrados pelo administrador. O IP fica gravado neste aparelho."
              : ticket
                ? "Reconhecendo o telefone para liberar o computador…"
                : "Reconhecendo este aparelho…"}
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
          <form onSubmit={vincular} className="space-y-4">
            {error ? (
              <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="qr-email">E-mail</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="qr-email"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  className="pl-10"
                  autoComplete="username"
                  autoCapitalize="none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-senha">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="qr-senha"
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
            <Button type="submit" className="h-11 w-full active:scale-100" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Vinculando" : "Vincular este celular"}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" /> O IP do aparelho fica gravado na ficha
            </p>
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
