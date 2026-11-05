"use client";
import {useLanguage,LanguageMenu} from "./language";
import AccountMenu from "./account-menu";
import {RefreshCw,Download,ShieldCheck} from "lucide-react";
export default function EmptyServer({account,wanted}:{account:string;wanted:boolean}){
 const {t}=useLanguage();
 return <main className="login-page"><section className="login-card" style={{maxWidth:540}}>
  <div className="section-heading"><LanguageMenu/><AccountMenu account={account} signOut="/api/auth/logout"/></div>
  <h1>{t("Willkommen")}, {account}</h1>
  <p>{t(wanted?"Kein Zugriff auf diesen Server.":"Noch kein Server verknüpft. Erstelle deinen Serverzugang in MineHost auf dem Handy oder öffne die Einladung eines Freundes.")}</p>
  <ol className="setup-steps" style={{marginTop:16,marginBottom:18}}>
   <li><strong>1. MineHost App auf dem Handy öffnen</strong><p>Starte die installierte MineHost-App auf deinem Android-Gerät (z. B. Samsung Galaxy S10).</p></li>
   <li><strong>2. „Einrichtung starten“ antippen</strong><p>Tippe in der App unten auf den grünen Button <b>„Einrichtung starten“</b>. Dein Browser öffnet automatisch die sichere Gerätekopplung.</p></li>
   <li><strong>3. Server verwalten</strong><p>Sobald du die Verknüpfung bestätigst, erscheint dein Server sofort hier im Dashboard.</p></li>
  </ol>
  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
   <button className="btn btn-blue" type="button" onClick={()=>window.location.reload()}><RefreshCw size={16}/>Status aktualisieren</button>
   <a className="btn btn-outline" href="https://github.com/adrighg-scripts/MineHost/releases/latest/download/MineHost.apk"><Download size={16}/>Aktuelle APK laden</a>
  </div>
  <div className="login-help" style={{marginTop:16}}><ShieldCheck size={16}/><p>Angemeldet als <b>{account}</b> auf deinem eigenen Cloudflare-Dashboard.</p></div>
 </section></main>;
}
