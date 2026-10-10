import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { activePrefs, subscribePrefs, toggleUserTheme } from "@/lib/ui-prefs";
import type { ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const sync = () => setMode(activePrefs().tema === "dark" ? "dark" : "light");
    sync();
    return subscribePrefs(sync);
  }, []);

  const dark = mode === "dark";

  const last = useRef(0);
  function press() {
    const now = Date.now();
    if (now - last.current < 350) return;
    last.current = now;
    setMode(toggleUserTheme());
  }

  return (
    <button
      type="button"
      className={cn("theme-switch", dark && "is-dark", className)}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo noturno"}
      aria-pressed={dark}
      onPointerUp={press}
      onClick={press}
    >
      <span className="theme-switch-track" aria-hidden>
        <Sun />
        <Moon />
      </span>
      <span className="theme-switch-knob" aria-hidden />
    </button>
  );
}
