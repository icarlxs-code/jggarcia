import { Component, useEffect, type ReactNode } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { SessionProvider, useSession } from "@/lib/session";
import { LoginScreen } from "@/components/login-screen";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { toggleUserTheme } from "@/lib/ui-prefs";
import appCss from "../styles.css?url";

const APP_NAME = "JG Garcia";
const BUILD_ID = (import.meta.env as { VITE_BUILD_ID?: string }).VITE_BUILD_ID || "dev";

function NightModeHotkey() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key !== "ArrowDown") return;
      e.preventDefault();
      toggleUserTheme();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

function Gate() {
  const { perfil } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname.startsWith("/qr-acesso") || pathname.startsWith("/operar")) return <Outlet />;
  if (!perfil) return <LoginScreen />;
  return (
    <PanelBoundary>
      <AppShell />
    </PanelBoundary>
  );
}

class PanelBoundary extends Component<{ children: ReactNode }, { erro: string }> {
  state = { erro: "" };

  static getDerivedStateFromError(error: unknown) {
    return { erro: error instanceof Error ? error.message : "Falha ao abrir o painel." };
  }

  render() {
    if (this.state.erro) {
      return (
        <main className="login-plain">
          <section className="login-form">
            <h2>Não abriu</h2>
            <p className="login-plain-erro">{this.state.erro}</p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
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
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta name="jg-build" content={BUILD_ID} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(navigator.serviceWorker){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})})}}catch(e){}try{if(window.caches)caches.keys().then(function(ns){ns.forEach(function(n){caches.delete(n)})})}catch(e){}var meta=document.querySelector('meta[name="jg-build"]');var here=meta&&meta.content;function umaVez(id){var key="jg-html-"+id;try{if(sessionStorage.getItem(key))return false;sessionStorage.setItem(key,"1");return true}catch(e){return false}}function abrirNovo(id){if(!umaVez(id))return;var u=new URL(location.href);u.searchParams.set("novo",id);location.replace(u.toString())}if(!here){abrirNovo("sem-versao");return}fetch("/api/versao",{cache:"no-store"}).then(function(r){return r.json()}).then(function(d){if(!d||!d.id||d.id===here)return;abrirNovo(d.id)}).catch(function(){})})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var root=document.documentElement;var ua=/Android|iPhone|iPod|iPad|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);var m=localStorage.getItem('jg-viewport');if(ua&&m==='computer'){localStorage.removeItem('jg-viewport');m=null}var phone=false;if(m==='phone')phone=true;else if(m==='computer')phone=false;else phone=ua||window.innerWidth<768;root.classList.toggle('is-phone',phone);root.classList.toggle('is-computer',!phone);root.dataset.viewport=phone?'phone':'computer';if(localStorage.getItem('jg-theme-v2')==='dark'){root.classList.add('dark');root.style.colorScheme='dark'}else{root.classList.remove('dark');root.style.colorScheme='light'}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <SessionProvider>
            <Gate />
            <NightModeHotkey />
            <Toaster />
          </SessionProvider>
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var busy=false;function abrir(pass){pass=String(pass||"").trim();if(!pass||busy)return;busy=true;fetch("/api/acesso",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({senha:pass})}).then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d};}).catch(function(){return {ok:false,d:null};});}).then(function(res){busy=false;var user=res.d&&res.d.user;if(!res.ok||!user||!user.id)return;try{localStorage.setItem("jg-plain-user",JSON.stringify(user));}catch(e){}if(typeof window.__jgEntrar==="function")window.__jgEntrar(user);else window.__jgPendingUser=user;}).catch(function(){busy=false;});}document.addEventListener("click",function(e){var n=e.target;if(!n||!n.closest)return;if(!n.closest(".login-plain button"))return;var input=document.querySelector(".login-plain input[name=password]");abrir(input&&input.value);},true);document.addEventListener("keydown",function(e){if(e.key!=="Enter")return;var input=e.target;if(!input||input.name!=="password"||!input.closest||!input.closest(".login-plain"))return;e.preventDefault();abrir(input.value);},true);})();`,
          }}
        />
        <Scripts />
      </body>
    </html>
  ),
});
