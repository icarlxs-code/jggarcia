import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { readUiPrefs, subscribePrefs, writeUiPrefs, type ChartView, type ViewPage } from "@/lib/ui-prefs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PanelsTopLeft } from "lucide-react";

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
    <Select value={vista} onValueChange={(value) => choose(value as ChartView)}>
      <SelectTrigger className="w-44 gap-2" aria-label="Modo de visualização">
        <PanelsTopLeft className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}
