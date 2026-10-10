import { createFileRoute } from "@tanstack/react-router";
import { parseUserAgent } from "@/lib/device-meta";

function ipFrom(request: Request) {
  const h = request.headers;
  const forwarded = h.get("x-forwarded-for") || h.get("x-real-ip") || h.get("cf-connecting-ip") || "";
  return forwarded.split(",")[0]?.trim() || "desconhecido";
}

export const Route = createFileRoute("/api/ip")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ua = request.headers.get("user-agent") || "";
        const meta = parseUserAgent(ua);
        return Response.json({
          ip: ipFrom(request),
          os: meta.os,
          browser: meta.browser,
          deviceKind: meta.deviceKind,
        });
      },
    },
  },
});
