import { access } from "../../../lib/permissions";
import { bindings, body, json, validOrigin } from "../../../lib/control";
import { equal, limited, passwordHash, pepper, requestUser } from "../../../lib/auth";

export async function POST(request: Request) {
    if (!validOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
    try {
        const { receipt, target: requestedTarget, password } = await body(request, 1024);
        const { db } = bindings();
        if (password !== undefined) {
            const user = await requestUser(request);
            if (!user) return json({ error: "Anmeldung erforderlich." }, 401);
            if (typeof requestedTarget !== "string" || !/^(phone|[a-f0-9-]{36})$/.test(requestedTarget) ||
                typeof password !== "string" || !password || password.length > 128) {
                return json({ error: "Gerät und Passwort erforderlich." }, 400);
            }
            const target = await db.prepare("SELECT updated FROM devices WHERE id=? AND owner_id=?")
                .bind(requestedTarget, user.id).first<{ updated: number }>();
            if (!target) return json({ error: "Nur der Besitzer kann das Gerät entfernen." }, 403);
            if (target.updated > Date.now() - 30000) return json({ error: "Das Gerät ist wieder online. Verwende die Bestätigung im Spiel." }, 409);
            if (await limited(request, user.username)) return json({ error: "Zu viele Versuche. Bitte später erneut versuchen." }, 429);
            const account = await db.prepare("SELECT salt,password_hash FROM auth_accounts WHERE id=?")
                .bind(user.id).first<{ salt: string; password_hash: string }>();
            if (!account || !equal(account.password_hash, await passwordHash(password, account.salt, pepper()))) {
                return json({ error: "Passwort falsch." }, 403);
            }
            const removed = await db.prepare(
                "UPDATE devices SET token_hash=NULL, owner_id=NULL, updated=0, snapshot=json_set(snapshot,'$.unlinked',1) WHERE id=? AND owner_id=? AND updated<=? AND NOT EXISTS (SELECT 1 FROM devices AS host WHERE host.owner_id=? AND host.updated>? AND json_extract(host.snapshot,'$.phase')='running' AND json_extract(host.snapshot,'$.managementVersion')>=12) RETURNING id"
            ).bind(requestedTarget, user.id, Date.now() - 30000, user.id, Date.now() - 30000).first();
            return removed ? json({ ok: true }) : json({ error: "Wähle das Gerät mit dem laufenden Server und bestätige die Entfernung dort im Spiel." }, 409);
        }
        const allowed = await access(request, "settings.write");
        if (!allowed?.server.owner) return json({ error: "Nur der Besitzer kann das Gerät entfernen." }, 403);
        if (typeof receipt !== "string" || !/^[a-f0-9-]{36}$/.test(receipt)) return json({ error: "Bestätigung fehlt." }, 400);
        const target = requestedTarget ?? allowed.server.id;
        if (typeof target !== "string" || (target !== "phone" && !/^[a-f0-9-]{36}$/.test(target))) {
            return json({ error: "Ungültiges Gerät." }, 400);
        }
        const now = Date.now();
        const cutoff = now - 180000;
        const update = await db.prepare(
            "UPDATE devices SET token_hash=NULL, owner_id=NULL, updated=0, snapshot=json_set(snapshot,'$.unlinked',1) WHERE id=? AND owner_id=? AND (id=? OR updated<=?) AND EXISTS (SELECT 1 FROM jobs WHERE id=? AND device_id=? AND COALESCE(json_extract(payload,'$.target'),device_id)=devices.id AND requested_by=devices.owner_id AND kind='device_remove_verify' AND state='done' AND created>? AND json_extract(result,'$.confirmed')=1) RETURNING id"
        ).bind(target, allowed.user.id, allowed.server.id, now - 30000, receipt, allowed.server.id, cutoff).first();
        return update ? json({ ok: true }) : json({ error: "Bestätigung fehlt oder ist abgelaufen." }, 409);
    } catch {
        return json({ error: "Gerät konnte nicht entfernt werden." }, 400);
    }
}
