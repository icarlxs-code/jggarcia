import type { ComponentType } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  CalendarDays,
  CalendarClock,
  ClipboardCheck,
  Home,
  MapPin,
  Package,
  ScrollText,
  Settings,
  Store,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type IconMotion =
  | "home"
  | "in"
  | "out"
  | "stock"
  | "lot"
  | "count"
  | "package"
  | "pin"
  | "truck"
  | "store"
  | "log"
  | "chart"
  | "users"
  | "gear"
  | "today";

const ICONS: Record<IconMotion, ComponentType<{ className?: string }>> = {
  home: Home,
  in: ArrowDownToLine,
  out: ArrowUpFromLine,
  stock: Warehouse,
  lot: CalendarClock,
  count: ClipboardCheck,
  package: Package,
  pin: MapPin,
  truck: Truck,
  store: Store,
  log: ScrollText,
  chart: BarChart3,
  users: Users,
  gear: Settings,
  today: CalendarDays,
};

export function AnimatedIcon({
  name,
  active,
  size = "nav",
  className,
}: {
  name: IconMotion;
  active?: boolean;
  size?: "nav" | "page";
  className?: string;
}) {
  const Icon = ICONS[name];
  return (
    <span className={cn(size === "page" ? "page-ico" : "nav-ico", `${size}-ico-${name}`, active && "is-active", className)}>
      <Icon />
    </span>
  );
}
