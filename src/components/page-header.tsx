import type { ReactNode } from "react";
import { AnimatedIcon, type IconMotion } from "@/components/motion/animated-icon";

export function PageHeader({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: IconMotion;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:gap-2.5 sm:text-2xl">
          {icon ? <AnimatedIcon name={icon} size="page" active /> : null}
          {title}
        </h1>
        {description ? <p className="page-desc mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
