import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import gsap from "gsap";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function PageStage({ children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  useLayoutEffect(() => {
    if (reduced || !root.current) return;
    const context = gsap.context(() => {
      const sections = Array.from(root.current!.children).filter((node) => node.tagName !== "STYLE").slice(0, 8);
      gsap.from(sections, { y: 10, opacity: 0, duration: 0.3, stagger: 0.04, ease: "power2.out", clearProps: "transform,opacity" });
    }, root);
    return () => context.revert();
  }, [reduced]);
  return (
    <div ref={root} className={cn("page-stage jg-page", className)} {...rest}>
      {children}
    </div>
  );
}
