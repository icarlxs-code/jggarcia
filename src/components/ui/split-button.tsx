import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * The page's main action plus its close relatives: one primary button and a
 * chevron that opens related actions, joined as a single control.
 */
export function SplitButton({
  children,
  menu,
  menuLabel = "Mais opções",
  className,
}: {
  /** The primary action: a Button (or Button asChild with a Link). */
  children: ReactNode;
  /** DropdownMenuItem elements. */
  menu: ReactNode;
  menuLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("split-button", className)} role="group">
      {children}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={menuLabel} className="split-button-toggle">
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="action-menu">
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
