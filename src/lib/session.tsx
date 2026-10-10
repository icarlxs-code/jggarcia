import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import type { Usuario } from "./types";
import { db, hydrateFromCloud } from "./store";
import { setActiveUserId } from "./ui-prefs";
import { syncTeamFromServer } from "./team-sync";
import { clearPlainUser, readPlainUser, savePlainUser } from "./plain-login";

interface SessionValue {
  perfil: Usuario | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (identificador: string, senha: string, remember?: boolean) => Promise<string | null>;
  signInUser: (user: Usuario, senha?: string, remember?: boolean) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

declare global {
  interface Window {
    __jgEntrar?: (user: Usuario) => void;
    __jgPendingUser?: Usuario | null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Usuario | null>(null);

  useLayoutEffect(() => {
    try {
      sessionStorage.removeItem("jg-session-recover");
    } catch {
      /* ignore */
    }
    window.__jgEntrar = (user) => {
      if (!user?.id) return;
      savePlainUser(user);
      try {
        db.openSession(user, undefined, true);
      } catch {
        /* a tela não pode cair se a sessão local atrasar */
      }
      setPerfil(user);
    };
    const pendente = window.__jgPendingUser || readPlainUser();
    window.__jgPendingUser = null;
    if (pendente?.id) {
      try {
        db.openSession(pendente, undefined, true);
      } catch {
        /* a tela não pode cair se a sessão local atrasar */
      }
      setPerfil(pendente);
    }
    return () => {
      delete window.__jgEntrar;
    };
  }, []);

  useLayoutEffect(() => {
    if (!perfil) return;
    try {
      setActiveUserId(perfil.id);
    } catch {
      /* tema não pode impedir a entrada */
    }
  }, [perfil?.id]);

  useEffect(() => {
    if (!perfil) return;
    const timer = window.setTimeout(() => {
      void hydrateFromCloud().then(() => syncTeamFromServer());
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [perfil?.id]);

  const signInUser = useCallback((user: Usuario, senha?: string, remember = false) => {
    const next = db.openSession(user, senha, remember);
    setPerfil(next);
  }, []);

  const signIn = useCallback((identificador: string, senha: string, remember = false) => {
    return fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ identificador: identificador.trim(), senha, remember }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { ok?: boolean; user?: Usuario; error?: string } | null;
        if (!res.ok || !data?.ok || !data.user?.id) {
          return data?.error || (res.status === 429 ? "Muitas tentativas. Espere e tente de novo." : "E-mail ou senha inválidos.");
        }
        savePlainUser(data.user);
        try {
          db.openSession(data.user, senha, remember);
        } catch {
          /* a sessão da tela já segue */
        }
        setPerfil(data.user);
        void syncTeamFromServer();
        return null;
      })
      .catch(() => "Não foi possível entrar. Tente de novo.");
  }, []);

  const signOut = useCallback(() => {
    clearPlainUser();
    try {
      db.logout();
    } catch {
      /* sair não pode travar a próxima entrada */
    }
    try {
      sessionStorage.removeItem("jg-opened");
    } catch {
      /* ignore */
    }
    setPerfil(null);
    void import("./qr-auth")
      .then(({ clearAuthSession }) => clearAuthSession({ data: {} }))
      .catch(() => undefined);
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
