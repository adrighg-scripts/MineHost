import { bindings, deviceIdentity, json, MAX_TRANSFER } from "../../../../../lib/control";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const deviceId=await deviceIdentity(request);if(!deviceId)return json({error:"Unauthorized"},401);
  const { id } = await context.params; const { db, bucket } = bindings();
  const record = await db.prepare("SELECT uploaded, expires, direction FROM transfers WHERE id=? AND device_id=?").bind(id,deviceId).first<{ uploaded: number; expires: number; direction: string }>();
  if (!record || !record.uploaded || record.expires < Date.now() || record.direction !== "upload") return json({ error: "Transfer unavailable" }, 404);
  const object = await bucket.get(id);
  if (!object) return json({ error: "Transfer unavailable" }, 404);
  return new Response(object.body, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const deviceId=await deviceIdentity(request);if(!deviceId)return json({error:"Unauthorized"},401);
  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_TRANSFER) return json({ error: "Transfer exceeds 64 MiB" }, 413);
  const { id } = await context.params; const { db, bucket } = bindings();
  const record = await db.prepare("SELECT uploaded, expires, direction FROM transfers WHERE id=? AND device_id=?").bind(id,deviceId).first<{ uploaded: number; expires: number; direction: string }>();
  if (!record || record.uploaded || record.expires < Date.now() || record.direction !== "download") return json({ error: "Transfer unavailable" }, 404);
  await bucket.put(id, request.body || new Uint8Array(), { httpMetadata: { contentType: "application/octet-stream" } });
  await db.prepare("UPDATE transfers SET uploaded=1 WHERE id=?").bind(id).run();
  return json({ ok: true });
}
