import { env } from "cloudflare:workers";

export const MAX_TRANSFER = 64 * 1024 * 1024;
export const KINDS = new Set(["pumpkin_market_install","voice_configure","profiles_list","profiles_rename","device_remove_begin","device_remove_verify","profiles_delete_begin","profiles_delete","profiles_create","profiles_select","files_pending","files_pending_cancel","backup_schedule_get","backup_schedule_save","backup_inspect","files_uploads","player_detail","player_action","mods_list","mods_upload","mods_toggle","mods_remove","catalog_plugins_install","catalog_mods_install","network_configure","network_check","software_catalog","software_get","software_install","plugins_list","plugins_upload","plugins_toggle","plugins_remove","setup", "start", "stop", "restart", "recover", "console", "files_list", "files_read", "files_write", "files_upload", "files_download", "files_move","files_mkdir", "files_delete", "backups_list", "backup_create", "backup_restore", "backup_download", "settings_get", "settings_save", "players_get", "whitelist_add", "whitelist_remove", "internet_start", "internet_stop", "internet_setup"]);
export function bindings() {
  if (!env.DB || !env.BUCKET) throw new Error("Speicher ist noch nicht eingerichtet.");
  return { db: env.DB, bucket: env.BUCKET };
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export { isAdmin } from "./auth";
export function validOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
export async function deviceIdentity(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{40,100})$/)?.[1];
  const expected = env.DEVICE_TOKEN_SHA256;
  if (!token) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const registered = await bindings().db.prepare("SELECT id FROM devices WHERE token_hash=?").bind(actual).first<{id:string}>();
  if (registered) return registered.id;
  if (!expected || expected.length !== 64) return null;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  if (difference !== 0) return null;
  const removed = await bindings().db.prepare("SELECT json_extract(snapshot,'$.unlinked') AS unlinked FROM devices WHERE id='phone'").first<{ unlinked: number | null }>();
  return removed?.unlinked ? null : "phone";
}
export async function isDevice(request: Request) { return !!await deviceIdentity(request); }
export async function body(request: Request, max = 400000) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("JSON erwartet.");
  const reader = request.body?.getReader(); if (!reader) throw new Error("JSON erwartet.");
  const decoder = new TextDecoder(); let text = "", size = 0;
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength;
      if (size > max) { await reader.cancel(); throw new Error("Anfrage ist zu groß."); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode(); return JSON.parse(text);
  } finally { reader.releaseLock(); }
}
export async function cleanupTransfers() {
  const { db, bucket } = bindings();
  const now = Date.now();
  const expired = await db.prepare("SELECT id FROM transfers WHERE expires < ? LIMIT 20").bind(now).all<{ id: string }>();
  if (expired.results.length) {
    for(const row of expired.results){try{const object=await bucket.get("transfer-session/"+row.id);if(object){const session:any=await object.json();await bucket.resumeMultipartUpload(row.id,session.uploadId).abort();}}catch{}}
    await bucket.delete(expired.results.flatMap(row=>[row.id,"transfer-session/"+row.id]));
    await db.batch(expired.results.map(row => db.prepare("DELETE FROM transfers WHERE id = ?").bind(row.id)));
  }
}
export function filename(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 150) || "download.bin";
}
