import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetTitle = DialogPrimitive.Title;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "left" | "right" | "bottom" }
>(({ className, children, side = "left", style, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-forest/50" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col shadow-card",
        side === "left" && "inset-y-0 left-0 h-full w-72 bg-sidebar text-sidebar-foreground",
        side === "right" && "inset-y-0 right-0 h-full w-full max-w-md bg-card text-foreground",
        side === "bottom" && "inset-x-0 bottom-0 z-[90] max-h-[85dvh] rounded-t-2xl bg-card text-foreground",
        className,
      )}
      style={{
        animation:
          side === "right"
            ? "drawer-in 320ms cubic-bezier(0.16, 1, 0.3, 1)"
            : side === "bottom"
              ? "sheet-up 340ms cubic-bezier(0.16, 1, 0.3, 1)"
              : "drawer-left 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        ...style,
      }}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle };
