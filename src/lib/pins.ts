const KEY = "jg-pins-v1";

type Bag = Record<string, string[]>;

function read(): Bag {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Bag;
  } catch {
    return {};
  }
}

export function pinnedIds(userId: string | null | undefined) {
  return read()[userId || "_anon"] ?? [];
}

export function togglePin(userId: string | null | undefined, id: string) {
  const bag = read();
  const key = userId || "_anon";
  const cur = new Set(bag[key] ?? []);
  if (cur.has(id)) cur.delete(id);
  else cur.add(id);
  bag[key] = [...cur];
  localStorage.setItem(KEY, JSON.stringify(bag));
  window.dispatchEvent(new Event("jg-pins"));
  return bag[key].includes(id);
}

export function isPinned(userId: string | null | undefined, id: string) {
  return pinnedIds(userId).includes(id);
}
