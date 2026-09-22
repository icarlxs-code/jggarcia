import { type MouseEvent, useRef } from "react";
import { ProductIcon } from "@/components/inventory/product-icon";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function ProductStage({
  nome,
  codigo,
  className,
}: {
  nome: string;
  codigo?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (!fine || reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty("--tilt-x", `${(-y * 14).toFixed(2)}deg`);
    ref.current.style.setProperty("--tilt-y", `${(x * 18).toFixed(2)}deg`);
  }

  function onLeave() {
    if (!ref.current) return;
    ref.current.style.setProperty("--tilt-x", "0deg");
    ref.current.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <div
      ref={ref}
      className={cn("product-stage", reduced && "is-still", className)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      aria-hidden
    >
      <div className="product-stage-orb" />
      <div className="product-stage-floor" />
      <div className="product-stage-spin">
        <ProductIcon nome={nome} codigo={codigo} size="lg" className="h-28 w-28 rounded-none border-0 bg-transparent shadow-none ring-0" />
      </div>
    </div>
  );
}
