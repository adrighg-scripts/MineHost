import {access} from "../../../../lib/permissions";
import {json} from "../../../../lib/control";
import {api} from "../../../../lib/catalog";
export async function GET(request:Request){const query=new URL(request.url).searchParams;if(!await access(request,query.get("type")==="mods"?"mods.read":"plugins.read"))return json({error:"Kein Zugriff."},403);try{const ids=(query.get("ids")||"").split(",").filter(id=>/^[A-Za-z0-9]{1,20}$/.test(id)).slice(0,100);if(!ids.length)return json({icons:{}});const projects=await api("modrinth","/projects?ids="+encodeURIComponent(JSON.stringify(ids)));return json({icons:Object.fromEntries(projects.map((project:any)=>[project.id,project.icon_url]))});}catch{return json({icons:{}});}}
