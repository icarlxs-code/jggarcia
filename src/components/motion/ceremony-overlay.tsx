import { useEffect, useRef } from "react";
import gsap from "gsap";
import { MapPin, Package, Truck, User, Warehouse } from "lucide-react";
import { ProductIcon } from "@/components/inventory/product-icon";
import { useCeremonyEvent, type CeremonyEvent, type CeremonyMark } from "@/lib/ceremony";
import { prefersReducedMotion } from "@/lib/motion";
import { pulseDock } from "@/lib/toss";
import { cn } from "@/lib/utils";

function dockPoint(selector?: string) {
  const el =
    (selector ? document.querySelector<HTMLElement>(selector) : null) ||
    document.querySelector<HTMLElement>(".jg-main") ||
    document.querySelector<HTMLElement>("[data-entrada-dock='true']");
  if (el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.22 };
}

function Mark({ event }: { event: CeremonyEvent }) {
  if (event.productName) {
    return <ProductIcon nome={event.productName} size="lg" className="h-24 w-24 rounded-none border-0 bg-transparent shadow-none ring-0" />;
  }
  if (event.initials) {
    return <span className="ceremony-initials">{event.initials.slice(0, 2).toUpperCase()}</span>;
  }
  const Icon = iconFor(event.mark);
  return (
    <span className="ceremony-glyph">
      <Icon />
    </span>
  );
}

function iconFor(mark?: CeremonyMark) {
  if (mark === "person") return User;
  if (mark === "client") return MapPin;
  if (mark === "truck") return Truck;
  if (mark === "store") return Warehouse;
  return Package;
}

function kickerOf(event: CeremonyEvent) {
  if (event.kind === "create") return "Cadastrado";
  if (event.kind === "delete") return "Removido";
  if (event.desconta === false) return "Registro criado";
  if (event.transfer) return "Transferência";
  return "Saiu";
}

function ClockDigit({ d, delay }: { d: string; delay: string }) {
  const n = Math.min(9, Math.max(0, Number(d) || 0));
  return (
    <span className="clock-digit" style={{ ["--to" as string]: n, ["--delay" as string]: delay }}>
      <span className="clock-digit-col">
        {Array.from({ length: 10 }, (_, i) => (
          <b key={i}>{i}</b>
        ))}
      </span>
    </span>
  );
}

function ClockFace({ time }: { time?: string }) {
  if (!time) return null;
  const raw = time.replace(/\D/g, "").padStart(4, "0").slice(-4);
  return (
    <span className="clock-face" aria-label={time}>
      <ClockDigit d={raw[0]} delay="0ms" />
      <ClockDigit d={raw[1]} delay="80ms" />
      <span className="clock-colon">:</span>
      <ClockDigit d={raw[2]} delay="160ms" />
      <ClockDigit d={raw[3]} delay="240ms" />
    </span>
  );
}

function StopMark({ logo, transfer }: { logo?: string; transfer?: boolean }) {
  if (logo) {
    return <img src={logo} alt="" className={cn("dispatch-logo", transfer && "is-lg")} />;
  }
  return transfer ? <Warehouse /> : <MapPin />;
}

export function CeremonyOverlay() {
  const { event, clear } = useCeremonyEvent();
  const veilRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const holeRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const sparksRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);
  const shipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!event) return;
    const reduced = prefersReducedMotion();
    const card = cardRef.current;
    const veil = veilRef.current;
    const hole = holeRef.current;
    const halo = haloRef.current;
    const sparks = sparksRef.current ? Array.from(sparksRef.current.children) : [];
    const ship = shipRef.current;
    const fromEl = fromRef.current;
    const toEl = toRef.current;
    const phone = document.documentElement.classList.contains("is-phone");
    const transfer = event.kind === "dispatch" && Boolean(event.transfer);

    if (reduced) {
      const t = window.setTimeout(clear, 280);
      return () => window.clearTimeout(t);
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (event.kind === "create") pulseDock();
      if (event.kind === "dispatch") pulseDock();
      clear();
    };

    gsap.set(card, { transformPerspective: 1400, force3D: true });

    const tl = gsap.timeline({ onComplete: finish });

    if (veil) {
      tl.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.24, ease: "power1.out" }, 0);
    }

    if (event.kind === "dispatch") {
      if (fromEl) tl.fromTo(fromEl, { y: 22, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.42, ease: "power3.out" }, 0.06);
      if (toEl) tl.fromTo(toEl, { y: 22, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, duration: 0.42, ease: "power3.out" }, 0.16);
      if (card) {
        tl.fromTo(card, { y: 24, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" }, 0.14);
      }
      if (fromEl && transfer) {
        tl.to(fromEl, { scale: 0.96, duration: 0.2, ease: "power1.out" }, 0.42);
        tl.to(fromEl, { scale: 1, duration: 0.35, ease: "power2.out" }, 0.64);
      }
      if (ship && !phone && event.desconta !== false) {
        const origin = fromEl?.getBoundingClientRect();
        const dest = toEl?.getBoundingClientRect();
        const sx = origin ? origin.left + origin.width / 2 - window.innerWidth / 2 : -160;
        const sy = origin ? origin.top - window.innerHeight * 0.42 : -40;
        const ex = dest ? dest.left + dest.width / 2 - window.innerWidth / 2 : 160;
        const ey = dest ? dest.top - window.innerHeight * 0.42 : -40;
        const arc = transfer ? 96 : 72;
        gsap.set(ship, { x: sx, y: sy, scale: 0.72, opacity: 0, rotate: -10 });
        tl.to(ship, { opacity: 1, scale: 1.08, duration: 0.2, ease: "power2.out" }, 0.16);
        tl.to(ship, { x: (sx + ex) / 2, y: Math.min(sy, ey) - arc, rotate: 4, duration: 0.32, ease: "power2.out" }, 0.3);
        tl.to(ship, { x: ex, y: ey, rotate: 12, scale: 0.9, duration: 0.36, ease: "power2.inOut" }, 0.58);
        tl.to(ship, { scale: 0.18, opacity: 0, duration: 0.18, ease: "power2.in" }, 0.9);
      }
      if (toEl && transfer) {
        tl.fromTo(toEl, { boxShadow: "0 16px 40px -24px rgb(0 0 0 / 0.55)" }, { scale: 1.06, duration: 0.16, ease: "power2.out" }, 0.88);
        tl.to(toEl, { scale: 1, duration: 0.2, ease: "power2.out" }, 1.02);
      }
      sparks.forEach((s, i) => {
        gsap.set(s, { x: (i - 4.5) * 14, y: -10, scale: 0.3, opacity: 0 });
        tl.to(
          s,
          {
            x: (i - 4.5) * 32,
            y: -32 - (i % 3) * 12,
            opacity: 0.95,
            scale: 0.85,
            duration: 0.32,
            ease: "power2.out",
          },
          0.42 + i * 0.02,
        );
      });
      tl.to(sparks, { opacity: 0, y: -56, duration: 0.24, ease: "power1.in" }, 0.92);
      if (veil) tl.to(veil, { opacity: 0, duration: 0.22, ease: "power1.out" }, transfer ? 1.12 : 1.0);
    } else if (event.kind === "create") {
      if (halo) {
        gsap.set(halo, { scale: 0.4, opacity: 0 });
        tl.to(halo, { scale: 1, opacity: 1, duration: 0.55, ease: "power2.out" }, 0.04);
      }
      if (card) {
        tl.fromTo(
          card,
          { y: 64, scale: 0.78, rotateX: -26, opacity: 0 },
          {
            y: 0,
            scale: 1,
            rotateX: 0,
            opacity: 1,
            duration: 0.72,
            ease: "elastic.out(0.76, 0.54)",
            transformOrigin: "50% 70%",
          },
          0.08,
        );
      }
      sparks.forEach((s, i) => {
        const ang = (i / sparks.length) * Math.PI * 2;
        gsap.set(s, { x: 0, y: 0, scale: 0.2, opacity: 0 });
        tl.to(
          s,
          {
            x: Math.cos(ang) * (48 + (i % 3) * 14),
            y: Math.sin(ang) * (28 + (i % 2) * 16),
            scale: 0.7 + (i % 3) * 0.25,
            opacity: 0.95,
            duration: 0.28,
            ease: "power2.out",
          },
          0.42,
        );
      });
      tl.to(sparks, { opacity: 0, scale: 0, duration: 0.35, ease: "power1.in" }, 0.92);

      const dock = dockPoint(event.dock);
      const box = card?.getBoundingClientRect();
      const cx = box ? box.left + box.width / 2 : window.innerWidth / 2;
      const cy = box ? box.top + box.height / 2 : window.innerHeight / 2;
      const dx = dock.x - cx;
      const dy = dock.y - cy;

      tl.to(card, { scaleX: 1.06, scaleY: 0.92, duration: 0.16, ease: "power2.out" }, 1.12);
      tl.to(
        card,
        {
          x: dx,
          y: dy,
          scale: 0.08,
          rotateX: 48,
          rotateZ: 12,
          opacity: 0,
          duration: 0.62,
          ease: "power4.in",
        },
        1.28,
      );
      if (halo) tl.to(halo, { scale: 1.35, opacity: 0, duration: 0.4, ease: "power2.in" }, 1.28);
      if (veil) tl.to(veil, { opacity: 0, duration: 0.28, ease: "power1.out" }, 1.62);
    } else {
      if (card) {
        tl.fromTo(
          card,
          { y: 18, scale: 0.94, rotateX: 8, opacity: 0 },
          { y: 0, scale: 1, rotateX: 0, opacity: 1, duration: 0.38, ease: "power3.out" },
          0.04,
        );
      }
      if (hole) {
        gsap.set(hole, {
          left: "50%",
          top: "72%",
          xPercent: -50,
          yPercent: -50,
          scale: 0,
          opacity: 0,
        });
        tl.to(hole, { scale: 1, opacity: 1, duration: 0.32, ease: "back.out(2)" }, 0.28);
      }
      sparks.forEach((s, i) => {
        gsap.set(s, { x: (i - 5) * 8, y: 8, scale: 0.35, opacity: 0 });
        tl.to(s, { opacity: 0.7, duration: 0.12 }, 0.42 + i * 0.012);
      });
      tl.to(card, { scaleX: 1.1, scaleY: 0.82, rotateZ: -4, duration: 0.18, ease: "power2.out" }, 0.46);
      tl.to(
        card,
        {
          y: 86,
          scaleX: 0.12,
          scaleY: 0.08,
          rotateX: 68,
          rotateZ: 10,
          opacity: 0,
          filter: "blur(8px) saturate(0.2)",
          duration: 0.56,
          ease: "power4.in",
        },
        0.64,
      );
      tl.to(
        sparks,
        {
          y: 90,
          scale: 0,
          opacity: 0,
          duration: 0.48,
          stagger: 0.018,
          ease: "power3.in",
        },
        0.66,
      );
      if (hole) tl.to(hole, { scale: 0, opacity: 0, duration: 0.26, ease: "power2.in" }, 1.08);
      if (veil) tl.to(veil, { opacity: 0, duration: 0.26, ease: "power1.out" }, 1.04);
    }

    const fallback = window.setTimeout(
      finish,
      event.kind === "dispatch" ? (transfer ? 1500 : 1300) : event.kind === "create" ? 2200 : 1600,
    );
    return () => {
      window.clearTimeout(fallback);
      tl.kill();
    };
  }, [event, clear]);

  if (!event) return null;

  return (
    <div
      ref={veilRef}
      className={cn(
        "ceremony",
        event.kind === "delete" && "is-delete",
        event.kind === "dispatch" && "is-dispatch",
        event.kind === "dispatch" && event.transfer && "is-transfer",
        event.kind === "dispatch" && event.desconta === false && "is-record",
      )}
      role="status"
      aria-live="polite"
    >
      <div ref={holeRef} className="ceremony-hole" aria-hidden />
      <div ref={haloRef} className="ceremony-halo" aria-hidden />
      <div ref={sparksRef} className="ceremony-sparks" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      {event.kind === "dispatch" ? (
        <div className="dispatch-stage">
          <div ref={fromRef} className="dispatch-stop">
            {event.fromLogo ? (
              <img src={event.fromLogo} alt="" className="dispatch-logo" />
            ) : (
              <Warehouse />
            )}
            <div>
              <p className="dispatch-kicker">Saiu de</p>
              <p className="dispatch-name">{event.fromLabel || "Origem"}</p>
              <ClockFace time={event.fromTime} />
            </div>
          </div>
          <div className="dispatch-rail" aria-hidden />
          <div ref={toRef} className="dispatch-stop is-to">
            <StopMark logo={event.toLogo} transfer={event.transfer} />
            <div>
              <p className="dispatch-kicker">{event.transfer ? "Chegou em" : "Chegou em"}</p>
              <p className="dispatch-name">{event.toLabel || "Destino"}</p>
              <ClockFace time={event.toTime} />
            </div>
          </div>
          <div ref={shipRef} className="dispatch-ship" aria-hidden>
            {event.desconta === false ? null : event.productName ? <ProductIcon nome={event.productName} size="lg" className="h-20 w-20 rounded-none border-0 bg-transparent shadow-none ring-0" /> : <Package />}
          </div>
        </div>
      ) : null}
      <div ref={cardRef} className="ceremony-card">
        <div className="ceremony-icon">
          <Mark event={event} />
        </div>
        <p className="ceremony-kicker">{kickerOf(event)}</p>
        <p className="ceremony-title">{event.title}</p>
        {event.subtitle ? <p className="ceremony-sub">{event.subtitle}</p> : null}
      </div>
    </div>
  );
}
