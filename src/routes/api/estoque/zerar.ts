import { createFileRoute } from "@tanstack/react-router";
import { pavilhaoParaZerar } from "@/lib/zero-pav";

export const Route = createFileRoute("/api/estoque/zerar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { pavilhao?: unknown } = {};
        try {
          body = (await request.json()) as { pavilhao?: unknown };
        } catch {
          body = {};
        }
        const code = pavilhaoParaZerar(body?.pavilhao);
        if (!code) {
          return Response.json(
            { error: "Selecione um pavilhão. Nenhum estoque foi alterado." },
            { status: 400 },
          );
        }
        return Response.json({ ok: true, pavilhao: code });
      },
    },
  },
});
