import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, readTheme, toggleTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const current = readTheme();
    applyTheme(current);
    setMode(current);
  }, []);

  const dark = mode === "dark";

  return (
    <button
      type="button"
      className={cn("theme-switch", dark && "is-dark", className)}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo noturno"}
      aria-pressed={dark}
      onClick={() => setMode(toggleTheme())}
    >
      <span className="theme-switch-track" aria-hidden>
        <Sun />
        <Moon />
      </span>
      <span className="theme-switch-knob" aria-hidden />
    </button>
  );
}
