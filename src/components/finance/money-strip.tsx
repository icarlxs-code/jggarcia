import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";
import type { FretePagamento } from "@/lib/types";
import { ModuleTile } from "@/components/brand/module-tile";
import { usePrefersReducedMotion } from "@/lib/motion";
import { todayISO } from "@/lib/format";

const BRL = { style: "currency", currency: "BRL" } as const;

function mesDe(f: FretePagamento) {
  return (f.data_entrada || f.created_at || "").slice(0, 7);
}

function mesAnterior(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The month in money: total of the receipts, how many, and the same total a month earlier. */
export function MoneyStrip({ fretes, kind }: { fretes: FretePagamento[]; kind: "pagamento" | "despesa" }) {
  const reduced = usePrefersReducedMotion();
  const mes = todayISO().slice(0, 7);
  const doMes = fretes.filter((f) => !f.deleted_at && mesDe(f) === mes);
  const anterior = fretes.filter((f) => !f.deleted_at && mesDe(f) === mesAnterior(mes));
  const total = doMes.reduce((a, f) => a + (Number(f.valor) || 0), 0);
  const totalAnterior = anterior.reduce((a, f) => a + (Number(f.valor) || 0), 0);
  const gerados = doMes.filter((f) => f.status === "gerado").length;
  const variacao = totalAnterior > 0 ? Math.round(((total - totalAnterior) / totalAnterior) * 100) : null;
  const [shown, setShown] = useState(reduced ? total : 0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(total));
    return () => cancelAnimationFrame(id);
  }, [total]);

  return (
    <section className="money-strip glyph-host" aria-label={kind === "despesa" ? "Despesas de frete do mês" : "Pagamentos de frete do mês"}>
      <ModuleTile id={kind === "despesa" ? "despesas" : "fretes"} size="lg" live={doMes.length > 0} />
      <div className="money-total">
        <span className="text-xs text-muted-foreground">{kind === "despesa" ? "Despesas neste mês" : "Pago neste mês"}</span>
        <span className="kpi-figure text-3xl leading-none">
          <NumberFlow value={reduced ? total : shown} locales="pt-BR" format={BRL} animated={!reduced} respectMotionPreference={false} />
        </span>
      </div>
      <dl className="money-facts">
        <div>
          <dt>Comprovantes</dt>
          <dd className="tabular-nums">{doMes.length}</dd>
        </div>
        <div>
          <dt>Gerados</dt>
          <dd className="tabular-nums">{gerados}</dd>
        </div>
        <div>
          <dt>Rascunhos</dt>
          <dd className="tabular-nums">{doMes.length - gerados}</dd>
        </div>
        <div>
          <dt>Mês anterior</dt>
          <dd className="tabular-nums">
            {totalAnterior.toLocaleString("pt-BR", BRL)}
            {variacao !== null ? <span className={variacao > 0 ? "money-delta is-up" : variacao < 0 ? "money-delta is-down" : "money-delta"}>{variacao > 0 ? "↑" : variacao < 0 ? "↓" : "="} {Math.abs(variacao)}%</span> : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}
