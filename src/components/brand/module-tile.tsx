import { Glyph, type GlyphState } from "@/components/brand/glyph";
import { moduleStyle, type ModuleId } from "@/lib/modules";
import { cn } from "@/lib/utils";

/** A module's glyph on a small lit tile: marks what a card or row is about. */
export function ModuleTile({
  id,
  size = "md",
  live,
  state,
  className,
}: {
  id: ModuleId;
  size?: "sm" | "md" | "lg";
  live?: boolean;
  state?: GlyphState;
  className?: string;
}) {
  return (
    <span className={cn("mod-tile", `is-${size}`, className)} data-module={id} style={moduleStyle(id)} aria-hidden="true">
      <Glyph name={id} live={live} state={state} />
    </span>
  );
}
