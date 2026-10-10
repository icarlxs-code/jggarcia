import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator, Minus, X } from "lucide-react";
import { evaluateLive, formatCalc } from "@/lib/live-calc";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEYS = [
  ["C", "⌫", "(", ")"],
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
  ["0", ",", "=", "+"],
] as const;

function tokenFromKey(key: string): string | "mini" | null {
  if (key === "Escape") return "mini";
  if (key === "Enter" || key === "=") return "=";
  if (key === "Backspace") return "⌫";
  if (key === "Delete") return "C";
  if (key === "c" || key === "C") return "C";
  if (key === "+") return "+";
  if (key === "-" || key === "−") return "−";
  if (key === "*" || key === "x" || key === "X") return "×";
  if (key === "/" || key === "÷") return "÷";
  if (key === "(" || key === ")") return key;
  if (key === "," || key === "." || key === "Decimal") return ",";
  if (/^[0-9]$/.test(key)) return key;
  return null;
}

export function CountCalc() {
  const [mode, setMode] = useState<"closed" | "open" | "mini">("closed");
  const [expr, setExpr] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const live = useMemo(() => evaluateLive(expr), [expr]);

  function applyKey(key: string) {
    setExpr((s) => {
      if (key === "C") return "";
      if (key === "⌫") return s.slice(0, -1);
      if (key === "=") {
        const r = evaluateLive(s);
        if (r.value != null && r.complete) return formatCalc(r.value);
        return s;
      }
      return s + key;
    });
  }

  useLayoutEffect(() => {
    if (mode !== "open") return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    panelRef.current?.focus({ preventScroll: true });
  }, [mode]);

  useEffect(() => {
    if (mode !== "open") return;
    function onKey(e: KeyboardEvent) {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const token = tokenFromKey(e.key);
      if (!token) return;
      e.preventDefault();
      e.stopPropagation();
      if (token === "mini") {
        setMode("mini");
        return;
      }
      applyKey(token);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mode]);

  const panel =
    mode === "open" ? (
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Calculadora"
        data-calc="open"
        className="fixed z-50 w-64 rounded-2xl border border-border bg-card p-2.5 shadow-card outline-none"
        style={{ right: "1rem", bottom: "1rem", animation: "overlay-in 80ms var(--ease-enter)" }}
      >
        <div className="mb-1.5 flex items-center gap-0.5">
          <p className="min-w-0 flex-1 px-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calculadora</p>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Minimizar"
            onClick={() => setMode("mini")}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
            onClick={() => {
              setMode("closed");
              setExpr("");
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-2 rounded-xl bg-muted/80 px-3 py-2 text-right">
          <p className="min-h-5 truncate font-mono text-xs tabular-nums text-muted-foreground">{expr || "0"}</p>
          <p
            className={cn(
              "min-h-8 text-2xl font-semibold tabular-nums leading-tight",
              live.complete ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {live.value != null ? formatNumber(live.value) : "0"}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {KEYS.flat().map((key) => {
            const op = "C⌫()÷×−+=,".includes(key);
            const eq = key === "=";
            return (
              <button
                key={key}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  applyKey(key);
                }}
                className={cn(
                  "flex h-11 items-center justify-center rounded-lg text-sm font-medium tabular-nums [touch-action:manipulation]",
                  eq ? "bg-primary text-primary-foreground" : op ? "bg-muted text-foreground hover:bg-muted/80" : "bg-background text-foreground hover:bg-muted",
                )}
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  const mini =
    mode === "mini" ? (
      <button
        type="button"
        onClick={() => setMode("open")}
        className="fixed z-50 flex h-11 items-center gap-2 rounded-full border border-border bg-card px-3 shadow-card [touch-action:manipulation]"
        style={{ right: "1rem", bottom: "1rem" }}
        aria-label="Restaurar calculadora"
        data-calc="mini"
      >
        <Calculator className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold tabular-nums">
          {live.value != null ? formatNumber(live.value) : "Calc"}
        </span>
      </button>
    ) : null;

  return (
    <>
      <Button
        type="button"
        variant={mode === "open" ? "default" : "outline"}
        onClick={() => setMode(mode === "open" ? "mini" : "open")}
        aria-expanded={mode === "open"}
      >
        <Calculator /> Calculadora
      </Button>
      {typeof document !== "undefined"
        ? createPortal(
            <>
              {panel}
              {mini}
            </>,
            document.body,
          )
        : null}
    </>
  );
}
