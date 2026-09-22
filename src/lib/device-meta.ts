export type DeviceKind = "computer" | "phone" | "tablet";

export function isPhysicalPhone(ua = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  return /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export function isPhysicalTablet(ua = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  return /iPad|Android(?!.*Mobile)|Tablet/i.test(ua);
}

export function deviceKindFromUa(ua: string): DeviceKind {
  if (isPhysicalPhone(ua)) return "phone";
  if (isPhysicalTablet(ua)) return "tablet";
  return "computer";
}

export function parseUserAgent(ua: string): { os: string; browser: string; deviceKind: DeviceKind } {
  const raw = ua || "";
  let os = "Sistema";
  if (/Windows NT/i.test(raw)) os = "Windows";
  else if (/Mac OS X/i.test(raw)) os = "macOS";
  else if (/iPhone|iPad|iPod/i.test(raw)) os = "iOS";
  else if (/Android/i.test(raw)) os = "Android";
  else if (/Linux/i.test(raw)) os = "Linux";

  let browser = "Navegador";
  if (/Edg\//i.test(raw)) browser = "Edge";
  else if (/Chrome\//i.test(raw) && !/Edg\//i.test(raw) && !/OPR\//i.test(raw)) browser = "Chrome";
  else if (/Safari\//i.test(raw) && !/Chrome\//i.test(raw)) browser = "Safari";
  else if (/Firefox\//i.test(raw)) browser = "Firefox";
  else if (/OPR\//i.test(raw)) browser = "Opera";

  return { os, browser, deviceKind: deviceKindFromUa(raw) };
}

export function deviceLabelFromUa(ua: string) {
  const { os, deviceKind } = parseUserAgent(ua);
  if (deviceKind === "phone") {
    if (/iPhone|iPod/i.test(ua)) return "iPhone";
    if (/Android/i.test(ua)) return "Android";
    return "Celular";
  }
  if (deviceKind === "tablet") return /iPad/i.test(ua) ? "iPad" : "Tablet";
  return `Computador ${os}`;
}
