import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { SessionProvider } from "@/lib/session";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

const APP_NAME = "JG Garcia";

function Gate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/qr-acesso") || pathname.startsWith("/operar")) return <Outlet />;
  return <AppShell />;
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
            __html: `(function(){try{var root=document.documentElement;root.classList.remove('dark');root.style.colorScheme='light';root.style.background='#f4f7f5';var ua=/iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);var sw=(window.screen&&window.screen.width)||1200;var touch=navigator.maxTouchPoints>1&&sw<900;var phone=ua||touch||window.innerWidth<900;root.classList.toggle('is-phone',phone);root.classList.toggle('is-computer',!phone);root.dataset.viewport=phone?'phone':'computer';}catch(e){}})()`,
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
