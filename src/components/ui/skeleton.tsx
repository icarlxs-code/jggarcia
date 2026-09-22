import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-muted", className)} style={{ animation: "skeleton-pulse 1.4s ease-in-out infinite" }} />;
}
