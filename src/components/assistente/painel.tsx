import { useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { perguntarAssistente } from "@/lib/assistente.functions";
import { retratoOperacao } from "@/lib/assistente-brief";
import { respostaLocal } from "@/lib/assistente-local";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { id: number; papel: "user" | "assistant"; texto: string };

let seq = 1;

export function AssistenteButton() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="icon" aria-label="Assistente" onClick={() => setAberto((v) => !v)}>
        <Sparkles className="h-4 w-4" />
      </Button>
      {aberto ? createPortal(<AssistentePainel onClose={() => setAberto(false)} />, document.body) : null}
    </>
  );
}

function AssistentePainel({ onClose }: { onClose: () => void }) {
  const { perfil } = useSession();
  const [texto, setTexto] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    const pergunta = texto.trim();
    if (!pergunta || ocupado) return;
    const minha: Msg = { id: seq++, papel: "user", texto: pergunta };
    const historico = msgs.map((m) => ({ papel: m.papel, texto: m.texto }));
    setMsgs((lista) => [...lista, minha]);
    setTexto("");
    setOcupado(true);
    try {
      const retrato = retratoOperacao(perfil?.nome || "usuário");
      const res = await perguntarAssistente({ data: { pergunta, retrato, historico } });
      setMsgs((lista) => [
        ...lista,
        { id: seq++, papel: "assistant", texto: res.ok ? res.texto : "semProvedor" in res ? respostaLocal(pergunta) : res.erro },
      ]);
    } catch {
      setMsgs((lista) => [...lista, { id: seq++, papel: "assistant", texto: "Não consegui responder agora." }]);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="fixed bottom-16 right-3 z-[240] flex h-[min(32rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card sm:bottom-4">
      <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">Assistente</p>
          <p className="text-xs text-muted-foreground">Pergunte sobre a operação ou qualquer assunto.</p>
        </div>
        <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-muted" onClick={onClose} aria-label="Fechar assistente">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {msgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Exemplo: quantos produtos cadastrei hoje?</p>
        ) : (
          msgs.map((m) => (
            <p
              key={m.id}
              className={cn(
                "max-w-[95%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                m.papel === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              {m.texto}
            </p>
          ))
        )}
        {ocupado ? <p className="text-xs text-muted-foreground">Consultando…</p> : null}
      </div>
      <form
        className="flex gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pergunte"
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none"
        />
        <Button type="submit" disabled={ocupado || !texto.trim()}>
          Enviar
        </Button>
      </form>
    </section>
  );
}
