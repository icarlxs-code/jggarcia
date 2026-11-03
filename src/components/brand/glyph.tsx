import type { ReactNode } from "react";
import type { ModuleId } from "@/lib/modules";
import { cn } from "@/lib/utils";

/**
 * Safra glyphs: one drawn icon per module plus a few interface and status
 * marks. Each glyph is built from named parts (g-*) so its motion can tell
 * what it does: the crate lifts off the stack, the truck pulls away, the
 * forks raise the load. All motion lives in styles.css under html.motion-on.
 *
 * Triggers: hover on any ancestor with .glyph-host plays the one-shot motion;
 * `live` loops a calm version (current page, active nav item); `state` adds
 * loading / success / warning / error feedback.
 */
export type UiGlyph = "busca" | "sino" | "assistente" | "sync";
export type StatusGlyphName = "sucesso" | "erro" | "alerta" | "info" | "carregando";
export type GlyphName = ModuleId | UiGlyph;
export type GlyphState = "idle" | "loading" | "success" | "warning" | "error";

const PARTS: Record<GlyphName, ReactNode> = {
  hoje: (
    <>
      <path className="g-rays" d="M12 9.4V7.4M16.67 11.33l1.41-1.41M7.33 11.33 5.92 9.92M18.2 13.74l1.88-.68M5.8 13.74l-1.88-.68" />
      <path className="g-sun" d="M7.5 16a4.5 4.5 0 0 1 9 0" />
      <path d="M3 16h18" />
      <path className="g-ground" d="M7 19.5h10" />
    </>
  ),
  inicio: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path className="g-bar g-b1" d="M8.5 16v-3" />
      <path className="g-bar g-b2" d="M12 16V8.5" />
      <path className="g-bar g-b3" d="M15.5 16v-5" />
    </>
  ),
  entradas: (
    <>
      <path d="M3.5 13.5h4.2l1.6 2.4h5.4l1.6-2.4h4.2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <g className="g-box">
        <rect x="8.75" y="3.5" width="6.5" height="6" rx="1.1" />
        <path d="M12 3.5v2" />
      </g>
    </>
  ),
  saidas: (
    <>
      <g className="g-truck">
        <rect x="4.5" y="6.5" width="9.5" height="9" rx="1" />
        <path d="M14 10h3.6l2.9 3.2V16H14" />
        <circle className="g-wheel" cx="8" cy="17.6" r="1.7" />
        <circle className="g-wheel" cx="17" cy="17.6" r="1.7" />
      </g>
      <path className="g-speed" d="M1.5 9.5h1.8M1 12.5h2.3" />
    </>
  ),
  movimentacoes: (
    <>
      <g className="g-a1">
        <path d="M4 8.5h14.5" />
        <path d="M15.5 5.5l3 3-3 3" />
      </g>
      <g className="g-a2">
        <path d="M20 15.5H5.5" />
        <path d="M8.5 12.5l-3 3 3 3" />
      </g>
    </>
  ),
  estoque: (
    <>
      <rect x="3" y="12" width="8.5" height="8.5" rx="1.3" />
      <rect x="12.5" y="12" width="8.5" height="8.5" rx="1.3" />
      <path d="M3 16.25h8.5M12.5 16.25H21" />
      <g className="g-top">
        <rect x="7.75" y="3.5" width="8.5" height="8.5" rx="1.3" />
        <path d="M7.75 7.75h8.5" />
      </g>
    </>
  ),
  contagem: (
    <>
      <rect x="4.5" y="4" width="15" height="17" rx="2.2" />
      <path d="M9 4v-.8A1.2 1.2 0 0 1 10.2 2h3.6A1.2 1.2 0 0 1 15 3.2V4" />
      <path className="g-c1" pathLength={1} d="M8 10.2l1.6 1.6 3-3.1" />
      <path className="g-c2" pathLength={1} d="M8 15.7l1.6 1.6 3-3.1" />
      <path d="M14.5 10.7h2M14.5 16.2h2" />
    </>
  ),
  lotes: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M3.5 9.5h17M8 3.2v3.6M16 3.2v3.6" />
      <circle cx="12" cy="15" r="3.2" />
      <path className="g-hand" d="M12 13.4V15l1.1.9" />
    </>
  ),
  produtos: (
    <>
      <g className="g-fruit">
        <path d="M12 8.2c-1.6-1.3-5.9-1.6-6.6 2.4-.6 3.4 1.5 7.6 3.6 8.9 1 .6 2 .3 3-.3 1 .6 2 .9 3 .3 2.1-1.3 4.2-5.5 3.6-8.9-.7-4-5-3.7-6.6-2.4z" />
        <path d="M12 8.2c0-1.6.4-2.9 1.3-3.9" />
      </g>
      <path className="g-leaf" d="M13.4 5.6c1-1.4 2.6-1.9 4.1-1.6-.3 1.6-1.9 2.5-4.1 1.6z" />
    </>
  ),
  clientes: (
    <>
      <path d="M4.5 10.5v9h15v-9" />
      <path d="M3 9.5 4.6 4.5h14.8L21 9.5" />
      <path className="g-scallop" d="M3 9.5a2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0" />
      <path className="g-door" d="M10 19.5v-4.5h4v4.5" />
    </>
  ),
  fornecedores: (
    <>
      <path d="M4 20h16" />
      <g className="g-plant">
        <path d="M12 20v-7.5" />
        <path className="g-leaf-l" d="M12 15.2c-3.3 0-5.2-2-5.2-5.2 3.2 0 5.2 1.9 5.2 5.2z" />
        <path className="g-leaf-r" d="M12 12.5c0-3.4 2-5.7 5.7-5.7 0 3.5-2.2 5.7-5.7 5.7z" />
      </g>
    </>
  ),
  empilhadores: (
    <>
      <path d="M3.5 17.5v-6h5.2l2.6 3.6v2.4" />
      <path d="M4.8 11.5v-4h3.9v4" />
      <path d="M11.3 15.1h3.2M14.5 4.5v14.5" />
      <g className="g-lift">
        <path d="M14.5 17.5H20" />
        <rect x="15.6" y="12.7" width="4.4" height="4" rx=".6" />
      </g>
      <circle cx="6.2" cy="18.7" r="1.6" />
      <circle cx="11" cy="18.7" r="1.6" />
    </>
  ),
  pavilhoes: (
    <>
      <path d="M3 10 12 4.5l9 5.5" />
      <path d="M5 9v11h14V9" />
      <path d="M8.5 20v-7.5h7V20" />
      <path className="g-door" d="M8.5 14.5h7M8.5 16.5h7M8.5 18.5h7" />
    </>
  ),
  log: (
    <>
      <g className="g-arrow">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </g>
      <path className="g-hand" d="M12 7v5l4 2" />
    </>
  ),
  relatorios: (
    <>
      <g className="g-doc">
        <path d="M6 3.5h8.2L18.5 8v12.5H6z" />
        <path className="g-fold" d="M14 3.5V8h4.5" />
      </g>
      <path className="g-l1" pathLength={1} d="M9 12h6" />
      <path className="g-l2" pathLength={1} d="M9 15h6" />
      <path className="g-l3" pathLength={1} d="M9 18h3.5" />
    </>
  ),
  analises: (
    <>
      <path d="M4 4v15.5a.5.5 0 0 0 .5.5H20" />
      <path className="g-line" pathLength={1} d="M7.5 15.5 11 11.5l3 2.5 5-6" />
      <circle className="g-dot" cx="19" cy="8" r="1.3" />
    </>
  ),
  fretes: (
    <g className="g-coin">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="5.6" strokeOpacity={0.45} />
      <path d="M13.9 10.2c-.4-.7-1.1-1-1.9-1-1.1 0-1.9.6-1.9 1.4 0 2 3.9 1 3.9 3 0 .8-.8 1.4-2 1.4-.9 0-1.7-.4-2.1-1M12 7.9v1.3M12 14.8v1.3" />
    </g>
  ),
  despesas: (
    <>
      <g className="g-paper">
        <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" />
        <path d="M9 7.5h6M9 10.5h6" />
      </g>
      <path className="g-minus" d="M9.5 15h5" />
    </>
  ),
  requisicoes: (
    <>
      <rect x="4" y="3" width="13" height="18" rx="2" />
      <path className="g-hash" d="M8.6 8.5 8 15.5M12 8.5l-.6 7M6.8 10.5h6.6M6.6 13.5h6.6" />
      <path className="g-pen" d="M14.2 20.2l5.4-5.4a1.3 1.3 0 0 1 1.8 1.8L16 22h-1.8z" />
    </>
  ),
  equipe: (
    <>
      <circle cx="9" cy="8.2" r="3.2" />
      <path d="M3.2 19.5c.5-3.2 2.9-5.4 5.8-5.4s5.3 2.2 5.8 5.4" />
      <g className="g-p2">
        <circle cx="16.6" cy="9" r="2.5" />
        <path d="M15.9 14.2c.3-.1.7-.1 1-.1 2.3 0 4.2 1.8 4.6 4.4" />
      </g>
    </>
  ),
  config: (
    <g className="g-gear">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </g>
  ),
  acesso: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M11 18.5h2" />
      <path className="g-wave g-w1" d="M19.5 9a4 4 0 0 1 0 6" />
      <path className="g-wave g-w2" d="M21.5 7a7 7 0 0 1 0 10" />
    </>
  ),
  busca: (
    <g className="g-lens">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.2 4.2" />
    </g>
  ),
  sino: (
    <>
      <g className="g-bell">
        <path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33" />
      </g>
      <path className="g-clapper" d="M10.27 21a2 2 0 0 0 3.46 0" />
    </>
  ),
  assistente: (
    <>
      <path className="g-star" d="M9.94 15.5a2 2 0 0 0-1.44-1.44l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96l-6.13 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" />
      <path className="g-twinkle g-t1" d="M20 3v4M22 5h-4" />
      <path className="g-twinkle g-t2" d="M4 17v2M5 18H3" />
    </>
  ),
  sync: (
    <g className="g-spin">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </g>
  ),
};

const BADGE: Record<Exclude<GlyphState, "idle" | "loading">, ReactNode> = {
  success: <path d="M17.2 19.1l1.2 1.2 2.4-2.5" />,
  warning: <path d="M19 17v1.8M19 20.7h.01" />,
  error: <path d="M17.6 17.6l2.8 2.8M20.4 17.6l-2.8 2.8" />,
};

export function Glyph({
  name,
  live,
  state = "idle",
  className,
  label,
}: {
  name: GlyphName;
  /** Calm looping motion (current page, active item). */
  live?: boolean;
  state?: GlyphState;
  className?: string;
  /** Accessible name; omit when the glyph sits next to visible text. */
  label?: string;
}) {
  const badge = state === "success" || state === "warning" || state === "error" ? state : null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-glyph={name}
      data-state={state}
      className={cn("glyph", live && "is-live", state === "loading" && "is-loading", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {PARTS[name]}
      {badge ? (
        <g className={cn("g-badge", `is-${badge}`)}>
          <circle cx="19" cy="19" r="4.3" className="g-badge-dot" />
          {BADGE[badge]}
        </g>
      ) : null}
    </svg>
  );
}

const STATUS: Record<StatusGlyphName, ReactNode> = {
  sucesso: (
    <>
      <circle className="s-ring" pathLength={1} cx="12" cy="12" r="9" />
      <path className="s-mark" pathLength={1} d="M8 12.5l2.6 2.6L16 9.6" />
    </>
  ),
  erro: (
    <>
      <circle className="s-ring" pathLength={1} cx="12" cy="12" r="9" />
      <path className="s-mark" pathLength={1} d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  alerta: (
    <g className="s-shake">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </g>
  ),
  info: (
    <>
      <circle className="s-ring" pathLength={1} cx="12" cy="12" r="9" />
      <path className="s-mark" pathLength={1} d="M12 16v-4M12 8h.01" />
    </>
  ),
  carregando: <path className="s-spin" d="M21 12a9 9 0 1 1-6.22-8.56" />,
};

/** Status marks that draw themselves in: for toasts and inline feedback. */
export function StatusGlyph({ name, className }: { name: StatusGlyphName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-status={name}
      className={cn("status-glyph", className)}
      aria-hidden="true"
    >
      {STATUS[name]}
    </svg>
  );
}
