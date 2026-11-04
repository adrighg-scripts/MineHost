import { access } from "../../../lib/permissions";
import { bindings, body, json, validOrigin } from "../../../lib/control";

export async function POST(request: Request) {
    if (!validOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
    const allowed = await access(request, "settings.write");
    if (!allowed?.server.owner) return json({ error: "Nur der Besitzer kann das Gerät umbenennen." }, 403);
    try {
        const input = await body(request, 1024);
        const label = typeof input.label === "string" ? input.label.trim() : "";
        if (!label || label.length > 48 || /[\u0000-\u001f\u007f]/.test(label)) return json({ error: "Ungültiger Gerätename." }, 400);
        await bindings().db.prepare("UPDATE devices SET snapshot=json_set(snapshot,'$.hostLabel',?) WHERE id=? AND owner_id=?")
            .bind(label, allowed.server.id, allowed.user.id).run();
        return json({ ok: true });
    } catch {
        return json({ error: "Gerätename konnte nicht gespeichert werden." }, 400);
    }
}
