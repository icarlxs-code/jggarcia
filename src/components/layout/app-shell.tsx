import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, Menu, MoreHorizontal, PanelLeft, Search } from "lucide-react";
import gsap from "gsap";
import { useSession } from "@/lib/session";
import { hydrateFromCloud, loteStatus, runAutoZeros } from "@/lib/store";
import { syncTeamFromServer } from "@/lib/team-sync";
import { attentionAlerts, loadMutedAlerts, muteAlert } from "@/lib/intelligence";
import { useDb } from "@/lib/use-db";
import { useViewport } from "@/lib/use-viewport";
import { AnimatedIcon, type IconMotion } from "@/components/motion/animated-icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CommandPalette } from "@/components/search/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { ViewportToggle } from "@/components/viewport-toggle";
import { CeremonyOverlay } from "@/components/motion/ceremony-overlay";
import { AppContextMenu } from "@/components/ui/app-context-menu";
import { AssistenteButton } from "@/components/assistente/painel";
import { operadorPodeVer } from "@/lib/acesso-operador";
import { cn } from "@/lib/utils";
import { devicePrint } from "@/lib/device-print";
import { pingPhoneSeat } from "@/lib/qr-auth";

interface NavItem {
  to: string;
  label: string;
  icon: IconMotion;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { to: "/hoje", label: "Hoje", icon: "today" },
      { to: "/", label: "Visão geral", icon: "home" },
      { to: "/entradas", label: "Entradas", icon: "in" },
      { to: "/historico", label: "Saídas", icon: "out" },
      { to: "/movimentacoes", label: "Movimentações", icon: "log" },
      { to: "/estoque", label: "Estoque", icon: "stock" },
      { to: "/contagem", label: "Contagem", icon: "count" },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { to: "/mercadorias", label: "Produtos", icon: "package", adminOnly: true },
      { to: "/clientes", label: "Clientes", icon: "pin", adminOnly: true },
      { to: "/fornecedores", label: "Fornecedores", icon: "truck" },
      { to: "/empilhadores", label: "Empilhadores", icon: "users" },
      { to: "/pavilhoes", label: "Pavilhões", icon: "store" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/auditoria", label: "Log de alterações", icon: "log" },
      { to: "/relatorios", label: "Relatórios", icon: "chart", adminOnly: true },
      { to: "/analises", label: "Gráficos e análises", icon: "chart", adminOnly: true },
      { to: "/fretes", label: "Pagamento de fretes", icon: "truck" },
      { to: "/despesas-frete", label: "Despesa de frete", icon: "truck" },
      { to: "/requisicoes", label: "Requisição de Fornecedor", icon: "log" },
      { to: "/usuarios", label: "Equipe", icon: "users", adminOnly: true },
      { to: "/configuracoes", label: "Configurações", icon: "gear" },
    ],
  },
];

const TABS: NavItem[] = [
  { to: "/hoje", label: "Hoje", icon: "today" },
  { to: "/entradas", label: "Entrada", icon: "in" },
  { to: "/historico", label: "Saídas", icon: "out" },
  { to: "/estoque", label: "Estoque", icon: "stock" },
];

const COLLAPSE_KEY = "jg-nav-collapsed";

function Brand({ collapsed, home = "/" }: { collapsed?: boolean; home?: "/" | "/fretes" }) {
  return (
    <Link to={home} className={cn("side-brand flex items-center gap-3 px-4 py-5", collapsed && "justify-center")}>
      <img src="/logo.png" alt={collapsed ? "JG Garcia" : ""} className="h-10 w-12 shrink-0 object-contain" />
      {collapsed ? null : <span className="min-w-0"><span className="block text-lg font-semibold text-sidebar-foreground">JG Garcia</span><span className="block text-xs text-sidebar-foreground/75">Operação e estoque</span></span>}
    </Link>
  );
}

function NavList({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { isAdmin } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Menu principal" className={cn("relative flex flex-1 flex-col gap-5 overflow-y-auto pb-4", collapsed ? "px-2" : "px-3")}>
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => (!i.adminOnly || isAdmin) && (isAdmin || operadorPodeVer(i.to)));
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            {collapsed ? null : (
              <p className="nav-group">
                <span>{group.label}</span>
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
                const link = (
                  <Link
                    key={item.to}
                    to={item.to}
                    preload="intent"
                    viewTransition={false}
                    data-active={active ? "true" : "false"}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "nav-link relative z-[1] flex min-h-11 items-center rounded-lg text-sm font-medium transition-[color,background-color] duration-200",
                      collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                      active ? "text-sidebar-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                    )}
                  >
                    <span className="nav-mark">
                      <AnimatedIcon name={item.icon} active={active} />
                    </span>
                    {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                  </Link>
                );
                if (!collapsed) return link;
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const { perfil, isAdmin, signOut } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPhone = useViewport() === "phone";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const tabNavRef = useRef<HTMLElement>(null);
  const tabBlobRef = useRef<HTMLSpanElement>(null);
  const navigate = useNavigate();
  const liberado = isAdmin || operadorPodeVer(pathname);
  const abas = isAdmin
    ? TABS
    : [
        { to: "/fretes", label: "Pagamento", icon: "truck" as const },
        { to: "/despesas-frete", label: "Despesa", icon: "truck" as const },
      ];
  const initials = (perfil?.nome || "JG")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (liberado) return;
    void navigate({ to: "/fretes", replace: true });
  }, [liberado, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const open = () => setCmdOpen(true);
    window.addEventListener("jg-open-search", open);
    return () => window.removeEventListener("jg-open-search", open);
  }, [isAdmin]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void hydrateFromCloud().then(() => syncTeamFromServer());
      }
      timer = window.setTimeout(tick, 60000);
    };
    timer = window.setTimeout(tick, 60000);
    const meiaNoite = window.setInterval(() => {
      try {
        runAutoZeros();
      } catch {
        /* ignore */
      }
    }, 60_000);
    const zeros = window.setTimeout(() => {
      try {
        runAutoZeros();
      } catch {
        /* ignore */
      }
    }, 60000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(zeros);
      window.clearInterval(meiaNoite);
    };
  }, []);

  useEffect(() => {
    const beat = () => {
      try {
        const raw = localStorage.getItem("jg-device");
        if (!raw) return;
        const parsed = JSON.parse(raw) as { deviceId?: string; secret?: string };
        if (!parsed.deviceId) return;
        void pingPhoneSeat({
          data: { deviceId: parsed.deviceId, deviceSecret: parsed.secret, print: devicePrint() },
        }).catch(() => undefined);
      } catch {
        /* ignore */
      }
    };
    const first = window.setTimeout(beat, 15000);
    const id = window.setInterval(beat, 25000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isPhone) return;
    const nav = tabNavRef.current;
    const blob = tabBlobRef.current;
    if (!nav || !blob) return;
    const active = nav.querySelector(".jg-tab.is-active") as HTMLElement | null;
    if (!active) {
      gsap.to(blob, { opacity: 0, duration: 0.18, overwrite: true });
      return;
    }
    const nr = nav.getBoundingClientRect();
    const er = active.getBoundingClientRect();
    const x = er.left - nr.left + 4;
    const w = Math.max(36, er.width - 8);
    gsap.set(blob, { x, width: w, opacity: 1, scaleX: 1 });
    blob.dataset.ready = "1";
  }, [pathname, isPhone]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className={cn("command-deck flex h-dvh w-full overflow-hidden bg-background", isPhone && "is-phone-shell")}>
        <a href="#main-content" className="skip-link">Ir para o conteúdo</a>
        <aside
          id="main-sidebar"
          className={cn(
            "jg-sidebar shrink-0 flex-col bg-sidebar transition-[width] duration-200 ease-out",
            isPhone ? "hidden" : "flex",
            collapsed ? "w-[4.25rem]" : "w-64",
          )}
        >
          <Brand collapsed={collapsed} home={isAdmin ? "/" : "/fretes"} />
          <NavList collapsed={collapsed} />
          <div className="side-foot px-2 py-3">
            <div className={cn("side-user flex items-center gap-2.5", collapsed && "justify-center")}>
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              {collapsed ? null : (
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-sidebar-foreground">{perfil?.nome}</div>
                  <div className="text-xs text-sidebar-foreground/50">{isAdmin ? "Administrador" : "Operador"}</div>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="jg-topbar flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4 lg:px-8">
            {isPhone ? (
              <img src="/logo.png" alt="JG Garcia" className="h-7 w-auto shrink-0 object-contain" />
            ) : (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Brand home={isAdmin ? "/" : "/fretes"} />
                <NavList onNavigate={() => setSheetOpen(false)} />
              </SheetContent>
            </Sheet>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={cn(isPhone ? "hidden" : "inline-flex")} onClick={toggleCollapsed} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} aria-expanded={!collapsed} aria-controls="main-sidebar">
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{collapsed ? "Expandir menu" : "Recolher menu"}</TooltipContent>
            </Tooltip>

            {isPhone || !isAdmin ? null : <Breadcrumbs />}

            {isAdmin ? (
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className={cn(
                "flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/70 text-left text-sm text-muted-foreground transition-colors hover:bg-muted",
                isPhone ? "w-10 shrink-0 justify-center px-0" : "ml-auto max-w-xs flex-1 px-3 sm:flex-none sm:w-64",
              )}
              aria-label="Buscar"
            >
              <Search className="h-4 w-4 shrink-0" />
              {isPhone ? null : (
                <>
                  <span className="truncate">Buscar…</span>
                  <kbd className="ml-auto hidden rounded border border-border bg-card px-1.5 py-0.5 text-xs sm:inline">Ctrl K</kbd>
                </>
              )}
            </button>
            ) : null}

            <div className={cn("flex shrink-0 items-center gap-1 sm:gap-2", isAdmin ? "ml-auto" : "ml-auto")}>
              {isPhone || !isAdmin ? null : <ViewportToggle compact />}
              {isPhone ? null : <ThemeToggle />}
              {isAdmin ? <AssistenteButton /> : null}
              {isAdmin ? <AlertsMenu /> : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label={`Conta de ${perfil?.nome || "usuário"}`} className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-2.5 transition-colors hover:bg-muted">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className={cn("max-w-28 truncate text-sm font-medium", isPhone ? "hidden" : "hidden sm:block")}>{perfil?.nome}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-sm font-medium">{perfil?.nome}</div>
                    <div className="text-xs text-muted-foreground">{perfil?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isPhone ? (
                    <>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <ViewportToggle compact />
                        <span className="ml-2">Telefone / computador</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <ThemeToggle />
                        <span>Aparência</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="h-4 w-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main id="main-content" tabIndex={-1} className={cn("jg-main min-h-0 flex-1 overflow-y-auto p-4 lg:p-8", isPhone && "pb-[calc(4.5rem+env(safe-area-inset-bottom))]")}>
            {liberado ? <Outlet /> : null}
          </main>
        </div>
        {isPhone ? (
          <>
            <nav ref={tabNavRef} className="jg-tabbar" aria-label="Navegação da operação">
              <span ref={tabBlobRef} className="jg-tab-blob" aria-hidden />
              {abas.map((item) => {
                const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    preload="viewport"
                    viewTransition={false}
                    data-entrada-dock={item.to === "/entradas" ? "true" : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn("jg-tab", active && "is-active")}
                  >
                    <AnimatedIcon name={item.icon} active={active} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {isAdmin ? (
              <button type="button" className="jg-tab" onClick={() => setSheetOpen(true)}>
                <MoreHorizontal className="h-5 w-5" />
                <span>Mais</span>
              </button>
              ) : null}
            </nav>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetContent
                side="bottom"
                className="h-auto max-h-[min(78dvh,calc(100dvh-5.75rem-env(safe-area-inset-bottom)))] rounded-t-2xl bg-card p-0 text-foreground"
                style={{ bottom: "calc(3.65rem + env(safe-area-inset-bottom))" }}
              >
                <SheetTitle className="px-4 pt-4 text-base">Menu</SheetTitle>
                <div className="overflow-y-auto overscroll-contain px-2 pb-6 pt-2">
                  {NAV_GROUPS.map((group) => {
                    const items = group.items.filter((i) => (!i.adminOnly || isAdmin) && (isAdmin || operadorPodeVer(i.to)));
                    if (!items.length) return null;
                    return (
                      <div key={group.label} className="mb-2">
                        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                        {items.map((item) => (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setSheetOpen(false)}
                            className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted"
                          >
                            <AnimatedIcon name={item.icon} active={pathname === item.to} />
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </>
        ) : null}
      </div>
      {isAdmin ? <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} /> : null}
      {isAdmin ? <AppContextMenu /> : null}
      <CeremonyOverlay />
    </TooltipProvider>
  );
}

function AlertsMenu() {
  const { perfil, isAdmin } = useSession();
  const live = useDb();
  const [muted, setMuted] = useState(() => loadMutedAlerts(perfil?.id));
  useEffect(() => {
    setMuted(loadMutedAlerts(perfil?.id));
  }, [perfil?.id]);
  const lotes = isAdmin ? live.listLotes().filter((l) => loteStatus(l.validade) === "vencido").slice(0, 2) : [];
  const alerts = attentionAlerts({
    contagens: live.listContagens(),
    mercadorias: live.listMercadorias(),
    pavilhoes: live.listPavilhoes(),
    lotes,
  }).filter((a) => !muted.has(a.id));
  const shown = alerts.slice(0, 5);
  const extra = alerts.length - shown.length;

  function hide(id: string) {
    muteAlert(perfil?.id, id);
    setMuted(loadMutedAlerts(perfil?.id));
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-muted"
              aria-label="Alertas"
            >
              <Bell className="h-4 w-4" />
              {alerts.length > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
                  {alerts.length > 9 ? "9+" : alerts.length}
                </span>
              ) : null}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Alertas</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Só quando não bateu</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {alerts.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Nada para conferir agora.</p>
        ) : (
          shown.map((a) => (
            <div key={a.id} className="border-b border-border px-2 py-2 last:border-0">
              {a.search ? (
                <Link to={a.to} search={a.search} className="block rounded-md px-1 py-0.5 hover:bg-muted">
                  <p className="text-sm font-medium leading-snug">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </Link>
              ) : (
                <Link to={a.to} className="block rounded-md px-1 py-0.5 hover:bg-muted">
                  <p className="text-sm font-medium leading-snug">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </Link>
              )}
              <button type="button" className="mt-1 px-1 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => hide(a.id)}>
                Não mostrar mais
              </button>
            </div>
          ))
        )}
        {extra > 0 ? <p className="px-3 py-2 text-xs text-muted-foreground">Mais {extra} no sino. Cada um só aparece de novo se contar outra vez e não bater.</p> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
