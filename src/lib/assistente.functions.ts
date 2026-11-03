import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";

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

    const historico = (data.historico ?? [])
      .slice(-6)
      .map((f) => ({ role: f.papel, content: String(f.texto ?? "").slice(0, 2000) }))
      .filter((f) => f.content.trim());
    const retrato = `Retrato da operação agora:
${String(data.retrato ?? "").slice(0, 48000)}`;

    // Provider chain: xAI when its key is set, else Claude. Neither → the panel answers locally.
    if (process.env.XAI_API_KEY) return perguntarXai(process.env.XAI_API_KEY, retrato, historico, pergunta);
    if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return perguntarClaude(retrato, historico, pergunta);
    return { ok: false as const, semProvedor: true as const, erro: "O assistente não está disponível neste ambiente." };
  });

const SISTEMA =
  "Você é o assistente da JG Garcia e está dentro do sistema. O retrato abaixo é o banco real deste momento: produtos, estoque, entradas, saídas, contagens, pavilhões, usuários, empilhadores, fretes, notas e log. Responda em português, direto. Para qualquer pergunta da operação, use esse retrato e some o que estiver nele. Os totais de hoje, deste mês e do mês passado já estão calculados: responda com esses números. Não diga que a consulta não trouxe o dado se o retrato tiver o total, a lista ou a data. Só diga que esse detalhe não está registrado se não houver nenhuma linha sobre o assunto. Não invente quantidade, nome, data nem valor. Pode responder também assuntos gerais, fora do estoque.";

type Turno = { role: "user" | "assistant"; content: string };

async function perguntarXai(apiKey: string, retrato: string, historico: Turno[], pergunta: string) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 700,
      temperature: 0.3,
      messages: [
        { role: "system", content: SISTEMA },
        { role: "system", content: retrato },
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
}

async function perguntarClaude(retrato: string, historico: Turno[], pergunta: string) {
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SISTEMA },
        { type: "text", text: retrato, cache_control: { type: "ephemeral" } },
      ],
      messages: [...historico, { role: "user", content: pergunta }],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    if (response.stop_reason === "refusal") return { ok: false as const, erro: "Não posso responder a isso." };
    const texto = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!texto) return { ok: false as const, erro: "A resposta veio vazia." };
    return { ok: true as const, texto };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false as const, erro: "A chave da Anthropic é inválida." };
    if (error instanceof Anthropic.RateLimitError) return { ok: false as const, erro: "Muitas perguntas juntas. Espere um minuto." };
    return { ok: false as const, erro: "Não consegui responder agora. Tente de novo." };
  }
}
