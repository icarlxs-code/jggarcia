import { createFileRoute } from "@tanstack/react-router";

const BUILD_ID = (import.meta.env as { VITE_BUILD_ID?: string }).VITE_BUILD_ID || "dev";

export const Route = createFileRoute("/api/versao")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { id: BUILD_ID },
          {
            headers: {
              "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
              pragma: "no-cache",
            },
          },
        ),
    },
  },
});
