import { bindings, body, deviceIdentity, json } from "../../../lib/control";
let lastCleanup=0;
export async function POST(request: Request) {
  const deviceId=await deviceIdentity(request);if(!deviceId)return json({error:"Unauthorized",code:"device_unlinked"},401);
  try {
    const input = await body(request,4*1024*1024);
    if (!input.snapshot || typeof input.snapshot !== "object") return json({ error: "Invalid snapshot" }, 400);
    const { db } = bindings(); const now = Date.now();
    if (input.snapshot.console === null) {
      const previous = await db.prepare("SELECT snapshot FROM devices WHERE id=?").bind(deviceId).first<{ snapshot: string }>();
      input.snapshot.console = previous ? JSON.parse(previous.snapshot).console || "" : "";
    }
    const statements = [db.prepare("INSERT INTO devices (id, snapshot, updated) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET snapshot=json_set(json_remove(excluded.snapshot, '$.hostLabel'), '$.hostLabel', json_extract(devices.snapshot, '$.hostLabel')), updated=excluded.updated WHERE COALESCE(json_extract(devices.snapshot, '$.unlinked'),0)=0")
      .bind(deviceId,JSON.stringify(input.snapshot), now)];
    for (const result of (Array.isArray(input.results) ? input.results : []).slice(0, 12)) {
      if (typeof result.id !== "string" || !["done", "error", "unknown"].includes(result.state)) continue;
      const content = JSON.stringify(result.result ?? {});
      if (content.length > 300000) continue;
      statements.push(db.prepare("UPDATE jobs SET state=?, result=?, lease_until=NULL WHERE id=? AND device_id=? AND state IN ('leased','queued')")
        .bind(result.state, content, result.id,deviceId));
    }
    for (const id of (Array.isArray(input.active) ? input.active : []).slice(0, 12)) {
      if (typeof id === "string") statements.push(db.prepare("UPDATE jobs SET lease_until=?, expires=? WHERE id=? AND device_id=? AND state='leased'").bind(now + 90000, now + 120000, id,deviceId));
    }
    statements.push(db.prepare("UPDATE jobs SET state='expired' WHERE device_id=? AND state='queued' AND requested_by IS NOT NULL AND requested_by!=(SELECT owner_id FROM devices WHERE id=?) AND NOT EXISTS(SELECT 1 FROM members WHERE members.device_id=jobs.device_id AND members.account_id=jobs.requested_by AND (members.expires=0 OR members.expires>?))").bind(deviceId,deviceId,now));
    statements.push(db.prepare("UPDATE jobs SET state='expired' WHERE device_id=? AND expires < ? AND state IN ('queued','leased')").bind(deviceId,now));
    await db.batch(statements);
    const leased = await db.prepare("UPDATE jobs SET state='leased', lease_until=? WHERE id IN (SELECT id FROM jobs WHERE device_id=? AND expires > ? AND (state='queued' OR (state='leased' AND lease_until < ?)) ORDER BY created LIMIT 3) RETURNING id, kind, payload, expires")
      .bind(now + 90000,deviceId, now, now).all();
    if(now-lastCleanup>60000){lastCleanup=now;await db.prepare("DELETE FROM jobs WHERE created < ? AND state NOT IN ('queued','leased')").bind(now - 86400000).run();}
    const viewer=await db.prepare("SELECT active_until FROM devices WHERE id=?").bind(deviceId).first<{active_until:number}>();
    return json({ accepted: true,pollMs:(leased.results.length||input.active?.length||viewer&&viewer.active_until>now)?1000:5000, jobs: leased.results.map((job: any) => ({ ...job, payload: JSON.parse(job.payload) })) });
  } catch { return json({ error: "Device update rejected" }, 400); }
}
export async function GET(request: Request) {
  const deviceId=await deviceIdentity(request);if(!deviceId)return json({error:"Unauthorized"},401);
  const { db } = bindings();
  const device = await db.prepare("SELECT snapshot, updated FROM devices WHERE id=?").bind(deviceId).first<{ snapshot: string; updated: number }>();
  return json({ connected: !!device && Date.now() - device.updated < 30000, updated: device?.updated ?? null, phase: device ? JSON.parse(device.snapshot).phase : null });
}
