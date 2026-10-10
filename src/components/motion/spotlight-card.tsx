import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function SpotlightCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("spot-card rounded-2xl border border-border bg-card shadow-card", className)} {...props}>
      {children}
    </div>
  );
}