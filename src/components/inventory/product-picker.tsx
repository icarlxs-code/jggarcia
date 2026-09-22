import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Mercadoria } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { cn, fold } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ProductLabel } from "@/components/inventory/product-icon";

export function ProductPicker({
  items,
  value,
  onChange,
  placeholder = "Digite o nome ou o código",
}: {
  items: Mercadoria[];
  value: string;
  onChange: (id: string, item?: Mercadoria) => void;
  placeholder?: string;
}) {
  const selected = items.find((m) => m.id === value);
  const [busca, setBusca] = useState(selected ? `${selected.codigo} · ${selected.nome}` : "");
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);

  useEffect(() => {
    if (!value) return;
    const sel = items.find((m) => m.id === value);
    if (sel) setBusca(`${sel.codigo} · ${sel.nome}`);
  }, [value, items]);

  const filtradas = useMemo(() => {
    const term = fold(busca.trim());
    return items
      .filter((m) => {
        if (!term) return true;
        const codigo = fold(m.codigo);
        return fold(m.nome).includes(term) || codigo.includes(term) || codigo.replace(/^0+/, "").includes(term.replace(/^0+/, ""));
      })
      .slice(0, 24);
  }, [items, busca]);

  function escolher(m: Mercadoria) {
    setBusca(`${m.codigo} · ${m.nome}`);
    setAberto(false);
    onChange(m.id, m);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="busca-prod-saida"
        value={busca}
        className="pl-10"
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={aberto}
        aria-controls="lista-produtos-saida"
        onChange={(e) => {
          const next = e.target.value;
          setBusca(next);
          setAberto(true);
          setDestaque(0);
          if (value) {
            const atual = items.find((m) => m.id === value);
            if (atual && next !== `${atual.codigo} · ${atual.nome}`) onChange("");
          }
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => window.setTimeout(() => setAberto(false), 140)}
        onKeyDown={(e) => {
          if (!aberto || filtradas.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setDestaque((n) => Math.min(n + 1, filtradas.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setDestaque((n) => Math.max(n - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            escolher(filtradas[destaque] ?? filtradas[0]);
          } else if (e.key === "Escape") {
            setAberto(false);
          }
        }}
      />
      {aberto ? (
        <ul
          id="lista-produtos-saida"
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-card"
        >
          {filtradas.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum produto com esse nome ou código.</li>
          ) : (
            filtradas.map((m, i) => (
              <li key={m.id} role="option" aria-selected={m.id === value}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                    i === destaque || m.id === value ? "bg-mint text-foreground" : "hover:bg-muted",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setDestaque(i)}
                  onClick={() => escolher(m)}
                >
                  <ProductLabel nome={m.nome} codigo={m.codigo} extra={`${formatNumber(m.estoque)} ${m.unidade}`} className="flex-1" />
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
