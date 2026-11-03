import { Glyph } from "@/components/brand/glyph";
import { ModuleTile } from "@/components/brand/module-tile";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The expedition as a route: where it leaves from, where it goes, and what
 * rides along. Reads the form as it is filled; the truck runs once both ends
 * are known.
 */
export function RoutePreview({
  origem,
  destino,
  destinoTipo,
  produto,
  quantidade,
  unidade,
}: {
  origem: string | null;
  destino: string | null;
  destinoTipo: "cliente" | "pav" | "saida";
  produto: string | null;
  quantidade: number;
  unidade?: string;
}) {
  const pronto = Boolean(origem && destino);
  return (
    <div className="route-card" data-ready={pronto ? "true" : "false"} aria-live="polite">
      <div className={cn("route-node", !origem && "is-empty")}>
        <ModuleTile id="pavilhoes" size="sm" />
        <span className="min-w-0">
          <small>Sai de</small>
          <strong className="truncate">{origem ?? "Escolha a origem"}</strong>
        </span>
      </div>
      <div className="route-road" aria-hidden="true">
        <span className="route-mover">
          <Glyph name="saidas" live={pronto} className="route-truck" />
        </span>
        {produto && quantidade > 0 ? (
          <span className="route-load">
            {formatNumber(quantidade)} {unidade} · {produto}
          </span>
        ) : null}
      </div>
      <div className={cn("route-node is-end", !destino && "is-empty")}>
        <ModuleTile id={destinoTipo === "pav" ? "pavilhoes" : "clientes"} size="sm" />
        <span className="min-w-0">
          <small>{destinoTipo === "pav" ? "Vai para o pavilhão" : destinoTipo === "saida" ? "Destino" : "Vai para o cliente"}</small>
          <strong className="truncate">{destino ?? "Escolha o destino"}</strong>
        </span>
      </div>
    </div>
  );
}
