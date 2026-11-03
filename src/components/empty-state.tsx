import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Glyph } from "@/components/brand/glyph";
import { useCurrentModule } from "@/lib/modules";

/** An empty screen still says where you are: the module's glyph on its own little stage. */
export function EmptyState({
  title,
  description,
  children,
  className,
}: {
  /** Kept for existing call sites; the module glyph is drawn instead. */
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
  clip?: string;
}) {
  const mod = useCurrentModule();
  return (
    <div className={cn("jg-empty flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <div className="empty-stage glyph-host" aria-hidden="true">
        <span className="empty-orbit" />
        <Glyph name={mod.id} live className="empty-glyph" />
      </div>
      <h3 className="mt-5 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div> : null}
    </div>
  );
}
