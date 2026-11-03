import { useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { Produce3D } from "@/components/three/lazy";

export function LoginScreen() {
  const { signIn } = useSession();
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState("");

  function entrar() {
    const email = emailRef.current?.value ?? "";
    const pass = senhaRef.current?.value ?? "";
    if (!email.trim() || !pass.trim()) {
      setErro("Informe e-mail e senha.");
      return;
    }
    void signIn(email, pass, true).then((falha) => {
      setErro(falha || "");
    });
  }

  return (
    <main className="login-plain">
      <section className="login-stage">
        <aside className="login-brief">
          <div className="login-3d" aria-hidden="true">
            <Produce3D />
          </div>
          <p className="login-kicker">JG Garcia</p>
          <h1>
            Operação
            <br />
            em um só lugar.
          </h1>
          <p className="login-lead">Estoque, entrada, saída e contagem.</p>
        </aside>
        <div className="login-form">
          <p className="login-kicker">Acesso</p>
          <h2>Entrar</h2>
          {erro ? <p className="login-plain-erro">{erro}</p> : null}
          <label>
            E-mail
            <input
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="username"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") senhaRef.current?.focus();
              }}
            />
          </label>
          <label>
            Senha
            <input
              ref={senhaRef}
              type="password"
              name="password"
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  entrar();
                }
              }}
            />
          </label>
          <button type="button" onClick={entrar}>
            Entrar
          </button>
        </div>
      </section>
    </main>
  );
}
