function normalize(raw: string): string {
  return raw
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/[xX×]/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
}

function parseMath(src: string): number {
  let i = 0;
  const peek = () => src[i] ?? "";
  const eat = () => src[i++] ?? "";

  function number(): number {
    let t = "";
    while (/[0-9.]/.test(peek())) t += eat();
    if (!t || t === "." || t.split(".").length > 2) throw new Error("num");
    return Number(t);
  }

  function atom(): number {
    if (peek() === "(") {
      eat();
      const v = add();
      if (peek() !== ")") throw new Error("paren");
      eat();
      return v;
    }
    if (peek() === "-") {
      eat();
      return -atom();
    }
    if (peek() === "+") {
      eat();
      return atom();
    }
    return number();
  }

  function mul(): number {
    let v = atom();
    while (peek() === "*" || peek() === "/") {
      const op = eat();
      const r = atom();
      if (op === "*") v *= r;
      else {
        if (r === 0) throw new Error("div");
        v /= r;
      }
    }
    return v;
  }

  function add(): number {
    let v = mul();
    while (peek() === "+" || peek() === "-") {
      const op = eat();
      const r = mul();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  const v = add();
  if (i !== src.length) throw new Error("tail");
  if (!Number.isFinite(v)) throw new Error("nan");
  return v;
}

function tryParse(src: string): number | null {
  if (!src) return null;
  try {
    return parseMath(src);
  } catch {
    return null;
  }
}

export function evaluateLive(raw: string): { value: number | null; complete: boolean } {
  const s = normalize(raw);
  if (!s) return { value: null, complete: false };
  const full = tryParse(s);
  if (full != null) return { value: full, complete: true };
  const trimmed = s.replace(/[+\-*/.]+$/, "");
  if (!trimmed || trimmed === s) return { value: null, complete: false };
  return { value: tryParse(trimmed), complete: false };
}

export function formatCalc(n: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.abs(n) >= 1e10 || (Math.abs(n) > 0 && Math.abs(n) < 1e-8) ? n : Number(n.toPrecision(12));
  return String(rounded);
}
