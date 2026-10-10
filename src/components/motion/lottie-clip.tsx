import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * Lottie Simple License (uso comercial livre, sem atribuição obrigatória).
 * O clipe segue o estado da tela: loop só enquanto a operação está viva,
 * once quando o fato já aconteceu, hold quando não há nada para animar.
 */
export type ClipMode = "loop" | "once" | "hold";

export function LottieClip({
  src,
  className,
  mode = "once",
}: {
  src: string;
  className?: string;
  mode?: ClipMode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dead = false;
    let item: AnimationItem | null = null;
    const ac = new AbortController();
    const resting = reduced || mode === "hold";

    (async () => {
      try {
        const [mod, res] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          fetch(src, { signal: ac.signal }),
        ]);
        if (dead || !res.ok) return;
        const data = await res.json();
        if (dead || !ref.current) return;
        item = mod.default.loadAnimation({
          container: ref.current,
          renderer: "svg",
          loop: mode === "loop" && !resting,
          autoplay: !resting,
          animationData: data,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        });
        let finished = resting;
        const park = () => {
          if (!item) return;
          finished = true;
          const frames = item.totalFrames || 1;
          const at = resting ? Math.floor(frames * 0.62) : Math.max(0, frames - 1);
          item.goToAndStop(at, true);
        };
        const sync = () => {
          if (!item || finished || resting) return;
          const box = ref.current?.getBoundingClientRect();
          const visible = !!box && box.bottom > 0 && box.top < window.innerHeight && !document.hidden;
          if (visible) item.play();
          else item.pause();
        };
        if (resting) item.addEventListener("DOMLoaded", park);
        else if (mode === "once") item.addEventListener("complete", park);
        document.addEventListener("visibilitychange", sync);
        const io = new IntersectionObserver(() => sync(), { threshold: 0.05 });
        if (ref.current) io.observe(ref.current);
        const stopWatch = () => {
          document.removeEventListener("visibilitychange", sync);
          io.disconnect();
        };
        (item as AnimationItem & { __stopWatch?: () => void }).__stopWatch = stopWatch;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    })();

    return () => {
      dead = true;
      ac.abort();
      (item as (AnimationItem & { __stopWatch?: () => void }) | null)?.__stopWatch?.();
      item?.destroy();
      el.replaceChildren();
    };
  }, [src, reduced, mode]);

  return <div ref={ref} className={className} aria-hidden="true" />;
}

export function OpNote({
  src,
  title,
  detail,
  clipClassName,
  className,
  mode = "once",
}: {
  src: string;
  title: string;
  detail?: string;
  clipClassName?: string;
  className?: string;
  mode?: ClipMode;
}) {
  return (
    <div className={`op-note flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 ${className ?? ""}`}>
      <LottieClip src={src} mode={mode} className={clipClassName ?? "lottie-clip h-16 w-24 shrink-0"} />
      <div className="min-w-0 text-left">
        <p className="text-sm font-semibold">{title}</p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}