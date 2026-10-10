import { useEffect, useRef, useState } from "react";

export function useRowUpdates(rows: readonly { id: string }[]) {
  const previous = useRef<Map<string, string> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(() => new Set());
  const fingerprint = JSON.stringify(rows.map((row) => [row.id, JSON.stringify(row)]));

  useEffect(() => {
    const next = new Map<string, string>(JSON.parse(fingerprint));
    const updates = new Set<string>();
    if (previous.current) {
      for (const [id, value] of next) {
        if (previous.current.get(id) !== value) updates.add(id);
      }
    }
    previous.current = next;
    setChanged(updates);
    if (!updates.size) return;
    const timer = window.setTimeout(() => setChanged(new Set()), 900);
    return () => window.clearTimeout(timer);
  }, [fingerprint]);

  return changed;
}
