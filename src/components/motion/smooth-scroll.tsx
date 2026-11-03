import { useEffect, type RefObject } from "react";
import Lenis from "lenis";
import { useRouterState } from "@tanstack/react-router";
import { canHoverFine, usePrefersReducedMotion } from "@/lib/motion";

/** Inertial scrolling for the workspace on mouse/trackpad; touch keeps native scroll. */
export function SmoothScroll({ wrapper, content }: { wrapper: RefObject<HTMLElement | null>; content: RefObject<HTMLElement | null> }) {
  const reduced = usePrefersReducedMotion();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (reduced || !canHoverFine() || !wrapper.current || !content.current) return;
    const lenis = new Lenis({
      wrapper: wrapper.current,
      content: content.current,
      lerp: 0.11,
      wheelMultiplier: 0.95,
      allowNestedScroll: true,
      autoRaf: true,
      // Popovers, dialogs and anything marked keep their own scroll.
      prevent: (node) => Boolean(node.closest?.("[data-radix-popper-content-wrapper], [role='dialog'], [role='listbox'], [data-lenis-prevent], .jg-table-wrap")),
    });
    return () => lenis.destroy();
  }, [reduced, wrapper, content]);

  // A new page starts at the top.
  useEffect(() => {
    wrapper.current?.scrollTo({ top: 0 });
  }, [pathname, wrapper]);

  return null;
}
