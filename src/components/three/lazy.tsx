import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import type { PavilionStack } from "./scenes";

// three.js only ever loads in the browser, on demand.
const Warehouse = lazy(() => import("./scenes").then((m) => ({ default: m.WarehouseScene })));
const Produce = lazy(() => import("./scenes").then((m) => ({ default: m.ProduceScene })));
const Orb = lazy(() => import("./scenes").then((m) => ({ default: m.OrbScene })));

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** A failed scene shows its fallback instead of taking the page down. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function useClient3D() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(webglOk()), []);
  return ok;
}

function Mount({ fallback = null, children }: { fallback?: ReactNode; children: ReactNode }) {
  const ok = useClient3D();
  if (!ok) return <>{fallback}</>;
  return (
    <SceneBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </SceneBoundary>
  );
}

export function Warehouse3D({ pavilions, fallback }: { pavilions: PavilionStack[]; fallback?: ReactNode }) {
  const lite = usePrefersReducedMotion();
  return (
    <Mount fallback={fallback}>
      <Warehouse pavilions={pavilions} lite={lite} />
    </Mount>
  );
}

export function Produce3D() {
  const lite = usePrefersReducedMotion();
  return (
    <Mount>
      <Produce lite={lite} />
    </Mount>
  );
}

export function Orb3D({ fallback }: { fallback?: ReactNode }) {
  const lite = usePrefersReducedMotion();
  return (
    <Mount fallback={fallback}>
      <Orb lite={lite} />
    </Mount>
  );
}

export type { PavilionStack };
