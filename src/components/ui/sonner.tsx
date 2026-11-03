import { Toaster as Sonner } from "sonner";
import { StatusGlyph } from "@/components/brand/glyph";

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      duration={2800}
      icons={{
        success: <StatusGlyph name="sucesso" />,
        error: <StatusGlyph name="erro" />,
        warning: <StatusGlyph name="alerta" />,
        info: <StatusGlyph name="info" />,
        loading: <StatusGlyph name="carregando" />,
      }}
      toastOptions={{
        classNames: {
          toast: "glass-1 text-card-foreground shadow-card",
          title: "text-sm font-medium",
          description: "text-sm text-muted-foreground",
          success: "border-primary/30",
          error: "border-destructive/30",
        },
      }}
    />
  );
}
