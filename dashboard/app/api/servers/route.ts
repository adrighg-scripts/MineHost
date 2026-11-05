import { bindings, isAdmin, json } from "../../../lib/control";
import { requestUser } from "../../../lib/auth";

export async function GET(request: Request) {
  if (!await isAdmin(request)) return json({ error: "Anmeldung erforderlich." }, 401);
  const user = await requestUser(request);
  if (!user) return json({ error: "Anmeldung erforderlich." }, 401);
  const { db } = bindings();
  const rows = await db.prepare(
    "SELECT id, updated, snapshot FROM devices WHERE owner_id = ?"
  ).bind(user.id).all<{ id: string; updated: number; snapshot: string }>();

  const list = (rows.results || []).map(r => {
    let snap: any = {};
    try { snap = JSON.parse(r.snapshot); } catch {}
    return {
      id: r.id,
      online: Date.now() - r.updated < 30000,
      phase: snap.phase || "stopped",
      model: snap.hostLabel || snap.model || "Server",
      profileName: snap.profileName || snap.model || "Server",
      software: snap.software,
      cpu: snap.cpu,
      rssMb: snap.rssMb,
      ram: snap.ram,
      onlinePlayers: snap.onlinePlayers || 0,
      address: snap.publicAccess?.address || snap.publicAccess?.candidate || snap.lan || "",
    };
  });

  return json({ servers: list });
}

