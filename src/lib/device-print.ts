export function devicePrint() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const kind = /iPhone|iPad/i.test(navigator.userAgent) ? "iphone" : /Android/i.test(navigator.userAgent) ? "android" : "web";
    const long = Math.max(screen.width || 0, screen.height || 0);
    const short = Math.min(screen.width || 0, screen.height || 0);
    return [long, short, window.devicePixelRatio || 1, tz, navigator.language, kind].join("|");
  } catch {
    return "";
  }
}

export function readLocalDevice() {
  try {
    const raw = localStorage.getItem("jg-device") || sessionStorage.getItem("jg-device");
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { deviceId?: string; secret?: string };
    return { deviceId: parsed.deviceId || "", deviceSecret: parsed.secret || "" };
  } catch {
    return {};
  }
}
