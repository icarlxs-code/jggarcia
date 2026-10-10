import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { activePrefs } from "@/lib/ui-prefs";

export type CeremonyKind = "create" | "delete" | "dispatch";
export type CeremonyMark = "product" | "person" | "client" | "truck" | "store";

export type CeremonyPayload = {
  kind: CeremonyKind;
  title: string;
  subtitle?: string;
  productName?: string;
  initials?: string;
  mark?: CeremonyMark;
  dock?: string;
  fromLabel?: string;
  toLabel?: string;
  fromTime?: string;
  toTime?: string;
  desconta?: boolean;
  fromLogo?: string;
  toLogo?: string;
  transfer?: boolean;
};

export type CeremonyEvent = CeremonyPayload & { id: string };

type Listener = (event: CeremonyEvent | null) => void;

const listeners = new Set<Listener>();
let seq = 0;

export function playCeremony(payload: CeremonyPayload) {
  if (typeof window === "undefined") return;
  if (activePrefs().sistemaLite || prefersReducedMotion()) return;
  if (!activePrefs().som) return;
  seq += 1;
  const event: CeremonyEvent = { ...payload, id: String(seq) };
  listeners.forEach((fn) => fn(event));
}

export function subscribeCeremony(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function ceremonyDock(href: string) {
  return `a[href="${href}"]`;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function useCeremony() {
  return { play: playCeremony };
}

export function useCeremonyEvent() {
  const [event, setEvent] = useState<CeremonyEvent | null>(null);
  useEffect(() => subscribeCeremony(setEvent), []);
  return {
    event,
    clear: () => setEvent(null),
    reduced: prefersReducedMotion(),
  };
}
