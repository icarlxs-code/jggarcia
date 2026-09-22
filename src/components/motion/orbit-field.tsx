import { ProductIcon } from "@/components/inventory/product-icon";
import { usePrefersReducedMotion } from "@/lib/motion";

export function OrbitField({ names }: { names: string[] }) {
  const reduced = usePrefersReducedMotion();
  const items = names.filter(Boolean).slice(0, 7);
  if (items.length < 3 || reduced) return null;

  return (
    <div className="orbit-field" aria-hidden>
      {items.map((nome, i) => (
        <span key={`${nome}-${i}`} className={`orbit-item orbit-item-${i + 1}`}>
          <ProductIcon nome={nome} size="sm" className="h-9 w-9 rounded-xl ring-0" />
        </span>
      ))}
    </div>
  );
}
