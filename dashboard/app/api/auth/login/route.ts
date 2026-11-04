import { body, json, validOrigin } from "../../../../lib/control";
import { database, digest, equal, limited, passwordHash, pepper, randomToken, sessionCookie } from "../../../../lib/auth";
export async function POST(request: Request) {
  if (!validOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
  try {
    const input = await body(request, 2048);
    if (await limited(request,typeof input.username==="string"?input.username:"")) return json({ error: "Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen." }, 429);
    if (typeof input.username !== "string" || typeof input.password !== "string" || input.username.length > 32 || input.password.length > 128) return json({ error: "Benutzername oder Passwort falsch." }, 401);
    const account = await database().prepare("SELECT id, username, salt, password_hash FROM auth_accounts WHERE username=?").bind(input.username.toLowerCase()).first<{id:number;username:string;salt:string;password_hash:string}>();
    const hash = await passwordHash(input.password, account?.salt ?? "00000000000000000000000000000000", pepper());
    if (!account || !equal(account.username, input.username.toLowerCase()) || !equal(account.password_hash, hash)) return json({ error: "Benutzername oder Passwort falsch." }, 401);
    const token = randomToken(), now = Date.now();
    await database().batch([
      database().prepare("DELETE FROM auth_sessions WHERE expires < ?").bind(now),
      database().prepare("INSERT INTO auth_sessions (token_hash,account_id,expires) VALUES (?,?,?)").bind(await digest(token), account.id, now + 86400000),
    ]);
    return Response.json({ ok:true }, { headers: { "Set-Cookie": sessionCookie(token), "Cache-Control":"no-store" } });
  } catch { return json({ error: "Anmeldung momentan nicht möglich." }, 400); }
}
