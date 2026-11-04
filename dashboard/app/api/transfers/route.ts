import { bindings, cleanupTransfers, filename, isAdmin, json, MAX_TRANSFER, validOrigin } from "../../../lib/control";
import { access } from "../../../lib/permissions";
export async function POST(request: Request) {
  if (!await isAdmin(request)) return json({ error: "Anmeldung erforderlich." }, 401);
  if (!validOrigin(request)) return json({ error: "Ungültiger Ursprung." }, 403);
  const direction = new URL(request.url).searchParams.get("direction") === "download" ? "download" : "upload";
  const permission=direction==="upload"?(new URL(request.url).searchParams.get("permission")==="mods.write"?"mods.write":new URL(request.url).searchParams.get("permission")==="plugins.write"?"plugins.write":"files.write"):new URL(request.url).searchParams.get("permission")==="backups.read"?"backups.read":"files.read";
  const allowed=await access(request,permission);if(!allowed)return json({error:"Dafür fehlen dir die Rechte."},403);
  const { db, bucket } = bindings();
  const name = filename(new URL(request.url).searchParams.get("name") ?? "upload.bin");
  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_TRANSFER) return json({ error: "Dateien dürfen höchstens 64 MiB groß sein." }, 413);
  await cleanupTransfers();
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO transfers (id, name, direction, uploaded, expires,device_id,account_id,permission) VALUES (?, ?, ?, 0, ?,?,?,?)").bind(id, name, direction, Date.now() + 1800000,allowed.server.id,allowed.user.id,permission).run();
  if (direction === "upload") {
    await bucket.put(id, request.body || new Uint8Array(), { httpMetadata: { contentType: "application/octet-stream" } });
    await db.prepare("UPDATE transfers SET uploaded=1 WHERE id=?").bind(id).run();
  }
  return json({ id, name });
}
