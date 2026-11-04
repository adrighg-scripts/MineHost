import { env } from "cloudflare:workers";

export const MAX_TRANSFER = 64 * 1024 * 1024;
export const KINDS = new Set(["pumpkin_market_install","voice_configure","profiles_list","profiles_rename","device_remove_begin","device_remove_verify","profiles_delete_begin","profiles_delete","profiles_create","profiles_select","files_pending","files_pending_cancel","backup_schedule_get","backup_schedule_save","backup_inspect","files_uploads","player_detail","player_action","mods_list","mods_upload","mods_toggle","mods_remove","catalog_plugins_install","catalog_mods_install","network_configure","network_check","software_catalog","software_get","software_install","plugins_list","plugins_upload","plugins_toggle","plugins_remove","setup", "start", "stop", "restart", "recover", "console", "files_list", "files_read", "files_write", "files_upload", "files_download", "files_move","files_mkdir", "files_delete", "backups_list", "backup_create", "backup_restore", "backup_download", "settings_get", "settings_save", "players_get", "whitelist_add", "whitelist_remove", "internet_start", "internet_stop", "internet_setup"]);

const D1_CHUNK = 512 * 1024;

function createD1Bucket(db: D1Database): R2Bucket {
  let initialized = false;
  async function init() {
    if (initialized) return;
    await db.prepare("CREATE TABLE IF NOT EXISTS transfer_blobs (key TEXT NOT NULL, seq INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (key, seq))").run();
    initialized = true;
  }
  async function toBytes(value: any): Promise<Uint8Array> {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (typeof value === "string") return new TextEncoder().encode(value);
    if (value && typeof value.getReader === "function") {
      const chunks: Uint8Array[] = [];
      let total = 0;
      const reader = (value as ReadableStream<Uint8Array>).getReader();
      try {
        for (;;) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          chunks.push(chunk);
          total += chunk.byteLength;
        }
      } finally {
        reader.releaseLock();
      }
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.byteLength;
      }
      return out;
    }
    return new Uint8Array(0);
  }
  async function writeChunks(key: string, bytes: Uint8Array) {
    await init();
    await db.prepare("DELETE FROM transfer_blobs WHERE key = ?").bind(key).run();
    if (bytes.byteLength === 0) {
      await db.prepare("INSERT INTO transfer_blobs (key, seq, data) VALUES (?, 0, ?)").bind(key, new Uint8Array(0)).run();
      return;
    }
    for (let offset = 0, seq = 0; offset < bytes.byteLength; offset += D1_CHUNK, seq++) {
      const slice = bytes.subarray(offset, Math.min(bytes.byteLength, offset + D1_CHUNK));
      await db.prepare("INSERT INTO transfer_blobs (key, seq, data) VALUES (?, ?, ?)").bind(key, seq, slice).run();
    }
  }
  async function readChunks(key: string): Promise<Uint8Array | null> {
    await init();
    const rows = await db.prepare("SELECT data FROM transfer_blobs WHERE key = ? ORDER BY seq ASC").bind(key).all<{ data: ArrayBuffer | number[] }>();
    if (!rows.results.length) return null;
    const parts = rows.results.map(r => r.data instanceof ArrayBuffer ? new Uint8Array(r.data) : new Uint8Array(r.data));
    let total = 0;
    for (const p of parts) total += p.byteLength;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.byteLength;
    }
    return out;
  }
  return {
    async put(key: string, value: any) {
      const bytes = await toBytes(value);
      await writeChunks(key, bytes);
      return { key, size: bytes.byteLength } as any;
    },
    async get(key: string) {
      const bytes = await readChunks(key);
      if (!bytes) return null;
      return {
        key,
        size: bytes.byteLength,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); },
        async text() { return new TextDecoder().decode(bytes); },
        async json() { return JSON.parse(new TextDecoder().decode(bytes)); },
      } as any;
    },
    async delete(keys: string | string[]) {
      await init();
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) {
        await db.prepare("DELETE FROM transfer_blobs WHERE key = ? OR key LIKE ?").bind(k, `${k}#part#%`).run();
      }
    },
    async createMultipartUpload(key: string) {
      await init();
      return { key, uploadId: crypto.randomUUID() } as any;
    },
    resumeMultipartUpload(key: string, uploadId: string) {
      return {
        key,
        uploadId,
        async uploadPart(partNumber: number, value: any) {
          const bytes = await toBytes(value);
          await writeChunks(`${key}#part#${uploadId}#${partNumber}`, bytes);
          return { partNumber, etag: `part-${partNumber}-${bytes.byteLength}` };
        },
        async complete(parts: { partNumber: number; etag: string }[]) {
          await init();
          await db.prepare("DELETE FROM transfer_blobs WHERE key = ?").bind(key).run();
          let seq = 0;
          let total = 0;
          for (const part of parts) {
            const pKey = `${key}#part#${uploadId}#${part.partNumber}`;
            const pBytes = await readChunks(pKey);
            if (!pBytes) throw new Error("Missing part");
            total += pBytes.byteLength;
            for (let offset = 0; offset < pBytes.byteLength; offset += D1_CHUNK, seq++) {
              const slice = pBytes.subarray(offset, Math.min(pBytes.byteLength, offset + D1_CHUNK));
              await db.prepare("INSERT INTO transfer_blobs (key, seq, data) VALUES (?, ?, ?)").bind(key, seq, slice).run();
            }
            await db.prepare("DELETE FROM transfer_blobs WHERE key = ?").bind(pKey).run();
          }
          return { key, size: total } as any;
        },
        async abort() {
          await init();
          await db.prepare("DELETE FROM transfer_blobs WHERE key LIKE ?").bind(`${key}#part#${uploadId}#%`).run();
        },
      } as any;
    },
  } as unknown as R2Bucket;
}

export function bindings() {
  if (!env.DB) throw new Error("Speicher ist noch nicht eingerichtet.");
  return { db: env.DB, bucket: env.BUCKET || createD1Bucket(env.DB) };
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
