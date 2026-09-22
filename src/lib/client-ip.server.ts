import { getRequest, setCookie } from "@tanstack/react-start/server";

export function clientIp(): string {
  const request = getRequest();
  if (!request) return "desconhecido";
  const h = request.headers;
  const forwarded = h.get("x-forwarded-for") || h.get("x-real-ip") || h.get("cf-connecting-ip") || "";
  const ip = forwarded.split(",")[0]?.trim();
  if (ip) return ip;
  try {
    const url = new URL(request.url);
    return url.hostname || "desconhecido";
  } catch {
    return "desconhecido";
  }
}

export function clientUa(): string {
  const request = getRequest();
  return (request?.headers.get("user-agent") || "").slice(0, 180);
}

export function readCookie(name: string): string {
  const request = getRequest();
  const cookie = request?.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function writeDeviceCookie(deviceId: string, secret: string) {
  const value = `${deviceId}.${secret}`;
  try {
    setCookie("jg-qr-device", value, {
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
      sameSite: "lax",
      httpOnly: false,
    });
  } catch {
    /* ignore */
  }
}

export function clearDeviceCookie() {
  try {
    setCookie("jg-qr-device", "", { path: "/", maxAge: 0, sameSite: "lax", httpOnly: false });
    setCookie("jg-qr-dev", "", { path: "/", maxAge: 0, sameSite: "lax", httpOnly: false });
  } catch {
    /* ignore */
  }
}

export function parseDeviceCookie(): { deviceId: string; secret: string } | null {
  const raw = readCookie("jg-qr-device") || readCookie("jg-qr-dev");
  const [deviceId, secret] = raw.split(".");
  if (!deviceId || !secret) return null;
  return { deviceId, secret };
}

export function writeAuthCookie(userId: string, token: string) {
  try {
    setCookie("jg-auth", `${userId}.${token}`, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: true,
    });
  } catch {
    /* ignore */
  }
}

export function clearAuthCookie() {
  try {
    setCookie("jg-auth", "", { path: "/", maxAge: 0, sameSite: "lax", httpOnly: true });
  } catch {
    /* ignore */
  }
}

export function parseAuthCookie(): { userId: string; token: string } | null {
  const raw = readCookie("jg-auth");
  const [userId, token] = raw.split(".");
  if (!userId || !token) return null;
  return { userId, token };
}
