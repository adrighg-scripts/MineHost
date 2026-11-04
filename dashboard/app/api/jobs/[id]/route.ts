import { bindings,isAdmin,json } from "../../../../lib/control";
import { access,ACTIONS } from "../../../../lib/permissions";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 if(!await isAdmin(request))return json({error:"Anmeldung erforderlich."},401);
 const allowed=await access(request);if(!allowed)return json({error:"Kein Zugriff."},403);
 const {id}=await context.params;
 const job=await bindings().db.prepare("SELECT id,kind,state,result,requested_by FROM jobs WHERE id=? AND device_id=?").bind(id,allowed.server.id).first<{id:string;kind:string;state:string;result:string|null;requested_by:number}>();
 if(!job||(!allowed.server.owner&&(job.requested_by!==allowed.user.id||!allowed.server.permissions.includes(ACTIONS[job.kind]))))return json({error:"Aktion nicht verfügbar."},404);
 return json({id:job.id,kind:job.kind,state:job.state,result:job.result?JSON.parse(job.result):null});
}
