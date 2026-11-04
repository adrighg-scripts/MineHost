import { equal, limited, passwordHash, pepper } from "../../../lib/auth";
import { bindings, body, isAdmin, json, KINDS, validOrigin } from "../../../lib/control";
import { access,ACTIONS } from "../../../lib/permissions";
export async function POST(request: Request) {
  if (!await isAdmin(request)) return json({ error: "Anmeldung erforderlich." }, 401);
  if (!validOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
  try {
    const input = await body(request, 350000);
    if (!KINDS.has(input.kind) || typeof input.payload !== "object" || input.payload === null) return json({ error: "Ungültige Aktion." }, 400);
    if(!ACTIONS[input.kind])return json({error:"Nicht unterstützte Aktion."},400);
    const allowed=await access(request,ACTIONS[input.kind]);if(!allowed)return json({error:"Dafür fehlen dir die Rechte."},403);
    if(["setup","software_install","backup_schedule_save","profiles_list","profiles_rename","device_remove_begin","device_remove_verify","profiles_delete_begin","profiles_delete","profiles_create","profiles_select"].includes(input.kind)&&!allowed.server.owner)return json({error:"Nur der Besitzer darf diese Aktion ausführen."},403);
    if(input.kind==="files_write"&&typeof input.payload.path==="string"&&input.payload.path.split("/").filter((part:string)=>part&&part!==".").join("/")==="server.properties"&&!await access(request,"settings.write"))return json({error:"Für server.properties brauchst du zusätzlich das Recht für Servereinstellungen."},403);
    const { db } = bindings();
    if (input.kind === "profiles_delete_begin" || input.kind === "device_remove_begin") {
      const password = input.payload.password;
      if (typeof password !== "string" || password.length > 128) return json({ error: "Passwort erforderlich." }, 400);
      if (await limited(request, allowed.user.username)) return json({ error: "Zu viele Versuche. Bitte später erneut versuchen." }, 429);
      const account = await db.prepare("SELECT salt,password_hash FROM auth_accounts WHERE id=?").bind(allowed.user.id)
        .first<{salt: string; password_hash: string}>();
      if (!account || !equal(account.password_hash, await passwordHash(password, account.salt, pepper()))) {
        return json({ error: "Passwort falsch." }, 403);
      }
      input.payload = {};
    }
    const phone = await db.prepare("SELECT updated,json_extract(snapshot,'$.profileId') AS profile FROM devices WHERE id = ?").bind(allowed.server.id).first<{updated:number;profile:string|null}>();
    if (!phone || Date.now() - phone.updated > 30000) return json({ error: "Das Handy ist nicht verbunden." }, 409);
    if (input.kind === "network_configure" && input.payload.configured === true) {
      const port = input.payload.externalPort;
      if (!Number.isInteger(port) || port < 1 || port > 65535) return json({ error: "Ungültiger TCP-Port." }, 400);
      const current = await db.prepare("SELECT json_extract(snapshot,'$.publicAccess.candidate') AS candidate FROM devices WHERE id=?")
        .bind(allowed.server.id).first<{ candidate: string | null }>();
      const ip = current?.candidate?.split(":")[0];
      if (ip && /^[0-9]+(\.[0-9]+){3}$/.test(ip)) {
        const conflict = await db.prepare("SELECT id FROM devices WHERE owner_id=? AND id<>? AND json_extract(snapshot,'$.publicAccess.configured')=1 AND json_extract(snapshot,'$.publicAccess.candidate')=? LIMIT 1")
          .bind(allowed.user.id, allowed.server.id, ip + ":" + port).first();
        if (conflict) return json({ error: "Diese öffentliche IP mit diesem TCP-Port ist bereits für ein anderes Host-Gerät eingerichtet." }, 409);
      }
    }
    const profile=phone.profile||"default";
    if(profile!=="default"&&!allowed.server.owner)return json({error:"Dafür fehlen dir die Rechte."},403);
    if((input.profileId||"default")!==profile)return json({error:"Das Serverprofil wurde gewechselt. Bitte die Seite neu laden."},409);
    input.payload._profile=profile;
    const count = await db.prepare("SELECT count(*) AS n FROM jobs WHERE device_id=? AND state IN ('queued', 'leased') AND expires > ?").bind(allowed.server.id,Date.now()).first<{ n: number }>();
    if ((count?.n ?? 0) >= 12) return json({ error: "Bitte laufende Aktionen abwarten." }, 429);
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO jobs (id, kind, payload, state, created, expires,device_id,requested_by) VALUES (?, ?, ?, 'queued', ?, ?,?,?)")
      .bind(id, input.kind, JSON.stringify(input.payload), Date.now(), Date.now() + 120000,allowed.server.id,allowed.user.id).run();
    return json({ id });
  } catch { return json({ error: "Anfrage konnte nicht verarbeitet werden." }, 400); }
}
