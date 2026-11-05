"use client";
import {useLanguage,LanguageMenu} from "./language";
import AccountMenu from "./account-menu";
import {RefreshCw,Download,ShieldCheck,Smartphone,Monitor,Terminal,Apple} from "lucide-react";
export default function EmptyServer({account,wanted}:{account:string;wanted:boolean}){
 const {t}=useLanguage();
 return <main className="login-page"><section className="login-card" style={{maxWidth:620}}>
  <div className="section-heading"><LanguageMenu/><AccountMenu account={account} signOut="/api/auth/logout"/></div>
  <h1>{t("Willkommen")}, {account}</h1>
  <p>{t(wanted?"Kein Zugriff auf diesen Server.":"Noch kein Server-Host verknüpft. Wähle deine Plattform (Android, Windows, Linux/Ubuntu oder iOS), starte MineHost und verbinde dein Gerät mit einem Klick.")}</p>
  <div className="telemetry-grid" style={{gridTemplateColumns:"repeat(2,minmax(0,1fr))",marginTop:18,marginBottom:18}}>
   <div className="telemetry-card">
    <strong style={{display:"flex",alignItems:"center",gap:8,color:"#ecfdf5"}}><Smartphone size={16} color="#24dc8e"/>Android Host (.apk)</strong>
    <span style={{fontSize:12,color:"#9cb8aa"}}>Hostet den Server direkt auf deinem Android-Handy (ARM64 OpenJDK 21 & Pumpkin).</span>
    <a className="btn btn-blue compact" style={{marginTop:6}} href="https://github.com/adrighg-scripts/MineHost/releases/latest/download/MineHost.apk"><Download size={14}/>MineHost.apk laden</a>
   </div>
   <div className="telemetry-card">
    <strong style={{display:"flex",alignItems:"center",gap:8,color:"#ecfdf5"}}><Monitor size={16} color="#24dc8e"/>Windows 10/11 Host (.zip)</strong>
    <span style={{fontSize:12,color:"#9cb8aa"}}>1-Klick-Starter inkl. automatischem Adoptium Java 8/16/17/21 & allen 16 Server-Engines.</span>
    <a className="btn btn-outline compact" style={{marginTop:6}} href="https://github.com/adrighg-scripts/MineHost/releases/latest/download/MineHost_Windows.zip"><Download size={14}/>MineHost_Windows.zip</a>
   </div>
   <div className="telemetry-card">
    <strong style={{display:"flex",alignItems:"center",gap:8,color:"#ecfdf5"}}><Terminal size={16} color="#24dc8e"/>Linux / Ubuntu Host (.zip)</strong>
    <span style={{fontSize:12,color:"#9cb8aa"}}>Für Ubuntu, Debian & Linux-PCs/Server (`./start-minehost-linux.sh`).</span>
    <a className="btn btn-outline compact" style={{marginTop:6}} href="https://github.com/adrighg-scripts/MineHost/releases/latest/download/MineHost_Linux.zip"><Download size={14}/>MineHost_Linux.zip</a>
   </div>
   <div className="telemetry-card">
    <strong style={{display:"flex",alignItems:"center",gap:8,color:"#ecfdf5"}}><Apple size={16} color="#24dc8e"/>iOS / iPadOS App</strong>
    <span style={{fontSize:12,color:"#9cb8aa"}}>In Safari auf <b>„Teilen → Zum Home-Bildschirm“</b> tippen für die native iOS-Vollbild-App.</span>
   </div>
  </div>
  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
   <button className="btn btn-blue" type="button" onClick={()=>window.location.reload()}><RefreshCw size={16}/>Verbindungsstatus aktualisieren</button>
  </div>
  <div className="login-help" style={{marginTop:16}}><ShieldCheck size={16}/><p>Angemeldet als <b>{account}</b> auf deinem eigenen Cloudflare-Dashboard.</p></div>
 </section></main>;
}
