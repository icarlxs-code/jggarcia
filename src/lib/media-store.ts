/** Arquivo de mídia, separado do banco operacional. O painel não precisa ler as fotos para abrir. */

export const MEDIA_KEY = "jg-media-v1";

export function peelStore<T>(data: T): { ops: T; media: Record<string, string> } {
  const media: Record<string, string> = {};
  const ops = peel(data, media, "") as T;
  return { ops, media };
}

export function attachMedia(data: unknown, media: Record<string, string>) {
  attach(data, media);
}

function peel(value: unknown, media: Record<string, string>, path: string): unknown {
  if (typeof value === "string") {
    if (value.startsWith("data:") && value.length > 80) {
      media[path] = value;
      return `media:${path}`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item, i) => peel(item, media, `${path}.${i}`));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = peel(item, media, path ? `${path}.${key}` : key);
    return out;
  }
  return value;
}

function attach(value: unknown, media: Record<string, string>) {
  if (Array.isArray(value)) {
    for (const item of value) attach(item, media);
    return;
  }
  if (!value || typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(row)) {
    if (typeof item === "string" && item.startsWith("media:")) {
      const blob = media[item.slice(6)];
      if (blob) row[key] = blob;
      continue;
    }
    if (item && typeof item === "object") attach(item, media);
  }
}
