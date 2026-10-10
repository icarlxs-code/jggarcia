import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("jg-skeleton rounded-md bg-muted", className)} />;
}
