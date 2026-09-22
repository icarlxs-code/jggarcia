import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import type { Usuario } from "./types";
import { db, hydrateFromCloud } from "./store";
import { authenticateRemote, clearAuthSession, importRemoteUsers, listTeamLogin, releasePhoneSeat } from "./qr-auth";
import { devicePrint, readLocalDevice } from "./device-print";

interface SessionValue {
  perfil: Usuario | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (identificador: string, senha: string, remember?: boolean) => Promise<string | null>;
  signInUser: (user: Usuario, senha?: string, remember?: boolean) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export async function syncTeamFromServer() {
  try {
    const remote = await listTeamLogin({ data: {} });
    db.applyDeleted(remote.apagados ?? []);
    for (const user of remote.users ?? []) db.acceptRemoteUser(user);
  } catch {
    /* offline */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Usuario | null>(null);

  useLayoutEffect(() => {
    setPerfil(db.getSessionUser());
  }, []);

  useEffect(() => {
    void (async () => {
      await hydrateFromCloud();
    })();
  }, []);

  useEffect(() => {
    if (!perfil) return;
    void (async () => {
      await syncTeamFromServer();
      if (perfil.nivel_acesso !== "admin") return;
      const users = db.exportUsers().map((u) => ({ user: u, senha: u.senha }));
      void importRemoteUsers({ data: { users } }).catch(() => undefined);
    })();
  }, [perfil]);

  const signInUser = useCallback((user: Usuario, senha?: string, remember = false) => {
    const next = db.openSession(user, senha, remember);
    setPerfil(next);
  }, []);

  const signIn = useCallback(
    async (identificador: string, senha: string, remember = false) => {
      const saved = readLocalDevice();
      try {
        const remote = await authenticateRemote({
          data: {
            identificador,
            senha,
            print: devicePrint(),
            deviceId: saved.deviceId,
            deviceSecret: saved.deviceSecret,
            rememberDevice: remember,
          },
        });
        if (remote.ok) {
          if ("deviceId" in remote && remote.deviceId && remote.secret) {
            try {
              localStorage.setItem("jg-device", JSON.stringify({ deviceId: remote.deviceId, secret: remote.secret }));
            } catch {
              /* ignore */
            }
          }
          if (remember) db.saveRemember(identificador, senha);
          else db.clearRemember();
          signInUser(remote.user, remote.senha, remember);
          const meta = "meta" in remote ? remote.meta : null;
          const ip = "ip" in remote ? String(remote.ip || "") : "";
          db.recordAccess({
            usuario_id: remote.user.id,
            acao: "freshDevice" in remote && remote.freshDevice ? "reconheceu" : "login",
            resumo:
              "freshDevice" in remote && remote.freshDevice
                ? `${remote.user.nome} — Novo dispositivo reconhecido — ${meta?.os ?? ""} / ${meta?.browser ?? ""}`
                : `${remote.user.nome} — Login realizado — ${meta?.browser ?? "Navegador"} / ${meta?.os ?? ""} — IP ${ip || "—"}`,
            detalhe: [meta?.deviceKind, ip].filter(Boolean).join(" · "),
          });
          return null;
        }
        try {
          const user = db.login(identificador, senha, remember);
          if (remember) db.saveRemember(identificador, senha);
          else db.clearRemember();
          setPerfil(user);
          void importRemoteUsers({
            data: { users: db.exportUsers().map((u) => ({ user: u, senha: u.senha })) },
          }).catch(() => undefined);
          return null;
        } catch {
          return remote.error;
        }
      } catch {
        try {
          const user = db.login(identificador, senha, remember);
          if (remember) db.saveRemember(identificador, senha);
          else db.clearRemember();
          setPerfil(user);
          return null;
        } catch (localErr) {
          return localErr instanceof Error ? localErr.message : "Falha ao entrar.";
        }
      }
    },
    [signInUser],
  );

  const signOut = useCallback(() => {
    try {
      const raw = localStorage.getItem("jg-device");
      const parsed = raw ? (JSON.parse(raw) as { deviceId?: string; secret?: string }) : null;
      void releasePhoneSeat({ data: { deviceId: parsed?.deviceId, deviceSecret: parsed?.secret } }).catch(() => undefined);
    } catch {
      void releasePhoneSeat({ data: {} }).catch(() => undefined);
    }
    void clearAuthSession({ data: {} }).catch(() => undefined);
    db.logout();
    try {
      sessionStorage.removeItem("jg-opened");
    } catch {
      /* ignore */
    }
    setPerfil(null);
    try {
      window.location.replace("/");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      perfil,
      isAdmin: perfil?.nivel_acesso === "admin" && !!perfil.status,
      loading: false,
      signIn,
      signInUser,
      signOut,
    }),
    [perfil, signIn, signInUser, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession precisa estar dentro do SessionProvider");
  return ctx;
}
