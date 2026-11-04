import { body,json,validOrigin } from "../../../../lib/control";
import { database,limited,passwordHash,pepper,randomToken,validCredentials } from "../../../../lib/auth";
export async function POST(request:Request) {
 if(!validOrigin(request))return json({error:"Ungültiger Ursprung."},403);
 try {
  const input=await body(request,2048);
  if(await limited(request,typeof input.username==="string"?input.username:""))return json({error:"Zu viele Versuche. In 15 Minuten erneut versuchen."},429);
  if(!validCredentials(input.username,input.password))return json({error:"Benutzername: 3–32 Zeichen. Passwort: 14–128 Zeichen."},400);
  const salt=randomToken(16),hash=await passwordHash(input.password,salt,pepper());
  const account=await database().prepare("INSERT INTO auth_accounts (username,salt,password_hash) VALUES (?,?,?) ON CONFLICT(username) DO NOTHING RETURNING id").bind(input.username.toLowerCase(),salt,hash).first();
  return account?json({ok:true}):json({error:"Dieser Benutzername ist bereits vergeben."},409);
 }catch{return json({error:"Konto konnte nicht erstellt werden."},400);}
}
