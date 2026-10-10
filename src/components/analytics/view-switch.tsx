import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { readUiPrefs, subscribePrefs, writeUiPrefs, type ChartView, type ViewPage } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

const OPTIONS: { id: ChartView; label: string }[] = [
  { id: "lista", label: "Lista" },
  { id: "graficos", label: "Gráficos" },
  { id: "ambos", label: "Ambos" },
];

export function useChartView(page: ViewPage) {
  const { perfil } = useSession();
  const [vista, setVista] = useState<ChartView>(() => readUiPrefs(perfil?.id).vistas[page] ?? "lista");
  useEffect(() => {
    const read = () => setVista(readUiPrefs(perfil?.id).vistas[page] ?? "lista");
    read();
    return subscribePrefs(read);
  }, [perfil?.id, page]);
  function choose(next: ChartView) {
    setVista(next);
    writeUiPrefs(perfil?.id, { vistas: { [page]: next }, chartViewRev: 2 });
  }
  return { vista, choose };
}

export function ViewSwitch({ page }: { page: ViewPage }) {
  const { vista, choose } = useChartView(page);
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-0.5" role="group" aria-label="Modo de visualização">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={vista === o.id}
          onClick={() => choose(o.id)}
          className={cn(
            "h-10 rounded-full px-3 text-xs font-medium transition-colors duration-200",
            vista === o.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
