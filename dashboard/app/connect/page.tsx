import {headers} from "next/headers";
import {sessionFromCookie} from "../../lib/auth";
import Login from "../login";
import ConnectDevice from "./view";
export default async function ConnectPage(){const user=await sessionFromCookie((await headers()).get("cookie"));return user?<ConnectDevice account={user.username}/>:<Login connectingDevice/>;}
