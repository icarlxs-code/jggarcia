import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import gsap from "gsap";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Grids and card rows reveal child by child; everything else as one block. */
function revealTargets(root: HTMLElement) {
  const out: Element[] = [];
  const sections = Array.from(root.children).filter((node) => node.tagName !== "STYLE").slice(0, 10);
  for (const section of sections) {
    const el = section as HTMLElement;
    const isGrid = /\bgrid\b/.test(el.className) && el.children.length > 1 && el.children.length <= 12;
    if (isGrid) out.push(...Array.from(el.children));
    else out.push(el);
  }
  return out.slice(0, 24);
}

export function PageStage({ children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  useLayoutEffect(() => {
    if (reduced || !root.current) return;
    const context = gsap.context(() => {
      const targets = revealTargets(root.current!);
      gsap.fromTo(
        targets,
        { y: 22, opacity: 0, scale: 0.985, filter: "blur(6px)" },
        { y: 0, opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.62, stagger: 0.055, ease: "expo.out", clearProps: "transform,opacity,filter" },
      );
      // Table rows arrive in a quick cascade (first screenful only).
      const rows = Array.from(root.current!.querySelectorAll(".jg-table-wrap tbody tr")).slice(0, 14);
      if (rows.length) {
        gsap.fromTo(rows, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.42, stagger: 0.025, delay: 0.18, ease: "power3.out", clearProps: "transform,opacity" });
      }
    }, root);
    return () => context.revert();
  }, [reduced]);
  return (
    <div ref={root} className={cn("page-stage jg-page", className)} {...rest}>
      {children}
    </div>
  );
}
