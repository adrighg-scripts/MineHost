"use client";
import {useState} from "react";
export default function ExtensionIcon({icon,name}:{icon?:string;name:string}){const [failed,setFailed]=useState(false);const valid=icon&&(icon.startsWith("data:image/png;base64,")||/^https:\/\/(cdn\.modrinth\.com|(?:media|mediafilez|edge)\.forgecdn\.net)\//.test(icon));return valid&&!failed?<img className="extension-icon" src={icon} alt={name} loading="lazy" onError={()=>setFailed(true)}/>:<span className="extension-icon icon-fallback" aria-hidden="true">{name.slice(0,2).toUpperCase()}</span>;}
