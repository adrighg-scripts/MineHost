import { headers } from "next/headers";
import { database, sessionFromCookie } from "../lib/auth";
import Login from "./login";
import Invitation from "./invitation";
import { serversFor } from "../lib/permissions";
import "./login.css";
import "./members.css";
import EmptyServer from "./empty-server";
import Dashboard from "./dashboard";
export const dynamic = "force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<{server?:string}>}) {
  const user = await sessionFromCookie((await headers()).get("cookie"));
  if(!user)return <Login/>;
  const servers=await serversFor(user.id),wanted=(await searchParams).server;
  const selected=wanted?servers.find(server=>server.id===wanted):servers[0];
  const stored = selected?.owner ? await database().prepare(
    "SELECT json_extract(snapshot,'$.profiles') AS profiles FROM devices WHERE id=? AND owner_id=?"
  ).bind(selected.id, user.id).first<{ profiles: string | null }>() : null;
  const initialProfiles = stored?.profiles ? JSON.parse(stored.profiles) : undefined;
  return <Invitation>{selected?<Dashboard key={selected.id} account={user.username} signOut="/api/auth/logout" serverId={selected.id} servers={servers} initialPermissions={selected.permissions} initialOwner={selected.owner} initialProfiles={initialProfiles}/>:<EmptyServer account={user.username} wanted={!!wanted}/>}</Invitation>;
}
