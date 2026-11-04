import { database, requestUser } from "./auth";
export const PERMISSIONS = ["mods.read","mods.write","plugins.read","plugins.write","status", "power", "console.read", "console.write", "files.read", "files.write", "backups.read", "backups.create", "backups.restore", "players", "settings.read", "settings.write", "network"];
export const ACTIONS: Record<string,string> = {pumpkin_market_install:"plugins.write",voice_configure:"network",profiles_list:"settings.read",profiles_rename:"settings.write",device_remove_begin:"settings.write",device_remove_verify:"settings.write",profiles_delete_begin:"settings.write",profiles_delete:"settings.write",profiles_create:"settings.write",profiles_select:"settings.write",files_pending:"files.read",files_pending_cancel:"files.write",backup_schedule_get:"backups.read",backup_schedule_save:"backups.create",backup_inspect:"backups.read",files_uploads:"files.write",player_detail:"players",player_action:"console.write",mods_list:"mods.read",mods_upload:"mods.write",mods_toggle:"mods.write",mods_remove:"mods.write",catalog_plugins_install:"plugins.write",catalog_mods_install:"mods.write",network_configure:"network",network_check:"network",software_catalog:"settings.read",software_get:"settings.read",software_install:"settings.write",plugins_list:"plugins.read",plugins_upload:"plugins.write",plugins_toggle:"plugins.write",plugins_remove:"plugins.write",setup:"settings.write",start:"power",stop:"power",restart:"power",recover:"power",console:"console.write",files_list:"files.read",files_read:"files.read",files_download:"files.read",files_write:"files.write",files_upload:"files.write",files_move:"files.write",files_mkdir:"files.write",files_delete:"files.write",backups_list:"backups.read",backup_download:"backups.read",backup_create:"backups.create",backup_restore:"backups.restore",players_get:"players",whitelist_add:"players",whitelist_remove:"players",settings_get:"settings.read",settings_save:"settings.write",internet_start:"network",internet_stop:"network",internet_setup:"network"};
export async function serversFor(accountId:number) {
 const rows=await database().prepare("SELECT d.id,d.owner_id,d.updated,json_extract(d.snapshot,'$.model') AS model,json_extract(d.snapshot,'$.hostIdentity') AS host_identity,json_extract(d.snapshot,'$.hostLabel') AS host_label,m.permissions,a.username AS owner_name FROM devices d JOIN auth_accounts a ON a.id=d.owner_id LEFT JOIN members m ON m.device_id=d.id AND m.account_id=? AND (m.expires=0 OR m.expires>unixepoch()*1000) WHERE d.owner_id=? OR m.account_id=? ORDER BY (d.updated > ?) DESC,d.owner_id=? DESC,d.updated DESC,d.id")
 .bind(accountId,accountId,accountId,Date.now()-30000,accountId).all<{id:string;owner_id:number;permissions:string|null;owner_name:string;updated:number;model:string|null;host_identity:string|null;host_label:string|null}>();
 const identities = new Set<string>();
 const unique = rows.results.filter(row => {
   if (row.owner_id !== accountId || !row.host_identity) return true;
   if (identities.has(row.host_identity)) return false;
   identities.add(row.host_identity);
   return true;
 });
 return unique.map(row=>({id:row.id,name:`${row.owner_name}s Server`,online:Date.now()-row.updated<30000,model:row.host_label||row.model||undefined,owner:row.owner_id===accountId,permissions:row.owner_id===accountId?PERMISSIONS:JSON.parse(row.permissions||"[]")}));
}
export async function access(request:Request, permission="status") {
 const user=await requestUser(request);if(!user)return null;
 const wanted=new URL(request.url).searchParams.get("server");
 let server;
 if(wanted){const row=await database().prepare("SELECT d.id,d.owner_id,m.permissions FROM devices d LEFT JOIN members m ON m.device_id=d.id AND m.account_id=? AND (m.expires=0 OR m.expires>unixepoch()*1000) WHERE d.id=? AND d.owner_id IS NOT NULL AND (d.owner_id=? OR m.account_id=?)").bind(user.id,wanted,user.id,user.id).first<{id:string;owner_id:number;permissions:string|null}>();server=row?{id:row.id,owner:row.owner_id===user.id,permissions:row.owner_id===user.id?PERMISSIONS:JSON.parse(row.permissions||"[]")}:null;}
 else server=(await serversFor(user.id))[0];
 if(!server || (!server.owner&&!server.permissions.includes(permission)))return null;
 if(!server.owner){const active=await database().prepare("SELECT json_extract(snapshot,'$.profileId') AS profile FROM devices WHERE id=?").bind(server.id).first<{profile:string|null}>();if(active?.profile&&active.profile!=="default")return null;}
 return {user,server};
}
