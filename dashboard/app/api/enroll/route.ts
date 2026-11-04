import { body,json,validOrigin } from "../../../lib/control";
import { database,digest,equal,limited,passwordHash,pepper,randomToken,validCredentials } from "../../../lib/auth";
export async function POST(request:Request) {
 if(!validOrigin(request))return json({error:"Ungültiger Ursprung."},403);
 try {
  const input=await body(request,2048);
  if(await limited(request,typeof input.username==="string"?input.username:""))return json({error:"Zu viele Versuche. In 15 Minuten erneut versuchen."},429);
  if(!validCredentials(input.username,input.password))return json({error:"Benutzername oder Passwortlänge ungültig."},400);
  const name=input.username.toLowerCase();
  if(input.register===true){const salt=randomToken(16),hash=await passwordHash(input.password,salt,pepper());const added=await database().prepare("INSERT INTO auth_accounts (username,salt,password_hash) VALUES (?,?,?) ON CONFLICT(username) DO NOTHING RETURNING id").bind(name,salt,hash).first();if(!added)return json({error:"Benutzername vergeben. Mit dem bestehenden Konto anmelden."},409);}
  const account=await database().prepare("SELECT id,salt,password_hash FROM auth_accounts WHERE username=?").bind(name).first<{id:number;salt:string;password_hash:string}>();
  const hash=await passwordHash(input.password,account?.salt||"00000000000000000000000000000000",pepper());
  if(!account||!equal(hash,account.password_hash))return json({error:"Benutzername oder Passwort falsch."},401);
  const id=crypto.randomUUID(), token=randomToken();
  await database().prepare("INSERT INTO devices (id,snapshot,updated,owner_id,token_hash) VALUES (?,'{}',0,?,?)").bind(id,account.id,await digest(token)).run();
  const origin=new URL(request.url).origin;
  return json({siteUrl:origin,serverId:id,deviceToken:token,website:origin+"/?server="+encodeURIComponent(id)});
 }catch{return json({error:"Handy konnte nicht verknüpft werden."},400);}
}
