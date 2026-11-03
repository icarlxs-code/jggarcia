import type { ReactNode } from "react";
import { AnimatedIcon, type IconMotion } from "@/components/motion/animated-icon";
import { LottieClip } from "@/components/motion/lottie-clip";

export function PageHeader({
  title,
  description,
  icon,
  clip,
  children,
}: {
  title: string;
  description?: string;
  icon?: IconMotion;
  clip?: string;
  /** Kept for existing call sites; every page now shares one mark size. */
  clipClassName?: string;
  children?: ReactNode;
}) {
  const mark = clip ? (
    <LottieClip src={clip} className="lottie-clip h-[4.5rem] w-[4.5rem] shrink-0" />
  ) : icon ? (
    <AnimatedIcon name={icon} size="page" active />
  ) : null;
  return (
    <div className="page-hero flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {mark ? (
          <span className="page-mark" aria-hidden="true">
            {mark}
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-desc mt-1 max-w-2xl">{description}</p> : null}
        </div>
      </div>
      {children ? <div className="page-actions flex shrink-0 flex-wrap items-center gap-2" role="group" aria-label="Ações da página">{children}</div> : null}
    </div>
  );
}
