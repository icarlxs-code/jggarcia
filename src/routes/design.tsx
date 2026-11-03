import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Glyph, StatusGlyph, type GlyphState, type StatusGlyphName } from "@/components/brand/glyph";
import { MODULES, moduleStyle, type ModuleId } from "@/lib/modules";
import { PageStage } from "@/components/motion/page-stage";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/design")({ component: DesignSystem });

const UI_GLYPHS = ["busca", "sino", "assistente", "sync"] as const;
const STATUS: StatusGlyphName[] = ["sucesso", "erro", "alerta", "info", "carregando"];
const STATES: GlyphState[] = ["idle", "loading", "success", "warning", "error"];

/** Living reference of the Safra design system: glyphs, module lights, states. */
function DesignSystem() {
  const [estado, setEstado] = useState<GlyphState>("idle");
  const [replay, setReplay] = useState(0);
  return (
    <PageStage className="space-y-8">
      <header className="page-hero">
        <h1 className="page-title">Safra · design system</h1>
        <p className="page-desc mt-1 max-w-2xl">Glifos, luz de cada módulo e estados. Passe o mouse para ver o movimento de cada um.</p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Módulos</h2>
          <div className="seg-control ml-auto" role="radiogroup" aria-label="Estado dos glifos">
            {STATES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={estado === s} data-on={estado === s ? "true" : undefined} onClick={() => setEstado(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {(Object.keys(MODULES) as ModuleId[]).map((id) => (
            <div key={id} data-module={id} style={moduleStyle(id)} className="ds-tile glyph-host">
              <span className="ds-mark">
                <Glyph name={id} state={estado} />
              </span>
              <span className="ds-name">{MODULES[id].nome}</span>
              <span className="ds-swatch">
                <i style={{ background: MODULES[id].luz }} />
                <i style={{ background: MODULES[id].tinta }} />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ao vivo (loop calmo)</h2>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8 lg:grid-cols-11">
          {(Object.keys(MODULES) as ModuleId[]).map((id) => (
            <span key={id} data-module={id} style={moduleStyle(id)} className="ds-live" title={MODULES[id].nome}>
              <Glyph name={id} live />
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Interface e status</h2>
        <div className="flex flex-wrap items-center gap-3">
          {UI_GLYPHS.map((g) => (
            <span key={g} className="ds-live glyph-host" title={g}>
              <Glyph name={g} />
            </span>
          ))}
          <span key={replay} className="flex items-center gap-3">
            {STATUS.map((s) => (
              <span key={s} className="ds-live" title={s}>
                <StatusGlyph name={s} />
              </span>
            ))}
          </span>
          <Button variant="outline" size="sm" onClick={() => setReplay((n) => n + 1)}>
            Repetir status
          </Button>
        </div>
      </section>
    </PageStage>
  );
}
