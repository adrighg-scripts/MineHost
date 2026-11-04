import { body, isDevice, json } from "../../../../lib/control";
import { database, passwordHash, pepper, randomToken, validCredentials } from "../../../../lib/auth";
async function legacyAccount(request: Request) {
  if (!await isDevice(request)) return json({error:"Unauthorized"},401);
  try {
    const input=await body(request,2048);
    if (!validCredentials(input.username,input.password)) return json({error:"Benutzername: 3–32 Zeichen (a–z, Zahlen, _.-). Passwort: 14–128 Zeichen."},400);
    if (await database().prepare("SELECT id FROM auth_accounts WHERE id=1").first()) return json({error:"Ein Website-Zugang existiert bereits. Er wird nicht überschrieben."},409);
    const salt=randomToken(16), hash=await passwordHash(input.password,salt,pepper());
    const created=await database().prepare("INSERT INTO auth_accounts (id,username,salt,password_hash) VALUES (1,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id").bind(input.username.toLowerCase(),salt,hash).first();
    return created ? json({message:"Zugang erstellt. Melde dich auf deiner Website an."}) : json({error:"Ein Website-Zugang existiert bereits."},409);
  } catch { return json({error:"Zugang konnte nicht erstellt werden."},400); }
}
export async function POST() {return json({error:"Bitte die aktuelle MineHost-App installieren und dort dein Konto erstellen."},410);}
