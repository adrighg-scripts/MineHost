import { env } from "cloudflare:workers";
import { digest, equal, passwordHash, randomToken, validCredentials } from "./passwords";
export { digest, equal, passwordHash, randomToken, validCredentials };
export const SESSION_COOKIE = "__Host-minehost_session";
export function database() { if (!env.DB) throw new Error("Login storage unavailable"); return env.DB; }
export function pepper() { if (!env.AUTH_PEPPER) throw new Error("Login secret unavailable"); return env.AUTH_PEPPER; }
export async function sessionFromCookie(cookie: string | null) {
  const token = cookie?.split(";").map(part => part.trim()).find(part => part.startsWith(SESSION_COOKIE + "="))?.slice(SESSION_COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return database().prepare("SELECT a.id, a.username FROM auth_sessions s JOIN auth_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires > ?")
    .bind(await digest(token), Date.now()).first<{ id: number; username: string }>();
}
const identities=new WeakMap<Request,ReturnType<typeof sessionFromCookie>>();
export function requestUser(request:Request){let user=identities.get(request);if(!user){user=sessionFromCookie(request.headers.get("cookie"));identities.set(request,user);}return user;}
export async function isAdmin(request: Request) { return !!await requestUser(request); }
export async function limited(request: Request, account = "") {
  const now = Date.now(), period = Math.floor(now / 900000);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const key = await digest("login:" + ip + ":" + account.slice(0,32).toLowerCase() + ":" + period);
  const global = "all:" + period;
  const results = await database().batch([key, global].map(value => database().prepare("INSERT INTO auth_limits (id, attempts, expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts").bind(value, now + 900000)));
  await database().prepare("DELETE FROM auth_limits WHERE expires < ?").bind(now).run();
  return Number((results[0].results[0] as any).attempts) > 5 || Number((results[1].results[0] as any).attempts) > 100;
}
export function sessionCookie(token: string, maxAge = 86400) { return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`; }
