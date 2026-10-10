import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LottieClip } from "@/components/motion/lottie-clip";

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
  clip,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
  clip?: string;
}) {
  return (
    <div className={cn("jg-empty flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      {clip ? (
        <LottieClip src={clip} className="lottie-clip h-24 w-28" />
      ) : (
        <span className="jg-empty-mark flex h-14 w-14 items-center justify-center rounded-2xl text-primary">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div> : null}
    </div>
  );
}