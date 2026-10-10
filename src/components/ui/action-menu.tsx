import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ActionMenu({ children, label = "Mais ações", ariaLabel }: { children: ReactNode; label?: string; ariaLabel?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={ariaLabel ?? label}>
          <MoreHorizontal aria-hidden="true" /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="action-menu">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
