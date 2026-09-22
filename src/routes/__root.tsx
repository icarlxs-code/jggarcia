import { useEffect, useRef, useState } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { SessionProvider, useSession } from "@/lib/session";
import { LoginScreen } from "@/components/login-screen";
import { AppShell } from "@/components/layout/app-shell";
import { BrandIntro } from "@/components/motion/brand-intro";
import { Toaster } from "@/components/ui/sonner";
import { useViewport } from "@/lib/use-viewport";
import appCss from "../styles.css?url";

const APP_NAME = "JG Garcia";
const SPLIT_MS = 1800;

let introDone = false;

function Gate() {
  const { perfil } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const phone = useViewport() === "phone";
  const [intro, setIntro] = useState(() => !introDone);
  const [reveal, setReveal] = useState(() => introDone);

  const [opening, setOpening] = useState(false);
  const sawLogin = useRef(false);

  useEffect(() => {
    if (!perfil) {
      sawLogin.current = true;
      setOpening(false);
      return;
    }
    if (!sawLogin.current) {
      setOpening(false);
      return;
    }
    setOpening(true);
    const t = window.setTimeout(() => setOpening(false), SPLIT_MS);
    return () => window.clearTimeout(t);
  }, [perfil]);

  useEffect(() => {
    if (perfil) return;
    if (pathname.startsWith("/qr-acesso") || pathname === "/") return;
    try {
      window.history.replaceState(null, "", "/");
    } catch {
      /* ignore */
    }
  }, [perfil, pathname]);

  useEffect(() => {
    if (!phone || introDone) return;
    introDone = true;
    setIntro(false);
    setReveal(true);
  }, [phone]);

  function startReveal() {
    setReveal(true);
  }

  function endIntro() {
    introDone = true;
    setIntro(false);
    setReveal(true);
  }

  if (pathname.startsWith("/qr-acesso")) return <Outlet />;
  if (perfil) {
    return (
      <>
        <div className={opening ? "split-stage" : undefined}>
          <AppShell />
        </div>
        {opening ? (
          <div className="split-overlay" aria-hidden>
            <LoginScreen mediaActive={false} entering={false} leaving />
          </div>
        ) : null}
      </>
    );
  }
  return (
    <>
      <LoginScreen mediaActive={reveal && !phone} entering={reveal} />
      {intro ? <BrandIntro onFadeStart={startReveal} onDone={endIntro} /> : null}
    </>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#f6f4f4" },
      { name: "description", content: "Estoque, entradas, lotes e expedição da JG Garcia no CEASA RJ." },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;1,14..32,400&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('jg-theme-v2')==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark'}else{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light'}var m=localStorage.getItem('jg-viewport');var phone=false;if(m==='phone')phone=true;else if(m==='computer')phone=false;else phone=/Android|iPhone|iPod|iPad|Mobile|webOS|BlackBerry/i.test(navigator.userAgent)||window.innerWidth<768;document.documentElement.classList.toggle('is-phone',phone);document.documentElement.classList.toggle('is-computer',!phone);document.documentElement.dataset.viewport=phone?'phone':'computer'}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <SessionProvider>
            <Gate />
            <Toaster />
          </SessionProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
