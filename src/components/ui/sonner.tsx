import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      duration={2800}
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
