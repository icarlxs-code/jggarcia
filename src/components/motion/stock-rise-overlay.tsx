import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Check } from "lucide-react";
import { ProductIcon } from "@/components/inventory/product-icon";
import { formatNumber } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";
import { pulseDock } from "@/lib/toss";
import { cn } from "@/lib/utils";

export type StockRise = {
  nome: string;
  unidade: string;
  from: number;
  added: number;
  to: number;
};

function dockPoint() {
  const el =
    document.querySelector<HTMLElement>("[data-entrada-dock='true']") ||
    document.querySelector<HTMLElement>('a[href="/entradas"]');
  if (el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight - 36 };
}

export function StockRiseOverlay({
  rise,
  onDone,
}: {
  rise: StockRise | null;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<"in" | "count" | "ok" | "out">("in");
  const veilRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const holeRef = useRef<HTMLDivElement>(null);
  const sparksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rise) return;
    setShown(rise.from);
    setPhase("in");
    const card = cardRef.current;
    const veil = veilRef.current;
    const reduced = prefersReducedMotion();
    if (veil && !reduced) {
      gsap.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power1.out" });
    }
    if (card && !reduced) {
      gsap.fromTo(
        card,
        { y: 42, scale: 0.82, rotateX: -18, opacity: 0 },
        {
          y: 0,
          scale: 1,
          rotateX: 0,
          opacity: 1,
          duration: 0.7,
          ease: "elastic.out(0.78, 0.52)",
          transformOrigin: "50% 60%",
        },
      );
    }
    const enter = window.setTimeout(() => setPhase("count"), reduced ? 40 : 380);
    return () => {
      window.clearTimeout(enter);
      if (card) gsap.killTweensOf(card);
      if (veil) gsap.killTweensOf(veil);
    };
  }, [rise]);

  useEffect(() => {
    if (!rise || phase !== "count") return;
    if (prefersReducedMotion() || rise.to === rise.from) {
      setShown(rise.to);
      setPhase("ok");
      return;
    }
    const start = rise.from;
    const delta = rise.to - rise.from;
    const dur = Math.min(2200, Math.max(1100, Math.abs(delta) * 14));
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - p) ** 4;
      setShown(start + delta * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setPhase("ok");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rise, phase]);

  useEffect(() => {
    if (!rise || phase !== "ok") return;
    const hold = window.setTimeout(() => setPhase("out"), prefersReducedMotion() ? 180 : 560);
    return () => window.clearTimeout(hold);
  }, [rise, phase]);

  useEffect(() => {
    if (!rise || phase !== "out") return;
    const card = cardRef.current;
    const hole = holeRef.current;
    const veil = veilRef.current;
    const sparks = sparksRef.current ? Array.from(sparksRef.current.children) : [];
    const reduced = prefersReducedMotion();

    if (!card || reduced) {
      const end = window.setTimeout(onDone, 200);
      return () => window.clearTimeout(end);
    }

    const dock = dockPoint();
    const box = card.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const dx = dock.x - cx;
    const dy = dock.y - cy;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      pulseDock();
      onDone();
    };

    gsap.set(card, { transformPerspective: 1400, transformOrigin: "50% 100%", force3D: true });
    if (hole) {
      gsap.set(hole, {
        left: dock.x,
        top: dock.y,
        xPercent: -50,
        yPercent: -50,
        scaleX: 0,
        scaleY: 0,
        opacity: 0,
      });
    }
    sparks.forEach((s, i) => {
      gsap.set(s, {
        x: (Math.random() - 0.5) * 48,
        y: (Math.random() - 0.5) * 28,
        scale: 0.4 + Math.random() * 0.7,
        opacity: 0,
      });
      void i;
    });

    const tl = gsap.timeline({
      onComplete: finish,
    });

    tl.to(
      card,
      {
        scaleX: 1.08,
        scaleY: 0.88,
        duration: 0.18,
        ease: "power2.out",
      },
      0,
    );

    if (hole) {
      tl.to(
        hole,
        {
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          duration: 0.32,
          ease: "back.out(2.1)",
        },
        0.06,
      );
    }

    tl.to(
      card,
      {
        x: dx * 0.22,
        y: dy * 0.16,
        scaleX: 0.72,
        scaleY: 1.18,
        rotateX: 18,
        rotateZ: -8,
        duration: 0.34,
        ease: "power3.inOut",
      },
      0.14,
    );

    tl.to(
      sparks,
      {
        opacity: 0.95,
        duration: 0.12,
        stagger: 0.02,
      },
      0.28,
    );

    tl.to(
      card,
      {
        x: dx,
        y: dy + 6,
        scaleX: 0.07,
        scaleY: 0.07,
        rotateX: 72,
        rotateZ: 16,
        opacity: 0,
        duration: 0.58,
        ease: "power4.in",
      },
      0.4,
    );

    tl.to(
      sparks,
      {
        x: (i) => dx + Math.sin(i) * 10,
        y: dy + 4,
        scale: 0,
        opacity: 0,
        duration: 0.5,
        stagger: 0.025,
        ease: "power3.in",
      },
      0.42,
    );

    if (hole) {
      tl.to(
        hole,
        {
          scaleX: 0,
          scaleY: 0,
          opacity: 0,
          duration: 0.26,
          ease: "power2.in",
        },
        0.82,
      );
    }

    if (veil) {
      tl.to(veil, { opacity: 0, duration: 0.28, ease: "power1.out" }, 0.78);
    }

    const fallback = window.setTimeout(finish, 1400);
    return () => {
      window.clearTimeout(fallback);
      tl.kill();
    };
  }, [rise, phase, onDone]);

  if (!rise) return null;

  const unidade = rise.unidade || "cx";

  return (
    <div ref={veilRef} className={cn("stock-rise", `is-${phase}`)} role="status" aria-live="polite">
      <div ref={holeRef} className="stock-rise-hole" aria-hidden />
      <div ref={sparksRef} className="stock-rise-sparks" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <div ref={cardRef} className="stock-rise-card">
        <div className={cn("stock-rise-icon", (phase === "ok" || phase === "out") && "is-ok")}>
          <ProductIcon nome={rise.nome} size="lg" className="h-20 w-20 shadow-none" />
          {phase === "ok" || phase === "out" ? (
            <span className="stock-rise-check">
              <Check strokeWidth={2.6} />
            </span>
          ) : null}
        </div>
        <p className="stock-rise-name">{rise.nome}</p>
        <p className="stock-rise-delta">
          +{formatNumber(rise.added)} {unidade}
        </p>
        <p className={cn("stock-rise-count", phase === "count" && "is-ticking")}>
          {formatNumber(Math.round(shown))}
          <span> {unidade}</span>
        </p>
        <p className="stock-rise-hint">
          {phase === "ok" || phase === "out" ? "Entrada confirmada" : `${formatNumber(rise.from)} → ${formatNumber(rise.to)}`}
        </p>
      </div>
    </div>
  );
}
