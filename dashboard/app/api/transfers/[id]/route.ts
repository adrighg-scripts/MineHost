import { bindings, isAdmin, json } from "../../../../lib/control";
import { access } from "../../../../lib/permissions";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await isAdmin(request)) return json({ error: "Anmeldung erforderlich." }, 401);
  const { id } = await context.params; const { db, bucket } = bindings();
  const record = await db.prepare("SELECT name, uploaded, expires,device_id,account_id,permission FROM transfers WHERE id=?").bind(id).first<{ name: string; uploaded: number; expires: number;device_id:string;account_id:number;permission:string }>();
  if (!record || !record.uploaded || record.expires < Date.now()) return json({ error: "Datei ist noch nicht bereit oder abgelaufen." }, 404);
  const allowed=await access(request,record.permission);if(!allowed||allowed.server.id!==record.device_id||allowed.user.id!==record.account_id)return json({error:"Kein Zugriff."},403);
  const object = await bucket.get(id);
  if (!object) return json({ error: "Datei nicht gefunden." }, 404);
  return new Response(object.body, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${record.name}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
