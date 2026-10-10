/** Custom product photos. The catalog file in product-photos.ts is never written here. */

type Row = { nome?: string | null; codigo?: string | null; foto?: string | null; foto_original?: string | null };

const byCodigo = new Map<string, string>();
const byNome = new Map<string, string>();
const listeners = new Set<() => void>();

function fold(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isCustomProductPhoto(src?: string | null) {
  return Boolean(src && (src.startsWith("data:") || src.startsWith("blob:")));
}

/** Photo shown in lists: the replacement, or a kept original that is not a catalog file. */
export function syncProductPhotoOverrides(rows: Row[]) {
  byCodigo.clear();
  byNome.clear();
  for (const row of rows) {
    const src = isCustomProductPhoto(row.foto)
      ? row.foto!
      : isCustomProductPhoto(row.foto_original)
        ? row.foto_original!
        : "";
    if (!src) continue;
    if (row.codigo) byCodigo.set(row.codigo.trim(), src);
    if (row.nome) byNome.set(fold(row.nome), src);
  }
  for (const listener of listeners) listener();
}

export function overrideOfProduct(nome?: string | null, codigo?: string | null) {
  if (codigo) {
    const hit = byCodigo.get(codigo.trim());
    if (hit) return hit;
  }
  if (!nome) return undefined;
  return byNome.get(fold(nome));
}

export function listOverridePhotos() {
  return [...new Set([...byCodigo.values(), ...byNome.values()])];
}

export function subscribeProductPhotos(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
