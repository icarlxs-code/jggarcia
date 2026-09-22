import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductIcon } from "@/components/inventory/product-icon";
import { playCeremony, type CeremonyMark } from "@/lib/ceremony";
import { prefersReducedMotion } from "@/lib/motion";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Excluir",
  onConfirm,
  productName,
  initials,
  mark,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  productName?: string;
  initials?: string;
  mark?: CeremonyMark;
}) {
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = previewRef.current;
    if (!open || !el || prefersReducedMotion()) return;
    gsap.fromTo(
      el,
      { y: 18, rotateX: -18, opacity: 0, scale: 0.9 },
      { y: 0, rotateX: 0, opacity: 1, scale: 1, duration: 0.52, ease: "back.out(1.35)", transformOrigin: "50% 80%" },
    );
    return () => {
      gsap.killTweensOf(el);
    };
  }, [open, productName, initials]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="confirm-cinematic">
        {productName || initials ? (
          <div ref={previewRef} className="confirm-preview">
            {productName ? (
              <ProductIcon nome={productName} size="lg" className="h-16 w-16" />
            ) : (
              <span className="confirm-initials">{(initials || "?").slice(0, 2).toUpperCase()}</span>
            )}
          </div>
        ) : null}
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
              playCeremony({
                kind: "delete",
                title: productName || title.replace(/[“”"]/g, "").replace(/^Excluir\s+/i, "").replace(/\?$/, ""),
                subtitle: confirmLabel === "Desfazer" ? "Lançamento desfeito" : "Saiu do cadastro",
                productName,
                initials,
                mark,
              });
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
