import { useState, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOTION, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Phase = "idle" | "busy" | "done";

export function ActionButton({
  children,
  idleLabel,
  pendingLabel = "Salvando",
  doneLabel = "Salvo",
  onAction,
  disabled,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick"> & {
  idleLabel?: string;
  pendingLabel?: string;
  doneLabel?: string;
  onAction: () => Promise<boolean> | boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");

  async function run() {
    if (phase !== "idle") return;
    setPhase("busy");
    const t0 = performance.now();
    try {
      const ok = await onAction();
      const min = prefersReducedMotion() ? 0 : 720;
      const wait = Math.max(0, min - (performance.now() - t0));
      if (wait) await new Promise((r) => window.setTimeout(r, wait));
      if (!ok) {
        setPhase("idle");
        return;
      }
      setPhase("done");
      window.setTimeout(() => setPhase("idle"), prefersReducedMotion() ? 200 : MOTION.duration.hero);
    } catch {
      setPhase("idle");
    }
  }

  return (
    <Button
      {...props}
      disabled={disabled || phase !== "idle"}
      onClick={() => void run()}
      className={cn("liquid-btn", `is-${phase}`, className)}
    >
      <span className="liquid-btn-wave" aria-hidden />
      <span className="liquid-btn-content">
        {phase === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {phase === "done" ? (
          <svg className="liquid-check" viewBox="0 0 24 24" aria-hidden>
            <path d="M5 13.2 9.6 18 19 7" />
          </svg>
        ) : null}
        <span>
          {phase === "busy" ? pendingLabel : phase === "done" ? doneLabel : (idleLabel ?? children)}
        </span>
      </span>
    </Button>
  );
}
