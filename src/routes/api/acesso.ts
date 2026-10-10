import { createFileRoute } from "@tanstack/react-router";

const JANELA_MS = 15 * 60 * 1000;
const MAX_FALHAS = 8;
const falhas = new Map<string, number[]>();

function ipDe(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
  return forwarded.split(",")[0]?.trim() || "local";
}

function bloqueado(ip: string) {
  const agora = Date.now();
  const recentes = (falhas.get(ip) || []).filter((t) => agora - t < JANELA_MS);
  falhas.set(ip, recentes);
  return recentes.length >= MAX_FALHAS;
}

function anotarFalha(ip: string) {
  const agora = Date.now();
  const recentes = (falhas.get(ip) || []).filter((t) => agora - t < JANELA_MS);
  recentes.push(agora);
  falhas.set(ip, recentes);
}

export const Route = createFileRoute("/api/acesso")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = ipDe(request);
        if (bloqueado(ip)) {
          return Response.json({ ok: false, error: "Muitas tentativas. Espere e tente de novo." }, { status: 429 });
        }
        let body: { senha?: string } = {};
        try {
          body = (await request.json()) as { senha?: string };
        } catch {
          body = {};
        }
        const { guardRequest } = await import("@/lib/request-guard.server");
        await guardRequest();
        const { grantAccess } = await import("@/lib/auth-store.server");
        const res = await grantAccess(String(body.senha || ""));
        if (!res.ok) {
          anotarFalha(ip);
          return Response.json({ ok: false, error: res.error }, { status: 401 });
        }
        return Response.json({ ok: true, user: res.user });
      },
    },
  },
});
