import { createServerFn } from "@tanstack/react-start";
import type { Usuario } from "./types";

export const startQrLogin = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const { createTicket } = await import("./auth-store.server");
    return createTicket();
  });

export const pollQrLogin = createServerFn({ method: "POST" })
  .validator((d: { id: string; secret: string }) => d)
  .handler(async ({ data }) => {
    const { pollTicket } = await import("./auth-store.server");
    return pollTicket(data.id, data.secret);
  });

export const approveQrLogin = createServerFn({ method: "POST" })
  .validator((d: { id: string; secret: string; identificador: string; senha: string }) => d)
  .handler(async ({ data }) => {
    const { approveTicket } = await import("./auth-store.server");
    return approveTicket(data.id, data.secret, data.identificador, data.senha);
  });

export const linkQrDevice = createServerFn({ method: "POST" })
  .validator((d: { identificador: string; senha: string; label: string; print?: string }) => d)
  .handler(async ({ data }) => {
    const { clientIp, clientUa, writeDeviceCookie } = await import("./client-ip.server");
    const { linkDevice } = await import("./auth-store.server");
    const res = await linkDevice(data.identificador, data.senha, data.label, clientIp(), clientUa(), data.print ?? "");
    if (res.ok) writeDeviceCookie(res.deviceId, res.secret);
    return res;
  });

export const approveQrDevice = createServerFn({ method: "POST" })
  .validator((d: { id: string; secret: string; deviceId?: string; deviceSecret?: string; print?: string }) => d)
  .handler(async ({ data }) => {
    const { clientIp, clientUa, parseDeviceCookie, writeDeviceCookie } = await import("./client-ip.server");
    const { unlockTicket } = await import("./auth-store.server");
    const cookie = parseDeviceCookie();
    const res = await unlockTicket(
      data.id,
      data.secret,
      {
        deviceId: data.deviceId || cookie?.deviceId,
        secret: data.deviceSecret || cookie?.secret,
      },
      clientIp(),
      clientUa(),
      data.print ?? "",
    );
    if (res.ok) writeDeviceCookie(res.deviceId, res.secret);
    return res;
  });

export const createQrPairing = createServerFn({ method: "POST" })
  .validator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const { createPairing } = await import("./auth-store.server");
    return createPairing(data.userId);
  });

export const claimQrPairing = createServerFn({ method: "POST" })
  .validator((d: { token: string; label: string; deviceId?: string; deviceSecret?: string; print?: string }) => d)
  .handler(async ({ data }) => {
    const { clientIp, clientUa, parseDeviceCookie, writeDeviceCookie } = await import("./client-ip.server");
    const { claimPairing } = await import("./auth-store.server");
    const cookie = parseDeviceCookie();
    const res = await claimPairing(
      data.token,
      data.label,
      clientIp(),
      clientUa(),
      {
        deviceId: data.deviceId || cookie?.deviceId || "",
        secret: data.deviceSecret || cookie?.secret || "",
      },
      data.print ?? "",
    );
    if (res.ok) writeDeviceCookie(res.deviceId, res.secret);
    return res;
  });

export const loginThisDevice = createServerFn({ method: "POST" })
  .validator((d: { deviceId?: string; deviceSecret?: string; print?: string }) => d)
  .handler(async ({ data }) => {
    const { clientIp, clientUa, parseDeviceCookie, writeDeviceCookie } = await import("./client-ip.server");
    const { loginByDevice } = await import("./auth-store.server");
    const cookie = parseDeviceCookie();
    const res = await loginByDevice(
      {
        deviceId: data.deviceId || cookie?.deviceId,
        secret: data.deviceSecret || cookie?.secret,
      },
      clientIp(),
      clientUa(),
      data.print ?? "",
    );
    if (res.ok) writeDeviceCookie(res.deviceId, res.secret);
    return res;
  });

export const rememberQrStation = createServerFn({ method: "POST" })
  .validator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const { clientIp } = await import("./client-ip.server");
    const { rememberStation } = await import("./auth-store.server");
    return rememberStation(data.userId, clientIp());
  });

export const resumeQrStation = createServerFn({ method: "POST" })
  .validator((d: { id: string; secret: string }) => d)
  .handler(async ({ data }) => {
    const { clientIp } = await import("./client-ip.server");
    const { resumeStation } = await import("./auth-store.server");
    return resumeStation(data.id, data.secret, clientIp());
  });

export const peekQrStation = createServerFn({ method: "POST" })
  .validator((d: { id: string; secret: string }) => d)
  .handler(async ({ data }) => {
    const { peekStation } = await import("./auth-store.server");
    return peekStation(data.id, data.secret);
  });

export const listQrDevices = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const { listDevices } = await import("./auth-store.server");
    return listDevices();
  });

export const revokeQrDevice = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { revokeDevice } = await import("./auth-store.server");
    return revokeDevice(data.id);
  });

export const clearAuthSession = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const { clearAuthCookie } = await import("./client-ip.server");
    clearAuthCookie();
    return { ok: true as const };
  });

export const probeLoginAccess = createServerFn({ method: "POST" })
  .validator((d: { print?: string; deviceId?: string; deviceSecret?: string } = {}) => d)
  .handler(async ({ data }) => {
    const { clientIp, clientUa, parseDeviceCookie } = await import("./client-ip.server");
    const { probeAccess } = await import("./auth-store.server");
    const cookie = parseDeviceCookie();
    return probeAccess(
      data.print ?? "",
      {
        deviceId: data.deviceId || cookie?.deviceId,
        secret: data.deviceSecret || cookie?.secret,
      },
      clientIp(),
      clientUa(),
    );
  });

export const listTeamLogin = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const { listTeam } = await import("./auth-store.server");
    return listTeam();
  });

export const authenticateRemote = createServerFn({ method: "POST" })
  .validator((d: { identificador: string; senha: string; print?: string; deviceId?: string; deviceSecret?: string; rememberDevice?: boolean }) => d)
  .handler(async ({ data }) => {
    const { clientIp, clientUa, parseDeviceCookie, writeDeviceCookie } = await import("./client-ip.server");
    const { authenticate } = await import("./auth-store.server");
    const cookie = parseDeviceCookie();
    const res = await authenticate(
      data.identificador,
      data.senha,
      clientIp(),
      clientUa(),
      data.print ?? "",
      {
        deviceId: data.deviceId || cookie?.deviceId,
        secret: data.deviceSecret || cookie?.secret,
      },
      Boolean(data.rememberDevice),
    );
    if (res.ok && "deviceId" in res && res.deviceId && res.secret) writeDeviceCookie(res.deviceId, res.secret);
    return res;
  });

export const forgetThisDevice = createServerFn({ method: "POST" })
  .validator(() => ({}))
  .handler(async () => {
    const { clearDeviceCookie } = await import("./client-ip.server");
    clearDeviceCookie();
    return { ok: true as const };
  });

export const pingPhoneSeat = createServerFn({ method: "POST" })
  .validator((d: { deviceId?: string; deviceSecret?: string; print?: string }) => d)
  .handler(async ({ data }) => {
    const { clientIp, parseDeviceCookie } = await import("./client-ip.server");
    const { pingPhoneSeat: ping } = await import("./auth-store.server");
    const cookie = parseDeviceCookie();
    return ping(data.deviceId || cookie?.deviceId, data.deviceSecret || cookie?.secret, clientIp(), data.print ?? "");
  });

export const releasePhoneSeat = createServerFn({ method: "POST" })
  .validator((d: { deviceId?: string; deviceSecret?: string }) => d)
  .handler(async ({ data }) => {
    const { parseDeviceCookie } = await import("./client-ip.server");
    const { releasePhoneSeat: release } = await import("./auth-store.server");
    const cookie = parseDeviceCookie();
    return release(data.deviceId || cookie?.deviceId, data.deviceSecret || cookie?.secret);
  });

export const deleteRemoteUser = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { deleteUser } = await import("./auth-store.server");
    return deleteUser(data.id);
  });

export const upsertRemoteUser = createServerFn({ method: "POST" })
  .validator(
    (d: {
      id?: string;
      nome: string;
      email: string;
      senha?: string;
      nivel_acesso: string;
      status?: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { upsertUser } = await import("./auth-store.server");
    return upsertUser(data);
  });

export const resetRemotePassword = createServerFn({ method: "POST" })
  .validator((d: { email: string; nome: string; novaSenha: string }) => d)
  .handler(async ({ data }) => {
    const { resetPassword } = await import("./auth-store.server");
    return resetPassword(data.email, data.nome, data.novaSenha);
  });

export const importRemoteUsers = createServerFn({ method: "POST" })
  .validator((d: { users: { user: Usuario; senha?: string }[] }) => d)
  .handler(async ({ data }) => {
    const { importUsers } = await import("./auth-store.server");
    return importUsers(data.users);
  });
