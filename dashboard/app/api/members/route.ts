import { body,json,validOrigin } from "../../../lib/control";
import { database,randomToken,digest } from "../../../lib/auth";
import { access,PERMISSIONS } from "../../../lib/permissions";
export async function GET(request:Request){
 const allowed=await access(request);if(!allowed?.server.owner)return json({error:"Nur der Besitzer darf Mitglieder verwalten."},403);
 const db=database();const [members,invitations]=await Promise.all([db.prepare("SELECT m.account_id,a.username,m.permissions,m.expires FROM members m JOIN auth_accounts a ON a.id=m.account_id WHERE m.device_id=?").bind(allowed.server.id).all(),db.prepare("SELECT token_hash AS id,label,recipient,permissions,expires,max_uses,uses,access_hours,revoked FROM invitations WHERE device_id=? ORDER BY rowid DESC LIMIT 100").bind(allowed.server.id).all()]);
 return json({members:members.results.map((row:any)=>({...row,permissions:JSON.parse(row.permissions)})),invitations:invitations.results.map((row:any)=>({...row,permissions:JSON.parse(row.permissions)}))});
}
export async function POST(request:Request){
 if(!validOrigin(request))return json({error:"Ungültiger Ursprung."},403);
 const allowed=await access(request);if(!allowed?.server.owner)return json({error:"Nur der Besitzer darf Mitglieder verwalten."},403);
 try{
  const input=await body(request,8192),db=database();
  if(input.action==="revoke") {await db.prepare("UPDATE invitations SET revoked=1 WHERE token_hash=? AND device_id=?").bind(input.id,allowed.server.id).run();return json({ok:true});}
  if(input.action==="remove"){
   await db.batch([db.prepare("DELETE FROM members WHERE device_id=? AND account_id=?").bind(allowed.server.id,input.accountId),db.prepare("UPDATE jobs SET state='expired' WHERE device_id=? AND requested_by=? AND state IN ('queued','leased')").bind(allowed.server.id,input.accountId)]);return json({ok:true});
  }
  if(!Array.isArray(input.permissions)||input.permissions.some((value:unknown)=>typeof value!=="string"||!PERMISSIONS.includes(value)))return json({error:"Ungültige Rechte."},400);
  const permissions=JSON.stringify([...new Set(["status",...input.permissions])]);
  if(input.action==="update"){
   const expires=input.expires==null?0:Number(input.expires);if(!Number.isSafeInteger(expires)||expires<0)return json({error:"Ungültiges Ablaufdatum."},400);
   await db.batch([db.prepare("UPDATE members SET permissions=?,expires=? WHERE device_id=? AND account_id=?").bind(permissions,expires,allowed.server.id,input.accountId),db.prepare("UPDATE jobs SET state='expired' WHERE device_id=? AND requested_by=? AND state IN ('queued','leased')").bind(allowed.server.id,input.accountId)]);return json({ok:true});
  }
  if(input.action!=="invite")return json({error:"Ungültige Aktion."},400);
  const hours=Number(input.hours??24),maxUses=Number(input.maxUses??1),accessHours=Number(input.accessHours??0),label=String(input.label||"Einladung").trim(),recipient=String(input.recipient||"").trim().toLowerCase();
  if(!Number.isInteger(hours)||hours<1||hours>8760||!Number.isInteger(maxUses)||maxUses<0||maxUses>10000||!Number.isInteger(accessHours)||accessHours<0||accessHours>87600||label.length>80||recipient&&!/^[a-z0-9_.-]{3,32}$/.test(recipient))return json({error:"Bitte Gültigkeit, Nutzungen und Empfänger prüfen."},400);
  const token=randomToken(),now=Date.now();
  await db.prepare("INSERT INTO invitations (token_hash,device_id,permissions,expires,label,recipient,max_uses,access_hours) VALUES (?,?,?,?,?,?,?,?)").bind(await digest(token),allowed.server.id,permissions,now+hours*3600000,label,recipient,maxUses,accessHours).run();
  return json({url:new URL(request.url).origin+"/#invite="+token,expires:now+hours*3600000});
 }catch{return json({error:"Mitglieder konnten nicht aktualisiert werden."},400);}
}
