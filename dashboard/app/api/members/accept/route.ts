import { body,json,validOrigin } from "../../../../lib/control";
import { database,digest,sessionFromCookie } from "../../../../lib/auth";
export async function POST(request:Request){
 if(!validOrigin(request))return json({error:"Ungültiger Ursprung."},403);
 const user=await sessionFromCookie(request.headers.get("cookie"));if(!user)return json({error:"Bitte zuerst anmelden oder ein Konto erstellen."},401);
 try{
  const input=await body(request,1024);if(typeof input.token!=="string"||! /^[a-f0-9]{64}$/.test(input.token))return json({error:"Ungültige Einladung."},400);
  const db=database(),hash=await digest(input.token),now=Date.now();
  const result=await db.batch([
   db.prepare("INSERT INTO invitation_redemptions (token_hash,account_id) SELECT token_hash,? FROM invitations WHERE token_hash=? AND expires>? AND revoked=0 AND (max_uses=0 OR uses<max_uses) AND (recipient='' OR recipient=?) AND NOT EXISTS(SELECT 1 FROM invitation_redemptions WHERE token_hash=? AND account_id=?) ON CONFLICT DO NOTHING").bind(user.id,hash,now,user.username.toLowerCase(),hash,user.id),
   db.prepare("UPDATE invitations SET uses=uses+1 WHERE token_hash=? AND changes()=1 RETURNING device_id,permissions,access_hours").bind(hash),
   db.prepare("INSERT INTO members (id,device_id,account_id,permissions,expires) SELECT device_id||':'||?,device_id,?,permissions,CASE WHEN access_hours=0 THEN 0 ELSE ?+access_hours*3600000 END FROM invitations WHERE token_hash=? AND changes()=1 AND NOT EXISTS(SELECT 1 FROM devices WHERE id=device_id AND owner_id=?) ON CONFLICT(id) DO UPDATE SET permissions=excluded.permissions,expires=excluded.expires WHERE members.expires>0 AND members.expires<=?").bind(user.id,user.id,now,hash,user.id,now)
  ]);
  const invite=result[1].results[0] as {device_id:string}|undefined;if(!invite)return json({error:"Einladung abgelaufen, aufgebraucht oder nicht für dieses Konto bestimmt."},410);
  return json({server:invite.device_id});
 }catch{return json({error:"Einladung konnte nicht angenommen werden."},400);}
}
