import { useEffect, useState } from "react";
import { applyViewport, getViewport, readViewportPref, resolveViewport, subscribeViewport, type ViewportKind } from "./viewport";

export function useViewport(): ViewportKind {
  // Always start as computer so SSR HTML and the first client paint match.
  // The inline boot script already toggles html.is-phone; CSS hides phone-only chrome.
  const [kind, setKind] = useState<ViewportKind>("computer");

  useEffect(() => {
    applyViewport(readViewportPref());
    setKind(getViewport());
    const unsub = subscribeViewport(() => setKind(getViewport()));
    const onResize = () => {
      if (readViewportPref() !== "auto") return;
      const next = resolveViewport("auto");
      if (next !== getViewport()) applyViewport("auto");
    };
    window.addEventListener("resize", onResize);
    return () => {
      unsub();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return kind;
}
