import { useEffect, useRef } from "react";

const KEY = "jg-ctx-edit";
export const CTX_EDIT_EVENT = "jg-ctx-edit";

export function queueEdit(kind: string, id: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ kind, id }));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CTX_EDIT_EVENT, { detail: { kind, id } }));
}

export function takeQueuedEdit(kind: string) {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { kind?: string; id?: string };
    if (parsed.kind !== kind || !parsed.id) return null;
    sessionStorage.removeItem(KEY);
    return parsed.id;
  } catch {
    return null;
  }
}

export function useQueuedEdit(kind: string, onId: (id: string) => void) {
  const ref = useRef(onId);
  ref.current = onId;
  useEffect(() => {
    const pending = takeQueuedEdit(kind);
    if (pending) ref.current(pending);
    const fn = (e: Event) => {
      const detail = (e as CustomEvent<{ kind?: string; id?: string }>).detail;
      if (detail?.kind === kind && detail.id) {
        takeQueuedEdit(kind);
        ref.current(detail.id);
      }
    };
    window.addEventListener(CTX_EDIT_EVENT, fn);
    return () => window.removeEventListener(CTX_EDIT_EVENT, fn);
  }, [kind]);
}
