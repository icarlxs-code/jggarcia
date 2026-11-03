import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Produce-drawn hues; a name always lands on the same one. */
const HUES = ["#2f80e0", "#3aa65f", "#ef6a1f", "#8a4fc9", "#c23f7d", "#139c95", "#b37b3d", "#e39a1e", "#5a62e6", "#d9617f", "#4f7590", "#8cb51f"];

function hueOf(nome: string) {
  let h = 0;
  for (const ch of nome.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0].slice(0, 2)).toUpperCase();
}

/** Initials on a tile in the name's own hue: clients (square) and people (round). */
export function NameMark({ nome, shape = "square", size = "md", className }: { nome: string; shape?: "square" | "round"; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn("name-mark", `is-${shape}`, `is-${size}`, className)}
      style={{ "--hue": hueOf(nome || "?") } as CSSProperties}
      aria-hidden="true"
    >
      {iniciais(nome || "?")}
    </span>
  );
}
