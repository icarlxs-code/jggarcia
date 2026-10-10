import type { ReactNode } from "react";
import { AnimatedIcon, type IconMotion } from "@/components/motion/animated-icon";
import { LottieClip } from "@/components/motion/lottie-clip";

export function PageHeader({
  title,
  description,
  icon,
  clip,
  clipClassName,
  children,
}: {
  title: string;
  description?: string;
  icon?: IconMotion;
  clip?: string;
  clipClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-hero flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {clip ? (
            <LottieClip src={clip} className={clipClassName ?? "lottie-clip h-10 w-12 shrink-0"} />
          ) : icon ? (
            <AnimatedIcon name={icon} size="page" active />
          ) : null}
          {title}
        </h1>
        {description ? <p className="page-desc mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="page-actions flex shrink-0 flex-wrap items-center gap-2" role="group" aria-label="Ações da página">{children}</div> : null}
    </div>
  );
}
