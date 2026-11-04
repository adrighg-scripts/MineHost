import { validOrigin, json } from "../../../../lib/control";
import { database, digest, sessionCookie, SESSION_COOKIE } from "../../../../lib/auth";
export async function POST(request: Request) {
  if (!validOrigin(request) && (request.headers.has("origin") || request.headers.get("sec-fetch-site") !== "same-origin")) return json({ error:"Abmeldung fehlgeschlagen. Öffne MineHost direkt im Browser." },403);
  const token = request.headers.get("cookie")?.split(";").map(value=>value.trim()).find(value=>value.startsWith(SESSION_COOKIE+"="))?.slice(SESSION_COOKIE.length+1);
  if (token && /^[a-f0-9]{64}$/.test(token)) await database().prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await digest(token)).run();
  return new Response(null,{status:303,headers:{Location:"/","Set-Cookie":sessionCookie("",0),"Cache-Control":"no-store"}});
}
