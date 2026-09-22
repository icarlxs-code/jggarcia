import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, Menu, MoreHorizontal, PanelLeft, Search } from "lucide-react";
import gsap from "gsap";
import { useSession } from "@/lib/session";
import { hydrateFromCloud, loteStatus } from "@/lib/store";
import { syncTeamFromServer } from "@/lib/session";
import { detectIssues, loadSeenAlerts, markAlertSeen } from "@/lib/intelligence";
import { useDb } from "@/lib/use-db";
import { useViewport } from "@/lib/use-viewport";
import { formatDateBR } from "@/lib/format";
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
import { cn } from "@/lib/utils";
import { devicePrint } from "@/lib/device-print";
import { pingPhoneSeat } from "@/lib/qr-auth";
import { prefersReducedMotion } from "@/lib/motion";

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
      { to: "/lotes", label: "Lotes e validade", icon: "lot" },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { to: "/mercadorias", label: "Produtos", icon: "package", adminOnly: true },
      { to: "/clientes", label: "Clientes", icon: "pin", adminOnly: true },
      { to: "/fornecedores", label: "Fornecedores", icon: "truck" },
      { to: "/pavilhoes", label: "Pavilhões", icon: "store" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/auditoria", label: "Log de alterações", icon: "log" },
      { to: "/relatorios", label: "Relatórios", icon: "chart", adminOnly: true },
      { to: "/usuarios", label: "Equipe", icon: "users", adminOnly: true },
      { to: "/configuracoes", label: "Configurações", icon: "gear", adminOnly: true },
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

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center px-3 py-4", collapsed ? "justify-center" : "justify-center")}>
      <img src="/logo.png" alt="JG Garcia" className={cn("w-auto object-contain", collapsed ? "h-8" : "h-12")} />
    </Link>
  );
}

function NavList({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { isAdmin } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState({ top: 0, height: 40, opacity: 0 });

  useLayoutEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector('[data-active="true"]') as HTMLElement | null;
    if (!nav || !el) {
      setPill((p) => ({ ...p, opacity: 0 }));
      return;
    }
    const nr = nav.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setPill({
      top: er.top - nr.top + nav.scrollTop,
      height: er.height,
      opacity: 1,
    });
  }, [pathname, isAdmin, collapsed]);

  return (
    <nav ref={navRef} className={cn("relative flex flex-1 flex-col gap-5 overflow-y-auto pb-4", collapsed ? "px-2" : "px-3")}>
      <div
        className="nav-pill"
        style={{
          transform: `translate3d(0, ${pill.top}px, 0)`,
          height: pill.height,
          opacity: pill.opacity,
          left: collapsed ? "0.35rem" : "0.75rem",
          right: collapsed ? "0.35rem" : "0.75rem",
        }}
      />
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.adminOnly || isAdmin);
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            {collapsed ? null : (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {group.label}
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
                    viewTransition
                    data-active={active ? "true" : "false"}
                    onClick={onNavigate}
                    className={cn(
                      "nav-link relative z-[1] flex min-h-10 items-center rounded-lg text-sm font-medium transition-[color] duration-150",
                      collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                      active ? "text-sidebar-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                    )}
                  >
                    <AnimatedIcon name={item.icon} active={active} />
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
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPhone = useViewport() === "phone";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const tabNavRef = useRef<HTMLElement>(null);
  const tabBlobRef = useRef<HTMLSpanElement>(null);
  const initials = (perfil?.nome || "JG")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const paths = ["/estoque", "/entradas", "/historico", "/lotes", "/mercadorias", "/auditoria", "/nova-saida", "/clientes", "/contagem", "/pavilhoes", "/relatorios", "/hoje", "/movimentacoes"] as const;
    for (const to of paths) void router.preloadRoute({ to });
  }, [router]);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void hydrateFromCloud().then(() => syncTeamFromServer());
      }
      timer = window.setTimeout(tick, 12000);
    };
    timer = window.setTimeout(tick, 2500);
    const vis = () => {
      if (document.visibilityState === "visible") void hydrateFromCloud().then(() => syncTeamFromServer());
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", vis);
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
    beat();
    const id = window.setInterval(beat, 25000);
    return () => window.clearInterval(id);
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
    if (prefersReducedMotion() || !blob.dataset.ready) {
      gsap.set(blob, { x, width: w, opacity: 1, scaleX: 1 });
      blob.dataset.ready = "1";
      return;
    }
    const prev = blob.getBoundingClientRect();
    const stretch = Math.min(1.5, 1 + Math.abs(er.left - prev.left) / 120);
    gsap.fromTo(
      blob,
      { scaleX: stretch },
      {
        x,
        width: w,
        scaleX: 1,
        opacity: 1,
        duration: 0.52,
        ease: "elastic.out(0.84, 0.56)",
        overwrite: true,
        transformOrigin: "50% 50%",
      },
    );
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
      <div className={cn("flex h-dvh w-full overflow-hidden bg-background", isPhone && "is-phone-shell")}>
        <aside
          className={cn(
            "jg-sidebar shrink-0 flex-col bg-sidebar transition-[width] duration-200 ease-out",
            isPhone ? "hidden" : "flex",
            collapsed ? "w-[4.25rem]" : "w-56",
          )}
        >
          <Brand collapsed={collapsed} />
          <NavList collapsed={collapsed} />
          <div className="border-t border-sidebar-border px-2 py-3">
            <div className={cn("flex items-center gap-2.5 rounded-lg px-1", collapsed && "justify-center")}>
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
          <header className="jg-topbar flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 sm:h-14 sm:gap-2 sm:px-3 lg:px-5">
            {isPhone ? (
              <img src="/logo.png" alt="JG Garcia" className="h-7 w-auto shrink-0 object-contain" />
            ) : (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Brand />
                <NavList onNavigate={() => setSheetOpen(false)} />
              </SheetContent>
            </Sheet>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={cn(isPhone ? "hidden" : "inline-flex")} onClick={toggleCollapsed} aria-label="Recolher menu">
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{collapsed ? "Expandir menu" : "Recolher menu"}</TooltipContent>
            </Tooltip>

            {isPhone ? null : <Breadcrumbs />}

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
                  <kbd className="ml-auto hidden rounded border border-border bg-card px-1.5 py-0.5 text-[10px] sm:inline">Ctrl K</kbd>
                </>
              )}
            </button>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              {isPhone ? null : <ViewportToggle compact />}
              {isPhone ? null : <ThemeToggle />}
              <AlertsMenu />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex min-h-10 items-center gap-2 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-2.5 transition-colors hover:bg-muted">
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

          <main className={cn("jg-main min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6", isPhone && "pb-[calc(4.5rem+env(safe-area-inset-bottom))]")}>
            <Outlet />
          </main>
        </div>
        {isPhone ? (
          <>
            <nav ref={tabNavRef} className="jg-tabbar">
              <span ref={tabBlobRef} className="jg-tab-blob" aria-hidden />
              {TABS.map((item) => {
                const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    preload="viewport"
                    viewTransition={false}
                    data-entrada-dock={item.to === "/entradas" ? "true" : undefined}
                    className={cn("jg-tab", active && "is-active")}
                  >
                    <AnimatedIcon name={item.icon} active={active} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <button type="button" className="jg-tab" onClick={() => setSheetOpen(true)}>
                <MoreHorizontal className="h-5 w-5" />
                <span>Mais</span>
              </button>
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
                    const items = group.items.filter((i) => !i.adminOnly || isAdmin);
                    if (!items.length) return null;
                    return (
                      <div key={group.label} className="mb-2">
                        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
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
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
        <CeremonyOverlay />
    </TooltipProvider>
  );
}

function AlertsMenu() {
  const { isAdmin } = useSession();
  const live = useDb();
  const [seen, setSeen] = useState(() => loadSeenAlerts());
  const issues = isAdmin ? detectIssues(live.listSaidas(), live.listMercadorias()).filter((a) => !seen.has(a.id)) : [];
  const lotes = live.listLotes().filter((l) => loteStatus(l.validade) === "vencido");
  const count = issues.length + (isAdmin ? lotes.length : 0);

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
              {count > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" /> : null}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{isAdmin ? "Alertas do sistema" : "Avisos"}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>O que precisa de atenção</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isAdmin ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Avisos de falha chegam só para o administrador.</p>
        ) : count === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Nada fora do padrão agora.</p>
        ) : (
          <>
            {issues.map((a) => (
              <DropdownMenuItem
                key={a.id}
                className="items-start gap-2 py-2"
                onSelect={(e) => {
                  e.preventDefault();
                  markAlertSeen(a.id);
                  setSeen(loadSeenAlerts());
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </div>
              </DropdownMenuItem>
            ))}
            {lotes.slice(0, 4).map((l) => (
              <DropdownMenuItem key={l.id} asChild>
                <Link to="/lotes">
                  <span className="min-w-0 flex-1 truncate">Lote vencido {l.codigo}</span>
                  <span className="text-xs text-muted-foreground">{formatDateBR(l.validade)}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
