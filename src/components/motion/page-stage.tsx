import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageStage({ children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("page-stage jg-page", className)} {...rest}>
      {children}
    </div>
  );
}
