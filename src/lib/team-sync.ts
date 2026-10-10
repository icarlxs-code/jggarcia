import { db } from "./store";
import { listTeamLogin } from "./qr-auth";

export async function syncTeamFromServer() {
  try {
    const remote = await listTeamLogin({ data: {} });
    db.applyDeleted(remote.apagados ?? []);
    for (const user of remote.users ?? []) db.acceptRemoteUser(user);
  } catch {
    /* offline */
  }
}
