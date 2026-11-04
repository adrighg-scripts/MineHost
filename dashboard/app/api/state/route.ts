import { bindings, isAdmin, json } from "../../../lib/control";
import { access,ACTIONS } from "../../../lib/permissions";
export async function GET(request: Request) {
  if (!await isAdmin(request)) return json({ error: "Anmeldung erforderlich." }, 401);
  const allowed=await access(request);if(!allowed)return json({error:"Kein Zugriff auf diesen Server."},403);
  const { db } = bindings();
  const now=Date.now();await db.prepare("UPDATE devices SET active_until=? WHERE id=? AND active_until < ?").bind(now+15000,allowed.server.id,now+8000).run();
  const device = await db.prepare("SELECT snapshot, updated FROM devices WHERE id = ?").bind(allowed.server.id).first<{ snapshot: string; updated: number }>();
  const jobs = await db.prepare("SELECT id,kind,state,created,json_extract(result,'$.error') AS error,json_extract(result,'$.message') AS message FROM jobs WHERE device_id=? AND (? OR requested_by=?) ORDER BY created DESC LIMIT 24").bind(allowed.server.id,allowed.server.owner?1:0,allowed.user.id).all();
  const snapshot=device?{...JSON.parse(device.snapshot),updated:device.updated,online:Date.now()-device.updated<30000}:null;
  if(snapshot?.profileId&&snapshot.profileId!=="default"&&!allowed.server.owner)return json({error:"Dieses Serverprofil ist privat."},403);
  if(snapshot)delete snapshot.hostIdentity;
  if(snapshot&&!allowed.server.owner)delete snapshot.profiles;
  if(snapshot&&!allowed.server.permissions.includes("console.read"))snapshot.console="";
  if(snapshot?.internet&&!allowed.server.permissions.includes("network")){delete snapshot.internet.claimUrl;delete snapshot.internet.message;}
  return json({device:snapshot,permissions:allowed.server.permissions,owner:allowed.server.owner,jobs:jobs.results.filter((job:any)=>allowed.server.owner||allowed.server.permissions.includes(ACTIONS[job.kind])).map((job:any)=>({id:job.id,kind:job.kind,state:job.state,created:job.created,result:job.error||job.message?{error:job.error,message:job.message}:null}))});
}
