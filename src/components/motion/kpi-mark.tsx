import { cn } from "@/lib/utils";

/** Duotone marks drawn for this system. No external asset, no attribution. */
export type KpiKind = "in" | "out" | "go" | "move" | "count";

export function KpiMark({ kind, play, className }: { kind: KpiKind; play?: boolean; className?: string }) {
  return (
    <span className={cn("kpi-mark", `is-${kind}`, play && "is-play", className)} aria-hidden="true">
      {kind === "in" ? <MarkIn /> : kind === "out" ? <MarkOut /> : kind === "go" ? <MarkGo /> : kind === "move" ? <MarkMove /> : <MarkCount />}
    </span>
  );
}

function MarkIn() {
  return (
    <svg viewBox="0 0 48 48">
      <path className="tone" d="M10 20h28l-3 16H13L10 20z" />
      <path className="ink" d="M10 20h28M16 20l2-6h12l2 6" />
      <rect className="accent mv mv-drop" x="21" y="8" width="6" height="6" rx="1.4" />
    </svg>
  );
}

function MarkOut() {
  return (
    <svg viewBox="0 0 48 48">
      <path className="tone" d="M8 22h16v12H10l-2-4v-8z" />
      <path className="ink" d="M8 26h16M24 22v12" />
      <path className="ink mv mv-leave" d="M28 24h10M34 20l6 4-6 4" />
      <circle className="accent" cx="14" cy="36" r="2.2" />
      <circle className="accent" cx="22" cy="36" r="2.2" />
    </svg>
  );
}

function MarkGo() {
  return (
    <svg viewBox="0 0 48 48">
      <path className="ink" d="M8 34c6-8 8-2 14-8s6 2 12-6" />
      <path className="accent mv mv-pin" d="M30 10a6 6 0 0 1 6 6c0 4.5-6 10-6 10s-6-5.5-6-10a6 6 0 0 1 6-6z" />
      <circle className="tone" cx="30" cy="16" r="2.2" />
    </svg>
  );
}

function MarkMove() {
  return (
    <svg viewBox="0 0 48 48">
      <rect className="tone mv mv-swap-a" x="8" y="14" width="12" height="12" rx="2.5" />
      <rect className="tone mv mv-swap-b" x="28" y="22" width="12" height="12" rx="2.5" />
      <path className="ink" d="M22 18h8M26 14l4 4-4 4" />
      <path className="accent" d="M26 30H18M22 26l-4 4 4 4" />
    </svg>
  );
}

function MarkCount() {
  return (
    <svg viewBox="0 0 48 48">
      <path className="tone" d="M14 10h16a4 4 0 0 1 4 4v22H14a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" />
      <path className="ink" d="M18 18h12M18 24h12M18 30h7" />
      <path className="accent mv mv-check" d="M30 30l3 3 6-7" />
    </svg>
  );
}
