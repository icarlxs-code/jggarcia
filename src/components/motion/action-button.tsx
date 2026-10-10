import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";

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
  const mounted = useRef(true);
  const timer = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; window.clearTimeout(timer.current); };
  }, []);

  async function run() {
    if (phase !== "idle") return;
    setPhase("busy");
    try {
      const ok = await onAction();
      if (!mounted.current) return;
      if (!ok) {
        setPhase("idle");
        return;
      }
      setPhase("done");
      timer.current = window.setTimeout(() => setPhase("idle"), 1200);
    } catch (error) {
      if (!mounted.current) return;
      notify.error(error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.");
      setPhase("idle");
    }
  }

  return (
    <Button
      {...props}
      disabled={disabled || phase !== "idle"}
      aria-busy={phase === "busy"}
      aria-live="polite"
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
