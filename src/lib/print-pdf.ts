function documentHtml(title: string, body: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@600&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    @page { size: A4; margin: 12mm 12mm 14mm; }
    html, body { margin: 0; padding: 0; background: #fff; color: #12261c; font-family: Inter, system-ui, sans-serif; }
    body { font-size: 11.5px; line-height: 1.45; }
    .sheet { padding: 0; }
    header.brand { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding-bottom: 12px; border-bottom: 3px solid #1b5c3e; }
    header.brand img { height: 46px; width: auto; }
    .brand-copy { text-align: center; }
    .brand-copy strong { display: block; font-size: 16px; letter-spacing: -0.02em; }
    .brand-copy .doc-title { display: block; margin-top: 2px; color: #174b34; font-size: 12.5px; font-weight: 600; }
    h1 { font-size: 18px; margin: 16px 0 4px; letter-spacing: -0.03em; text-align: center; }
    .meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin: 8px 0 16px; }
    .chip { border: 1px solid #dce5de; background: #eef2ee; border-radius: 999px; padding: 3px 10px; font-size: 10.5px; color: #174b34; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 18px; }
    .kpi { border: 1px solid #dce5de; border-radius: 10px; padding: 8px 10px; background: #f4f6f4; }
    .kpi b { display: block; font-size: 16px; font-variant-numeric: tabular-nums; }
    .kpi span { color: #5a6b62; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #1b5c3e; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 6px 7px; border-bottom: 1px solid #e6eee8; vertical-align: top; }
    th { font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; color: #5a6b62; font-weight: 600; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; font-family: "IBM Plex Mono", ui-monospace, monospace; }
    tbody tr:nth-child(even) td { background: #f7faf7; }
    .client { break-inside: avoid; margin: 0 0 14px; padding: 10px 12px; border: 1px solid #dce5de; border-radius: 12px; }
    .client h3 { margin: 0 0 6px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .client h3 img { height: 28px; width: 28px; object-fit: contain; border-radius: 6px; background: #fff; border: 1px solid #dce5de; }
    .muted { color: #5a6b62; }
    footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #dce5de; color: #5a6b62; font-size: 10px; text-align: center; }
    .empty { padding: 24px; text-align: center; color: #5a6b62; border: 1px dashed #dce5de; border-radius: 12px; }
    @media print { .kpis { grid-template-columns: repeat(4, 1fr); } }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="brand">
      <img src="${origin}/logo.png" alt="JG Garcia" />
      <div class="brand-copy">
        <strong>JG Garcia</strong>
        <span class="doc-title">${esc(title)}</span>
      </div>
    </header>
    ${body}
    <footer>
      <span>Gerado em ${esc(new Date().toLocaleString("pt-BR"))}</span>
    </footer>
  </div>
</body>
</html>`;
}

function armPrint(win: Window, cleanup?: () => void) {
  let printed = false;
  return () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
    if (cleanup) window.setTimeout(cleanup, 400);
  };
}

function waitThenPrint(doc: Document, win: Window, cleanup?: () => void) {
  const run = armPrint(win, cleanup);
  const imgs = [...doc.images];
  if (!imgs.length) {
    window.setTimeout(run, 160);
    return;
  }
  let left = imgs.length;
  const tick = () => {
    left -= 1;
    if (left <= 0) window.setTimeout(run, 80);
  };
  for (const img of imgs) {
    if (img.complete) tick();
    else {
      img.addEventListener("load", tick, { once: true });
      img.addEventListener("error", tick, { once: true });
    }
  }
  window.setTimeout(run, 1800);
}

export function printHtml(title: string, body: string) {
  const html = documentHtml(title, body);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) throw new Error("Não foi possível abrir a impressão.");
    win.document.open();
    win.document.write(html);
    win.document.close();
    waitThenPrint(win.document, win);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    throw new Error("Não foi possível abrir a impressão.");
  }
  waitThenPrint(doc, win, () => iframe.remove());
}

export function esc(s: string | number | null | undefined): string {
  return String(s ?? "").replace(/[&<>"]/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    return "&" + "quot;";
  });
}
