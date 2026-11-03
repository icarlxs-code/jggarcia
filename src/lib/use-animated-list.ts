import { useEffect } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { usePrefersReducedMotion } from "@/lib/motion";

/** Ref for a list whose items slide in, out and into new order instead of jumping. */
export function useAnimatedList<T extends HTMLElement = HTMLUListElement>() {
  const reduced = usePrefersReducedMotion();
  const [ref, enable] = useAutoAnimate<T>({ duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)", disrespectUserMotionPreference: true });
  useEffect(() => enable(!reduced), [enable, reduced]);
  return ref;
}
