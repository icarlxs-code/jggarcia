import type { ReactNode } from "react";
import type { IconMotion } from "@/components/motion/animated-icon";
import { Glyph } from "@/components/brand/glyph";
import { useCurrentModule } from "@/lib/modules";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  /** Kept for existing call sites; the module glyph now marks every page. */
  icon?: IconMotion;
  clip?: string;
  clipClassName?: string;
  children?: ReactNode;
}) {
  const mod = useCurrentModule();
  return (
    <div className="page-hero flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <span className="page-mark glyph-host" aria-hidden="true">
          <Glyph name={mod.id} live />
        </span>
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-desc mt-1 max-w-2xl">{description}</p> : null}
        </div>
      </div>
      {children ? <div className="page-actions flex shrink-0 flex-wrap items-center gap-2" role="group" aria-label="Ações da página">{children}</div> : null}
    </div>
  );
}
