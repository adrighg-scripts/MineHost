import { env } from "cloudflare:workers";
const UA="MineHost/0.7 (https://minehost-control-20261102.waxengleam1.chatgpt.site)";
export async function api(source:string,path:string){const headers:Record<string,string>={"User-Agent":UA};let root="https://api.modrinth.com/v2";if(source==="curseforge"){const key=(env as any).CURSEFORGE_API_KEY;if(!key)throw new Error("CurseForge braucht noch einen API-Zugang. Modrinth kannst du sofort nutzen.");headers['x-api-key']=key;root="https://api.curseforge.com/v1";}const response=await fetch(root+path,{headers,signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error("Der Katalog ist gerade nicht erreichbar oder bietet diese Datei nicht an.");return response.json() as Promise<any>;}
const loaders=(mods:boolean)=>mods?["fabric"]:["paper","spigot","bukkit"];
export async function search(source:string,query:string,version:string,mods:boolean){
 if(source==="modrinth"){const facets=JSON.stringify([["versions:"+version],loaders(mods).map(value=>"categories:"+value),["server_side:required","server_side:optional"]]);const result=await api(source,"/search?limit=20&query="+encodeURIComponent(query)+"&facets="+encodeURIComponent(facets));return result.hits.map((item:any)=>({id:item.project_id,name:item.title,icon:item.icon_url,description:item.description,downloads:item.downloads,url:"https://modrinth.com/"+(mods?"mod/":"plugin/")+item.slug}));}
 const result=await api(source,"/mods/search?gameId=432&classId="+(mods?6:5)+"&pageSize=20&gameVersion="+encodeURIComponent(version)+(mods?"&modLoaderType=4":"")+"&searchFilter="+encodeURIComponent(query));return result.data.map((item:any)=>({id:String(item.id),name:item.name,icon:item.logo?.thumbnailUrl,description:item.summary,downloads:item.downloadCount,url:item.links.websiteUrl}));
}
export async function plan(source:string,id:string,gameVersion:string,mods:boolean){
 const result:any[]=[],seen=new Map<string,string>();
 async function resolve(project:string,exact?:string){
  if(result.length>=40)throw new Error("Zu viele benötigte Erweiterungen.");
  if(source==="modrinth"){
   const meta=await api(source,"/project/"+encodeURIComponent(project));if(meta.server_side==="unsupported")throw new Error(meta.title+" ist nur für den Client.");
   let version:any;if(exact)version=await api(source,"/version/"+encodeURIComponent(exact));else{const candidates=await api(source,"/project/"+encodeURIComponent(project)+"/version?game_versions="+encodeURIComponent(JSON.stringify([gameVersion]))+"&loaders="+encodeURIComponent(JSON.stringify(loaders(mods))));version=candidates.find((v:any)=>v.version_type==="release");}
   if(!version||!version.game_versions.includes(gameVersion)||!version.loaders.some((value:string)=>loaders(mods).includes(value)))throw new Error("Keine passende veröffentlichte Version für "+meta.title+" gefunden.");
   if(seen.has(meta.id)){if(seen.get(meta.id)!==version.id&&exact)throw new Error("Widersprüchliche Abhängigkeiten für "+meta.title);return;}seen.set(meta.id,version.id);
   const file=version.files.find((v:any)=>v.primary)||version.files[0];if(!file||!file.filename.endsWith(".jar"))throw new Error("Keine Server-JAR verfügbar.");result.push({projectId:meta.id,source,icon:meta.icon_url,title:meta.title,name:file.filename,url:file.url,hash:file.hashes.sha512||file.hashes.sha1,algorithm:file.hashes.sha512?"SHA-512":"SHA-1"});
   for(const dependency of version.dependencies||[])if(dependency.dependency_type==="required"){if(dependency.project_id)await resolve(dependency.project_id,dependency.version_id||undefined);else if(dependency.version_id){const dep=await api(source,"/version/"+encodeURIComponent(dependency.version_id));await resolve(dep.project_id,dep.id);}else throw new Error("Eine erforderliche Abhängigkeit muss manuell installiert werden.");}
  }else{
   if(seen.has(project))return;seen.set(project,"resolving");const data=await api(source,"/mods/"+encodeURIComponent(project)+"/files?gameVersion="+encodeURIComponent(gameVersion)+(mods?"&modLoaderType=4":""));const file=data.data.find((v:any)=>v.releaseType===1);if(!file||!file.downloadUrl)throw new Error("Der Autor bietet keinen automatischen Download für diese Version an.");const hash=file.hashes.find((h:any)=>h.algo===1);if(!hash)throw new Error("Datei hat keine unterstützte Prüfsumme.");result.push({projectId:project,source,name:file.fileName,url:file.downloadUrl,hash:hash.value,algorithm:"SHA-1"});for(const dep of file.dependencies||[])if(dep.relationType===3)await resolve(String(dep.modId));
  }
 }
 await resolve(id);return {files:result,gameVersion};
}
