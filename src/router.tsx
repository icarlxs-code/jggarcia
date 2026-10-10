import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const root = typeof document === "undefined" ? null : document.documentElement;
  const plain = !root || root.classList.contains("is-phone") || root.classList.contains("is-lite");
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultViewTransition: !plain,
  });
}
