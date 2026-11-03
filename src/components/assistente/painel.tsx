import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, X } from "lucide-react";
import { Glyph } from "@/components/brand/glyph";
import { perguntarAssistente } from "@/lib/assistente.functions";
import { retratoOperacao } from "@/lib/assistente-brief";
import { respostaLocal } from "@/lib/assistente-local";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Orb3D } from "@/components/three/lazy";
import { RadarOrb } from "@/components/analytics/dash-widgets";
import { useAnimatedList } from "@/lib/use-animated-list";

const SUGESTOES = ["O que está acabando?", "Entradas de hoje", "Quanto tem de abacate?", "Lotes vencendo", "O que mais saiu?"];

type Msg = { id: number; papel: "user" | "assistant"; texto: string };

let seq = 1;

export function AssistenteButton() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="icon" className="glyph-host" aria-label="Assistente" onClick={() => setAberto((v) => !v)}>
        <Glyph name="assistente" live={aberto} className="h-[1.05rem] w-[1.05rem]" />
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

  const listaRef = useAnimatedList<HTMLDivElement>();

  async function enviar(direta?: string) {
    const pergunta = (direta ?? texto).trim();
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
    <section className="ai-panel" aria-label="Assistente">
      <header className="ai-head">
        <div className="ai-orb" aria-hidden="true">
          <Orb3D fallback={<RadarOrb />} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="ai-title">Assistente JG</p>
          <p className="ai-sub">
            <span className="ai-live" /> Lê o estoque real agora
          </p>
        </div>
        <button type="button" className="ai-close" onClick={onClose} aria-label="Fechar assistente">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div ref={listaRef} className="ai-body">
        {msgs.length === 0 ? (
          <div className="ai-empty">
            <p className="ai-hello">Olá{perfil?.nome ? `, ${perfil.nome.split(" ")[0]}` : ""}. Pergunte sobre o estoque, as entradas, as saídas ou qualquer assunto.</p>
            <div className="ai-chips">
              {SUGESTOES.map((q) => (
                <button key={q} type="button" className="ai-chip" onClick={() => void enviar(q)} disabled={ocupado}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m) => (
            <p key={m.id} className={cn("ai-msg", m.papel === "user" ? "is-user" : "is-bot")}>
              {m.texto}
            </p>
          ))
        )}
        {ocupado ? (
          <p className="ai-msg is-bot ai-typing" aria-label="Consultando">
            <i />
            <i />
            <i />
          </p>
        ) : null}
      </div>
      <form
        className="ai-form"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pergunte ao assistente…" className="ai-input" aria-label="Pergunta" />
        <Button type="submit" size="icon" className="ai-send" disabled={ocupado || !texto.trim()} aria-label="Enviar">
          <ArrowUp />
        </Button>
      </form>
    </section>
  );
}
