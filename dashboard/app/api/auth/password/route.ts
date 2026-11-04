import { database, digest, equal, limited, passwordHash, pepper, randomToken, requestUser, sessionCookie, validCredentials } from "../../../../lib/auth";
import { body, json, validOrigin } from "../../../../lib/control";

export async function POST(request: Request) {
    if (!validOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
    const user = await requestUser(request);
    if (!user) return json({ error: "Anmeldung erforderlich." }, 401);
    try {
        const { currentPassword, newPassword } = await body(request, 2048);
        if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 128 ||
            !validCredentials(user.username, newPassword)) return json({ error: "Das neue Passwort braucht 14 bis 128 Zeichen." }, 400);
        if (await limited(request, user.username)) return json({ error: "Zu viele Versuche. Bitte später erneut versuchen." }, 429);
        const db = database();
        const old = await db.prepare("SELECT salt,password_hash FROM auth_accounts WHERE id=?").bind(user.id)
            .first<{ salt: string; password_hash: string }>();
        if (!old || !equal(old.password_hash, await passwordHash(currentPassword, old.salt, pepper()))) {
            return json({ error: "Passwort falsch." }, 403);
        }
        const salt = randomToken(16), token = randomToken();
        const hash = await passwordHash(newPassword as string, salt, pepper());
        const [updated] = await db.batch([
            db.prepare("UPDATE auth_accounts SET salt=?,password_hash=? WHERE id=? AND password_hash=? RETURNING id").bind(salt, hash, user.id, old.password_hash),
            db.prepare("DELETE FROM auth_sessions WHERE account_id=? AND EXISTS(SELECT 1 FROM auth_accounts WHERE id=? AND salt=?)").bind(user.id, user.id, salt),
            db.prepare("INSERT INTO auth_sessions(token_hash,account_id,expires) SELECT ?,id,? FROM auth_accounts WHERE id=? AND salt=?")
                .bind(await digest(token), Date.now() + 86400000, user.id, salt),
        ]);
        if (!updated.results.length) return json({ error: "Passwort wurde bereits geändert. Bitte erneut anmelden." }, 409);
        return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(token), "Cache-Control": "no-store" } });
    } catch {
        return json({ error: "Passwort konnte nicht geändert werden." }, 400);
    }
}
