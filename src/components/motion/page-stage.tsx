import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageStage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("page-stage", className)}>{children}</div>;
}
