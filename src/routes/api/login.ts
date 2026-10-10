import { createFileRoute } from "@tanstack/react-router";
import { deviceLabelFromUa, isPhysicalPhone, parseUserAgent } from "@/lib/device-meta";

function ipFrom(request: Request) {
  const h = request.headers;
  const forwarded = h.get("x-forwarded-for") || h.get("x-real-ip") || h.get("cf-connecting-ip") || "";
  return forwarded.split(",")[0]?.trim() || "";
}

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { identificador?: string; senha?: string; remember?: boolean; print?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          body = {};
        }
        const identificador = String(body.identificador || "").trim();
        const senha = String(body.senha || "");
        if (!identificador || !senha.trim()) {
          return Response.json({ ok: false, error: "Informe e-mail e senha." }, { status: 400 });
        }
        const ua = request.headers.get("user-agent") || "";
        const { authenticate } = await import("@/lib/auth-store.server");
        const res = await authenticate(
          identificador,
          senha,
          ipFrom(request),
          ua,
          String(body.print || ""),
          null,
          Boolean(body.remember) || isPhysicalPhone(ua),
        );
        if (!res.ok) return Response.json({ ok: false, error: res.error }, { status: 401 });
        const meta = "meta" in res && res.meta ? res.meta : parseUserAgent(ua);
        return Response.json({
          ok: true,
          user: res.user,
          deviceId: "deviceId" in res ? res.deviceId : "",
          secret: "secret" in res ? res.secret : "",
          ip: "ip" in res ? res.ip : ipFrom(request),
          label: deviceLabelFromUa(ua),
          meta,
        });
      },
    },
  },
});
