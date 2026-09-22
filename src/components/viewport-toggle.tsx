import { useEffect, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { applyViewport, getViewport, readViewportPref, setViewportPref, subscribeViewport, type ViewportKind } from "@/lib/viewport";
import { cn } from "@/lib/utils";

export function ViewportToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [kind, setKind] = useState<ViewportKind>("computer");

  useEffect(() => {
    applyViewport(readViewportPref());
    setKind(getViewport());
    return subscribeViewport(() => setKind(getViewport()));
  }, []);

  return (
    <div
      className={cn("inline-flex items-center rounded-full border border-border bg-card p-0.5", className)}
      role="group"
      aria-label="Layout do aparelho"
    >
      <button
        type="button"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors",
          kind === "phone" && "bg-primary text-primary-foreground",
        )}
        aria-label="Modo telefone"
        aria-pressed={kind === "phone"}
        title="Telefone"
        onClick={() => setKind(setViewportPref("phone"))}
      >
        <Smartphone className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors",
          kind === "computer" && "bg-primary text-primary-foreground",
        )}
        aria-label="Modo computador"
        aria-pressed={kind === "computer"}
        title="Computador"
        onClick={() => setKind(setViewportPref("computer"))}
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
      {compact ? null : <span className="sr-only">Trocar entre telefone e computador</span>}
    </div>
  );
}
