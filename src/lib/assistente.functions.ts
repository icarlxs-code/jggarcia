import { createServerFn } from "@tanstack/react-start";

type Fala = { papel: "user" | "assistant"; texto: string };

const janela: number[] = [];

function podeChamar() {
  const agora = Date.now();
  while (janela.length && agora - janela[0] > 60_000) janela.shift();
  if (janela.length >= 30) return false;
  janela.push(agora);
  return true;
}

export const perguntarAssistente = createServerFn({ method: "POST" })
  .validator((data: { pergunta: string; retrato: string; historico: Fala[] }) => data)
  .handler(async ({ data }) => {
    const pergunta = data.pergunta.trim().slice(0, 2000);
    if (!pergunta) return { ok: false as const, erro: "Escreva a pergunta." };
    if (!podeChamar()) return { ok: false as const, erro: "Muitas perguntas juntas. Espere um minuto." };

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, erro: "O assistente não está disponível neste ambiente." };

    const historico = (data.historico ?? [])
      .slice(-6)
      .map((f) => ({ role: f.papel, content: String(f.texto ?? "").slice(0, 2000) }))
      .filter((f) => f.content.trim());

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 700,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "Você é o assistente da JG Garcia e está dentro do sistema. O retrato abaixo é o banco real deste momento: produtos, estoque, entradas, saídas, contagens, pavilhões, usuários, empilhadores, fretes, notas e log. Responda em português, direto. Para qualquer pergunta da operação, use esse retrato e some o que estiver nele. Os totais de hoje, deste mês e do mês passado já estão calculados: responda com esses números. Não diga que a consulta não trouxe o dado se o retrato tiver o total, a lista ou a data. Só diga que esse detalhe não está registrado se não houver nenhuma linha sobre o assunto. Não invente quantidade, nome, data nem valor. Pode responder também assuntos gerais, fora do estoque.",
          },
          {
            role: "system",
            content: `Retrato da operação agora:\n${String(data.retrato ?? "").slice(0, 48000)}`,
          },
          ...historico,
          { role: "user", content: pergunta },
        ],
      }),
    });

    if (!res.ok) return { ok: false as const, erro: "Não consegui responder agora. Tente de novo." };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const texto = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!texto) return { ok: false as const, erro: "A resposta veio vazia." };
    return { ok: true as const, texto };
  });
