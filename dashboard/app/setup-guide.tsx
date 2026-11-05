"use client";
import {useEffect,useRef,useState} from "react";
import {useLanguage} from "./language";
import SoftwarePanel from "./software";
import NetworkPanel from "./network";
import ResourceMode from "./resource-mode";
import {BedrockOptions,BedrockConnection} from "./bedrock";

const DEFAULT_SETTINGS={gamemode:"survival",difficulty:"normal",maxPlayers:20,viewDistance:10,simulationDistance:10,memory:2048,manualMemoryLimit:4096,maxResources:false,port:25565,whitelist:false,motd:"MineHost Server",bedrockEnabled:false,bedrockPort:19132};

type Props={phone:any;initialSettings?:any;owner:boolean;run:(kind:string,payload?:any)=>Promise<any>;navigate:(tab:string)=>void;close:()=>void};
export function SetupGuide({phone,initialSettings,owner,run,navigate,close}:Props){
 const {locale,t}=useLanguage(),l=(de:string,en:string)=>locale==="de"?de:en;
 const [step,setStep]=useState(0),[settings,setSettings]=useState<any>(()=>initialSettings?{...DEFAULT_SETTINGS,...initialSettings}:DEFAULT_SETTINGS),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const edited=useRef(false);
 const updateSettings=(nextVal:any)=>{edited.current=true;setSettings(nextVal);};
 const titles=[l("Handy vorbereiten","Prepare your phone"),l("Minecraft installieren","Install Minecraft"),l("Deinen Server einstellen","Configure your server"),l("Zugriff & Sicherungen","Access & backups"),l("Server starten & ausprobieren","Start & try your server"),l("Freunde außerhalb deines WLANs","Friends outside your Wi-Fi"),l("Deinen Server verwalten","Manage your server")];
 const active=["running","starting","stopping","preparing","stop_error"].includes(phone?.phase),online=!!phone?.online;
 useEffect(()=>{if(initialSettings&&!edited.current)setSettings((prev:any)=>({...DEFAULT_SETTINGS,...prev,...initialSettings}));},[initialSettings]);
 useEffect(()=>{if(online)run("settings_get").then(res=>{if(res&&!edited.current)setSettings((prev:any)=>({...DEFAULT_SETTINGS,...prev,...res}));}).catch(()=>{});},[online,step===2,phone?.configured]);
 async function action(kind:string,payload?:any){setBusy(true);setError("");try{await run(kind,payload);return true;}catch(e){setError(e instanceof Error?e.message:String(e));return false;}finally{setBusy(false);}}
 async function next(){if(step===2&&settings&&online&&!active){
  if(settings.bedrockEnabled&&(!Number.isInteger(settings.bedrockPort)||settings.bedrockPort<1024||settings.bedrockPort>65535)){
   setError(l("Wähle einen Bedrock-Port zwischen 1024 und 65535.","Choose a Bedrock port between 1024 and 65535."));return;
  }
  if(phone?.configured!==false&&!await action("settings_save",settings))return;
 }setError("");setStep(s=>Math.min(6,s+1));}
 const bedrock=phone?.bedrock ?? settings?.bedrock;
 return <section className="panel setup-guide" aria-label={l("Einrichtungsassistent","Setup guide")}><div className="section-heading"><div><small>{l("Schritt","Step")} {step+1} / {titles.length}</small><h2>{titles[step]}</h2></div><button className="btn btn-outline compact" onClick={close}>{l("Tutorial überspringen","Skip tutorial")}</button></div><progress max={titles.length} value={step+1}/>
 {step===0&&<><p>{l("Dein Host-Gerät (Handy, Windows-PC oder Linux) lässt den Server laufen. Diese Website ist die Fernbedienung – du kannst sie auf jedem Gerät öffnen.","Your host device (phone, Windows PC or Linux) runs the server. This website is your remote control – you can open it on any device.")}</p><ol className="setup-steps"><li>{l("Lass dein Host-Gerät im Netzwerk und am Strom. Lege ein Handy auf eine freie, gut belüftete Fläche.","Keep your host device connected to the network and power. Place a phone on a clear, ventilated surface.")}</li><li>{l("Lass MineHost aktiv. Auf Android: Stelle unter Einstellungen → Apps → MineHost → Akku auf „Uneingeschränkt“.","Keep MineHost active. On Android: Open Settings → Apps → MineHost → Battery and select Unrestricted.")}</li><li>{l("Oben rechts sollte „Host verbunden“ stehen. Alle Einstellungen, Konsole und Backups steuerst du direkt hier.","The top right should say Host connected. Control all settings, console and backups right here.")}</li></ol><p className="notice">{online?l("Dein Host-Gerät ist verbunden.","Your host device is connected."):l("Starte MineHost auf deinem Host-Gerät (Android, Windows oder Linux) und prüfe die Internetverbindung.","Open MineHost on your host device (Android, Windows or Linux) and check its internet connection.")}</p></>}
 {step===1&&<><p>{l("Wähle zuerst deine Minecraft-Version. Deine Freunde brauchen eine passende Java-Version des Spiels. Für einen normalen Server mit Plugins nimm Paper. Fabric ist für Mods; einige Mods brauchen alle Spieler auch auf ihrem PC.","Choose your Minecraft version first. Friends need a matching Java Edition game version. Choose Paper for a regular server with plugins. Fabric supports mods; some mods must also be installed on every player's PC.")}</p><SoftwarePanel online={online} active={active} supported={(phone?.managementVersion||0)>=3} current={phone?.software} configured={!!phone?.configured} owner={owner} run={run}/><p>{l("Lies die EULA und bestätige sie nur, wenn du zustimmst. Tippe dann auf Installieren und warte, bis die Installation fertig ist. Ein bereits eingerichteter Server muss nicht erneut installiert werden.","Read the EULA and accept it only if you agree. Select Install and wait for installation to finish. An existing server does not need to be installed again.")}</p></>}
 {step===2&&<><p>{l("Der Server muss zum Ändern gestoppt sein. Sichtweite bedeutet, wie weit die Welt geladen wird. Eine höhere Zahl braucht deutlich mehr Leistung. Beginne z. B. mit 8–12 Chunks und erhöhe sie später.","Stop the server before changing settings. View distance controls how much world is loaded. Larger values need much more power. Start with 8–12 chunks and increase it later.")}</p><BedrockOptions settings={settings} software={phone?.software?.software} disabled={!owner||!online||active||busy} onChange={updateSettings}/><ResourceMode settings={settings} onChange={updateSettings} active={active}/><div className="settings-grid"><label>{l("Spielmodus","Game mode")}<select disabled={active} value={settings.gamemode} onChange={e=>updateSettings({...settings,gamemode:e.target.value})}>{Object.entries({survival:"Überleben",creative:"Kreativ",adventure:"Abenteuer",spectator:"Zuschauer"}).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label><label>{l("Schwierigkeit","Difficulty")}<select disabled={active} value={settings.difficulty} onChange={e=>updateSettings({...settings,difficulty:e.target.value})}>{Object.entries({peaceful:"Friedlich",easy:"Einfach",normal:"Normal",hard:"Schwer"}).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>{[{key:"maxPlayers",de:"Spielerplätze",en:"Player slots",min:1,max:2147483647},{key:"viewDistance",de:"Sichtweite (Chunks)",en:"View distance (chunks)",min:2,max:settings.viewDistanceLimit||32}].map(f=><label key={f.key}>{l(f.de,f.en)}<input type="number" min={f.min} max={f.max} disabled={active} value={settings[f.key]} onChange={e=>updateSettings({...settings,[f.key]:Math.max(f.min,Math.min(f.max,Number(e.target.value)))})}/></label>)}</div><label className="toggle-row"><span>{l("Nur erlaubte Spieler (Whitelist)","Allowlisted players only")}</span><input type="checkbox" disabled={active} checked={!!settings.whitelist} onChange={e=>updateSettings({...settings,whitelist:e.target.checked})}/></label><p>{l("Mit „Weiter“ speicherst du diese Einstellungen. Weitere Optionen findest du später unter Einstellungen.","Next saves these settings. Find more options in Settings later.")}</p>{active&&<button className="btn btn-outline" disabled={busy||!online} onClick={()=>action("stop")}>{l("Server zum Einstellen stoppen","Stop server to configure")}</button>}</>}
 {step===3&&<><ol className="setup-steps"><li><strong>{l("Minecraft-Zugang","Minecraft access")}</strong><p>{l("Mit Whitelist können nur hinzugefügte Namen spielen. Starte den Server und füge dich und deine Freunde später unter Spieler → Whitelist hinzu. Ohne Whitelist können alle mit gültigem Minecraft-Konto und Adresse beitreten.","With the allowlist enabled, only added players can join. Start the server, then add yourself and friends under Players → Allowlist. Without an allowlist, anyone with a valid Minecraft account and the address can join.")}</p></li><li><strong>{l("Website-Zugang","Website access")}</strong><p>{l("Dein Passwort bleibt bei dir. Unter Mitglieder & Rechte erstellst du für Freunde eigene Einladungslinks mit Rechten, Ablaufzeit und Nutzungsanzahl. Eine Spieladresse gibt keine Website-Rechte.","Keep your password private. Under Members & permissions, create separate invitation links with permissions, expiration and usage limits. A game address grants no website permissions.")}</p></li><li><strong>{l("Backups","Backups")}</strong><p>{l("Eine Sicherung ist eine Kopie zum Wiederherstellen. Unter Backups wählst du den ganzen Server oder einzelne Ordner, Zeitplan und Aufbewahrung. Automatische Sicherungen warten, bis 15 Minuten lang niemand online war. Währenddessen zeigt die Spieladresse an, dass ein Backup erstellt wird. Lade wichtige Sicherungen zusätzlich auf ein anderes Gerät.","A backup is a copy for restoring your server. Under Backups, choose the complete server or selected folders, a schedule and retention. Scheduled backups wait for 15 minutes without players. The game address shows that a backup is being created. Download important backups to another device too.")}</p></li></ol><button className="btn btn-outline" onClick={()=>{close();navigate("backups");}}>{l("Backups jetzt einrichten","Configure backups now")}</button></>}
 {step===4&&<><p>{l("Tippe auf Starten. Beim ersten Start wird eine neue Welt erzeugt – das kann einige Minuten dauern. Warte auf „Läuft“. Das Handy muss während des Spielens an bleiben.","Select Start. The first start generates a new world and may take a few minutes. Wait for Running. Keep your phone on while playing.")}</p><button className="btn btn-blue" disabled={!online||active||busy||!phone?.configured} onClick={()=>action("start")}>{l("Server starten","Start server")}</button><p className="notice">{phone?.phase==="running"?l("Server läuft.","Server is running."):l("Aktueller Status: ","Current status: ")+(phone?.phase||"offline")}</p><ol className="setup-steps"><li>{l("Öffne Minecraft Java auf einem Gerät im gleichen WLAN.","Open Minecraft Java on a device on the same Wi-Fi.")}</li><li>{l("Mehrspieler → Server hinzufügen → Serveradresse:","Multiplayer → Add Server → Server Address:")} <strong>{phone?.lan||"…"}</strong></li><li>{l("Verbinde dich. Bei einer Whitelist-Meldung trage deinen Namen im Tab Spieler ein. Die WLAN-Adresse ist nur zum Testen zu Hause.","Join. If you see an allowlist message, add your name in the Players tab. This Wi-Fi address is only for testing at home.")}</li></ol><BedrockConnection state={bedrock} lan={phone?.lan||""} whitelist={settings?.whitelist}/></>}
 {step===5&&<><p>{l("Für Freunde in anderen Netzwerken richtest du einmal eine Portfreigabe am Router ein. Ein Port ist der Eingang zu deinem Minecraft-Server. Teile danach die öffentliche Spieladresse mit dem Port – keine WLAN-Adresse. Du kannst diesen Schritt für reines WLAN-Spiel überspringen.","For friends on other networks, configure port forwarding on your router once. A port is the entrance to your Minecraft server. Share the public game address including the port, not the Wi-Fi address. Skip this step if you only play on the same Wi-Fi.")}</p><NetworkPanel tutorial playersPresent={phone?.onlinePlayers > 0} network={phone?.publicAccess} lan={phone?.lan||""} online={online} canWrite={owner} run={run}/><BedrockConnection state={bedrock} lan={phone?.lan||""} publicAddress={phone?.publicAccess?.address||phone?.publicAccess?.candidate} outside/><p>{l("Lass einen Freund über ein anderes Netzwerk beitreten. Ein Test im eigenen WLAN beweist die öffentliche Erreichbarkeit nicht. Simple Voice Chat benötigt zusätzlich eine passende UDP-Freigabe und die Client-Mod; gib nur den dafür konfigurierten Port frei.","Ask a friend on another network to join. A test on your home Wi-Fi does not prove public access works. Simple Voice Chat also needs the configured UDP forwarding rule and its client mod; forward only the port configured for it.")}</p></>}
 {step===6&&<><p>{l("Dein Server wird vollständig über diese Website verwaltet. Du kannst das Tutorial jederzeit unter Hilfe erneut öffnen.","Manage your server through this website. Reopen this tutorial any time under Help.")}</p><ul className="setup-steps">{[["Konsole","Console","Starten, stoppen und Befehle eingeben. Ein Stopp speichert die Welt.","Start, stop and send commands. Stopping saves your world."],["Dateien","Files","Dateien und Ordner hochladen oder suchen.","Upload or search for files and folders."],["Plugins / Mods","Plugins / Mods","Kompatible Erweiterungen im Katalog suchen und herunterladen. Bei Paper Plugins, bei Fabric Mods.","Find and download compatible extensions from the catalog: plugins for Paper, mods for Fabric."],["Spieler","Players","Online-Spieler, Inventar und Whitelist verwalten.","View online players and inventories and manage the allowlist."],["Backups","Backups","Sicherungen planen, herunterladen und bei gestopptem Server wiederherstellen.","Schedule, download and restore backups with the server stopped."],["Mitglieder & Rechte","Members & permissions","Freunde mit genau den gewünschten Website-Rechten einladen.","Invite friends with the website permissions you choose."]].map(([de,en,body,english])=><li key={de}><strong>{l(de,en)}</strong><p>{l(body,english)}</p></li>)}</ul></>}
 {error&&<p role="alert" className="log-error">{t(error)}</p>}<div className="toolbar"><button className="btn btn-outline" disabled={step===0||busy} onClick={()=>{setError("");setStep(s=>s-1);}}>{l("Zurück","Back")}</button><button className="btn btn-blue" disabled={busy} onClick={()=>step===6?close():void next()}>{busy?l("Wird gespeichert …","Saving …"):step===6?l("Fertig","Finish"):l("Weiter","Next")}</button></div></section>;
}
export function HelpPanel({start,owner}:{start:()=>void;owner:boolean}){
 const {locale}=useLanguage(),l=(de:string,en:string)=>locale==="de"?de:en;
 const [cat,setCat]=useState("all");
 const [search,setSearch]=useState("");
 const [openAll,setOpenAll]=useState(false);

 const categories=[
  {
   id:"quickstart",
   titleDe:"🚀 Schnellstart & Plattformen (Android, Windows, Linux & iOS)",
   titleEn:"🚀 Quickstart & Platforms (Android, Windows, Linux & iOS)",
   items:[
    [
     "Wie beginne ich auf Android, Windows, Linux/Ubuntu oder iOS?",
     "How do I begin?",
     "1. Lade für dein Host-Gerät die passende Version herunter: Auf Android die MineHost.apk, auf Windows MineHost_Windows.zip (Start-MineHost-Windows.bat starten) oder auf Linux/Ubuntu MineHost_Linux.zip (./start-minehost-linux.sh starten).\n2. Erstelle auf der Website dein Konto und bestätige einmalig die Verknüpfung deines Host-Geräts.\n3. Wähle unter „Serversoftware“ deine gewünschte Engine (z. B. PaperMC oder Fabric) und Minecraft-Version (1.0 bis aktuellste Version). MineHost lädt automatisch das passende portable Java herunter.\n4. Klicke oben rechts auf „Start“ – dein Server läuft!",
     "Install the APK on Android or extract the Windows/Linux package and run the starter script. Create your website account, confirm your host device, choose your server software and version, and press Start."
    ],
    [
     "Wie nutze ich MineHost auf dem iPhone oder iPad (iOS)?",
     "How do I use MineHost on iPhone or iPad (iOS)?",
     "Da Apple (iOS) Hintergrund-Java-Serverprozesse auf iPhones blockiert, funktioniert MineHost auf iOS als vollwertige Remote-Control Web-App (PWA): Öffne https://minehost-dashboard.adrilolghg.workers.dev in Safari auf deinem iPhone/iPad, tippe unten auf „Teilen“ (Viereck mit Pfeil) → „Zum Home-Bildschirm“. Danach hast du MineHost als Vollbild-App auf deinem iPhone und steuerst deinen Server-Host (auf PC, Linux oder Android) von überall in Echtzeit.",
     "Open the dashboard in Safari on your iPhone/iPad and tap Share → Add to Home Screen to install MineHost as a full-screen iOS app to control your Windows, Linux, or Android server host from anywhere."
    ],
    [
     "Wie starte ich den Server-Host auf Windows 10/11 oder Linux/Ubuntu?",
     "How do I run the server host on Windows or Linux/Ubuntu?",
     "• Windows: Entpacke MineHost_Windows.zip in einen Ordner und doppelklicke auf Start-MineHost-Windows.bat. Falls Node.js oder Java noch nicht installiert sind, lädt MineHost beides vollautomatisch portabel in den Ordner herunter.\n• Linux / Ubuntu: Entpacke MineHost_Linux.zip, führe chmod +x start-minehost-linux.sh && ./start-minehost-linux.sh aus. Zusätzlich steht dir lokal http://localhost:8787 zur Verfügung.",
     "On Windows, extract MineHost_Windows.zip and double-click Start-MineHost-Windows.bat. On Linux/Ubuntu, run ./start-minehost-linux.sh. Portable Node.js and Adoptium Java are downloaded automatically."
    ],
    [
     "Die Website zeigt „Host offline“ / „Handy offline“ – was tun?",
     "The website says phone offline",
     "• Auf Android: Prüfe WLAN/Internet am Handy, öffne die MineHost-App und stelle unter Android → Einstellungen → Apps → MineHost → Akku auf „Uneingeschränkt“ (Unrestricted), damit Android den Server nicht im Standby beendet.\n• Auf Windows / Linux: Prüfe, ob das Starter-Fenster (Start-MineHost-Windows.bat bzw. start-minehost-linux.sh) noch geöffnet ist und Internetverbindung besteht.",
     "Check your host's Wi-Fi/internet. On Android, open MineHost and set Android → Apps → MineHost → Battery to Unrestricted so Android does not suspend the server."
    ],
    [
     "Mehrere Server-Profile (Welten) auf einem Gerät erstellen & wechseln",
     "Create and switch between multiple server profiles",
     "Klicke links in der Seitenleiste neben dem Server-Dropdown auf das Zahnrad-Symbol („Server verwalten“). Dort kannst du beliebig viele getrennte Server-Profile (z. B. einen Paper-SMP-Server, einen Fabric-Mod-Server und eine Creative-Welt) anlegen, umbenennen oder wechseln. Jedes Profil besitzt eigene Welten, Plugins, Einstellungen und Backups. Zum Wechseln muss der aktuell laufende Server kurz gestoppt sein.",
     "Click the gear icon next to the server selector in the sidebar to create, rename, or switch isolated server profiles. Each profile keeps its own world, plugins, settings, and backups."
    ]
   ]
  },
  {
   id:"network",
   titleDe:"🌐 Netzwerk, Portfreigabe, UPnP & Eigene Domain",
   titleEn:"🌐 Network, Port Forwarding, UPnP & Custom Domain",
   items:[
    [
     "Freunde können nicht beitreten (Checkliste für WLAN & Internet)",
     "Friends cannot join",
     "1. Im selben WLAN (Heimnetz): Nutze die lokale IP-Adresse (z. B. 192.168.178.x:25565), die im Tab „Netzwerk“ unter „Lokale IP“ steht.\n2. Über das Internet (andere Netzwerke): Deine Freunde brauchen zwingend die „Öffentliche IP (WAN)“ inklusive Port! Richte im Tab „Netzwerk“ entweder per 1-Klick „UPnP-Portfreigabe aktivieren“ oder manuell im Router eine TCP-Portfreigabe für deinen Host (Standard-Port 25565) ein.\n3. Prüfe außerdem: Läuft der Server („Läuft“)? Stimmt die Minecraft-Version überein? Falls die Whitelist aktiv ist: Steht der Freund im Tab „Spieler“ auf der Whitelist?",
     "Test on the same Wi-Fi with the local address first. For other networks: start your server, follow Network to forward TCP to the displayed host IP and internal port (or use 1-Click UPnP), save and test. Share the public address including the external port. Normal IPv4 forwarding does not work behind DS-Lite/CGNAT; ask your ISP for public IPv4. Check game version and allowlist."
    ],
    [
     "Wie funktioniert eine eigene Domain (z. B. mc.deinedomain.de oder kostenlos via DuckDNS)?",
     "How do I set up a custom domain (A-Record, SRV-Record & DuckDNS)?",
     "• Kostenlos ohne Domain-Kauf (DuckDNS): Gehe auf duckdns.org, wähle einen freien Namen (z. B. meinserver.duckdns.org) und trage deine öffentliche IP aus dem Tab „Netzwerk“ ein.\n• Mit eigener Domain (Cloudflare, Strato, IONOS, Namecheap): Öffne bei deinem Domain-Anbieter die DNS-Einstellungen:\n  1. A-Record anlegen: Typ = A, Name = mc (für mc.deinedomain.de), Ziel = deine öffentliche Router-IP. WICHTIG bei Cloudflare: Stelle die Wolke auf „DNS Only“ (Graue Wolke), da die orange Wolke Minecraft blockiert!\n  2. SRV-Record anlegen (nur nötig, wenn dein externer Port NICHT 25565 ist): Typ = SRV, Name = _minecraft._tcp.mc, Priorität = 0, Gewicht = 5, Port = dein externer Port, Ziel = mc.deinedomain.de. Dadurch müssen Freunde keinen Port hinter der Domain eingeben.",
     "Use DuckDNS for a free subdomain or add an A-Record (pointing to your public WAN IP with Cloudflare Proxy disabled / grey cloud) and an optional SRV-Record (_minecraft._tcp) at your domain registrar."
    ],
    [
     "Was bedeutet DS-Lite / CGNAT und warum geht Portforwarding manchmal nicht?",
     "What is DS-Lite / CGNAT and how do I bypass it?",
     "Manche Internetanbieter (z. B. Kabel-Internet, Glasfaser oder Mobilfunk) vergeben keine eigene öffentliche IPv4-Adresse an deinen Router (sogenanntes DS-Lite oder Carrier-Grade NAT). Dann kommen Portfreigaben von außen nicht bei deinem Router an.\nLösungen:\n• Lösung 1: Rufe kurz beim Kundenservice deines Internetanbieters an und bitte um „Dual-Stack / eine öffentliche dynamische IPv4-Adresse“ (bei Vodafone, Telekom & o2 meist kostenlos in 5 Minuten freigeschaltet).\n• Lösung 2 (ohne Router-Portfreigabe): Nutze das kostenlose Plugin/Programm „playit.gg“ (gibt es direkt als Plugin für Paper/Fabric oder als kleines Hintergrundprogramm für Windows/Linux). Damit bekommst du sofort eine öffentliche Tunnel-Adresse ohne Router-Konfiguration.",
     "If your ISP uses CGNAT or DS-Lite without a public IPv4 address, router port forwarding cannot be reached from outside. Ask your ISP to enable public Dual-Stack IPv4, or install the free playit.gg plugin/tunnel."
    ],
    [
     "Simple Voice Chat (In-Game Sprachchat) einrichten",
     "Set up Simple Voice Chat (UDP)",
     "Wenn du das Plugin oder die Mod „Simple Voice Chat“ installiert hast, erkennt MineHost dies automatisch und blendet im Tab „Netzwerk“ den Bereich „Simple Voice Chat (UDP)“ ein. Lege in deinem Router zusätzlich zur TCP-Freigabe (für Minecraft) eine UDP-Portfreigabe für den Voice-Chat-Port (Standard: 24454) auf dieselbe Host-IP an.",
     "When Simple Voice Chat is installed, open the Network tab to configure its UDP port (default 24454) and add a matching UDP port forwarding rule on your router."
    ]
   ]
  },
  {
   id:"software",
   titleDe:"⚙️ Serversoftware, Java-Manager & Performance (Lag beheben)",
   titleEn:"⚙️ Server Software, Java Manager & Performance",
   items:[
    [
     "Welche Serversoftware (Engine) ist die richtige für mich?",
     "Which server software (engine) should I choose?",
     "• PaperMC / Purpur (Empfohlen für 90 % aller Server): Extrem schnell, ressourcenschonend und kompatibel mit tausenden Bukkit-, Spigot- und Paper-Plugins, ohne dass Mitspieler etwas auf ihrem PC installieren müssen.\n• Fabric / Forge / NeoForge / Quilt: Für Mod-Server (neue Blöcke, Biome, Technik-Mods, Modpacks). Hinweis: Content-Mods müssen auch bei allen Mitspielern im Minecraft-Launcher installiert sein.\n• Vanilla: Das unveränderte Original von Mojang (inklusive Snapshots), ideal für 100 % originales Redstone-Verhalten.\n• Pumpkin (Native Rust): Extrem schneller, nativer Server mit minimalem RAM-Verbrauch und experimentellem Java + Bedrock Crossplay.\n• Velocity / BungeeCord / Waterfall: Proxy-Server, um mehrere Minecraft-Server zu einem Netzwerk zu verbinden.",
     "Choose PaperMC or Purpur for high performance and plugins without client installation; Fabric, Forge, NeoForge, or Quilt for mods; Vanilla for official Mojang releases; or Pumpkin for native Rust & Bedrock crossplay."
    ],
    [
     "Muss ich Java selbst installieren? (Automatischer Portable-Java-Manager)",
     "Do I need to install Java manually? (Portable Java Manager)",
     "Nein! MineHost besitzt einen vollautomatischen Portable-Java-Manager (über die offizielle Adoptium Temurin API bzw. integriert in der Android-APK). Je nach gewählter Minecraft-Version weist MineHost beim Start automatisch die exakt passende Java-Version zu:\n• Minecraft 1.0 bis 1.16.5 → Java 8 LTS\n• Minecraft 1.17 → Java 16\n• Minecraft 1.18 bis 1.20.4 → Java 17 LTS\n• Minecraft 1.20.5 bis aktuellste Version → Java 21 / 25 LTS",
     "No! MineHost automatically downloads and assigns the required portable Java runtime (Java 8, 16, 17, 21, or 25) based on your selected Minecraft version."
    ],
    [
     "Der Server startet lange oder ruckelt (TPS-Drops & Lag beheben)",
     "Startup is slow or the game lags",
     "Beim allerersten Start werden Java, Bibliotheken und die Spawn-Chunks der Welt generiert – das dauert einmalig 1–3 Minuten. Wenn es im Spiel ruckelt (TPS unter 20):\n1. Öffne den Tab „Einstellungen“ und aktiviere „Aikar's Flags (G1GC)“ – das verhindert Ruckler durch die Java-Speicherbereinigung.\n2. Senke „Sichtweite (Chunks)“ auf 8–10 und „Simulationsdistanz“ auf 6–8.\n3. Erhöhe über den RAM-Schieberegler den zugewiesenen Arbeitsspeicher (z. B. 2048–4096 MiB), lasse dem Betriebssystem aber mindestens 1,5 GB frei.\n4. Nutze PaperMC oder Purpur statt Vanilla, oder installiere auf Fabric die Performance-Mod „Lithium“.",
     "The first start loads Java, libraries and the world. Wait for Running and check the console for errors. Lower view and simulation distance under Settings. More players and extensions need more RAM and CPU. Higher settings do not make a server faster."
    ],
    [
     "Minecraft-Version wechseln & Kompatibilitäts-Prüfung",
     "Switching Minecraft versions & compatibility check",
     "Du kannst unter „Serversoftware“ jederzeit auf eine andere Minecraft-Version wechseln. MineHost prüft dabei automatisch über die Modrinth-API, ob deine installierten Plugins/Mods für die neue Version verfügbar sind, und legt vor jedem Wechsel automatisch ein Sicherheits-Backup an. Achtung bei Downgrades (z. B. von 1.21 zurück auf 1.19): Ältere Minecraft-Versionen können neuere Welt-Chunke oft nicht lesen – erstelle vorher immer ein Voll-Backup!",
     "Switch versions anytime under Server Software. MineHost automatically checks Modrinth compatibility for your installed add-ons and backs up your server before switching."
    ]
   ]
  },
  {
   id:"addons",
   titleDe:"🧩 Plugins, Mods, Dateien & Konfigurationen",
   titleEn:"🧩 Plugins, Mods, Files & Configurations",
   items:[
    [
     "Plugins oder Mods hinzufügen (Modrinth-Store & eigene JARs)",
     "Add plugins or mods",
     "Paper verwendet Plugins, Fabric verwendet Mods. Öffne den Tab „Plugins“ bzw. „Mods“:\n• Über den integrierten Katalog: Tippe den Namen (z. B. WorldEdit, LuckPerms, Geyser, Lithium, Simple Voice Chat) ins Suchfeld und klicke auf „Download“. Benötigte Abhängigkeiten (wie die Fabric API) lädt MineHost automatisch mit.\n• Eigene .jar-Datei hochladen: Klicke oben rechts auf „JAR hochladen“ oder ziehe die Datei im Tab „Dateien“ in den Ordner plugins bzw. mods.\nStarte den Server danach einmal neu, damit die Erweiterung geladen wird.",
     "Paper uses plugins and Fabric uses mods. Stop the server, search in the matching tab and select Download. Alternatively, drop compatible JAR files into Files → plugins or mods. Then restart. Some Fabric mods are needed by every player. CurseForge requires configured API access; Modrinth needs no personal key."
    ],
    [
     "Eigene Welt (.zip) hochladen oder Dateien bearbeiten",
     "Upload a custom world (.zip) or edit config files",
     "Öffne den Tab „Dateien“:\n• Eigene Welt hochladen: Lade deine Welt als .zip-Archiv per Drag & Drop hoch und klicke in der Dateizeile auf den Button „Entpacken“ (Unzip). Benenne den entpackten Welt-Ordner in world um (bei gestopptem Server).\n• Konfigurationen bearbeiten: Über die Schnellzugriffs-Leiste oben im Dateimanager kannst du server.properties, whitelist.json, ops.json, banned-players.json und eula.txt mit 1 Klick öffnen. Der integrierte Live-Syntax-Prüfer warnt dich sofort bei Tippfehlern in JSON-, YAML- oder Properties-Dateien.",
     "In the Files tab, upload a .zip archive and click Unzip to extract custom worlds or packs. Use the quick-access bar to edit server.properties, whitelist.json, or ops.json with live syntax validation."
    ],
    [
     "Eigenes Server-Icon (64×64 Bild in der Serverliste) ändern",
     "Change your server icon (server-icon.png)",
     "Öffne den Tab „Einstellungen“ und scrolle ganz nach unten zum Button „Server-Icon ändern“. Wähle ein beliebiges PNG-, JPG- oder WebP-Bild aus – MineHost schneidet es automatisch auf das von Minecraft geforderte Format (64×64 Pixel PNG) zu und speichert es als server-icon.png.",
     "At the bottom of the Settings tab, click Change server icon and pick any PNG, JPG, or WebP image. MineHost automatically resizes it to 64×64 pixels."
    ]
   ]
  },
  {
   id:"players",
   titleDe:"🎮 Spieler, Admin-Rechte (OP), Whitelist & Bedrock-Crossplay",
   titleEn:"🎮 Players, OP Admin Rights, Allowlist & Bedrock Crossplay",
   items:[
    [
     "Wie gebe ich mir oder Freunden OP-Rechte (Operator / Admin / Gamemode)?",
     "How do I grant OP (Operator / Admin) permissions?",
     "Dafür gibt es zwei einfache Wege:\n1. Grafisch im Tab „Spieler“: Sobald der Spieler online ist, klicke seinen Namen an und drücke auf den Button „OP“ (oder direkt auf „Kreativ“, „Survival“, „Heilen“).\n2. Über die Live-Konsole: Tippe unten in die Befehlszeile der Konsole op DeinSpielername (ohne Schrägstrich /) ein und drücke Enter.",
     "Select an online player in the Players tab and click OP (or Creative / Survival / Heal), or type 'op PlayerName' in the Live Console."
    ],
    [
     "Spieler kicken, bannen, entbannen (Pardon) & Whitelist verwalten",
     "Kick, ban, unban (pardon) players & manage the allowlist",
     "• Im Tab „Spieler“ findest du für jeden Online-Spieler 1-Klick-Buttons für „Kicken“, „Bannen“ und „Pardon (Entbannen)“.\n• Darunter kannst du unter „Whitelist verwalten“ Spielernamen hinzufügen oder entfernen sowie bereits gebannte Spieler jederzeit über „Gebannte Spieler entbannen (Pardon)“ wieder freischalten.\n• Ob die Whitelist aktiv ist, schaltest du im Tab „Einstellungen“ unter „Whitelist aktivieren“ um.",
     "Use the 1-click buttons in the Players tab to kick, ban, or pardon players, and add or remove names under Manage allowlist."
    ],
    [
     "Können Java- und Bedrock-Spieler (Handy, PS5, Xbox, Switch) zusammen spielen?",
     "Can Java and Bedrock players play together (Crossplay)?",
     "Ja! Es gibt zwei Möglichkeiten je nach Plattform:\n• Auf Android, Windows & Linux mit der Engine „Pumpkin“: Aktiviere unter „Einstellungen“ den Schalter „Bedrock-Spieler erlauben“ (Standard-Port 19132 TCP & UDP) und starte den Server neu.\n• Auf Windows & Linux mit PaperMC / Purpur: Installiere im Tab „Plugins“ die Erweiterungen „Geyser“ und „Floodgate“ und gib den UDP-Port 19132 frei.",
     "Yes! On Pumpkin, enable 'Allow Bedrock players' in Settings (port 19132 TCP/UDP). On Windows/Linux PaperMC servers, you can also install the Geyser and Floodgate plugins."
    ]
   ]
  },
  {
   id:"backups",
   titleDe:"🛡️ Backups, Sicherheit, Co-Admins & Fehlerbehebung",
   titleEn:"🛡️ Backups, Security, Co-Admins & Troubleshooting",
   items:[
    [
     "Eine Sicherung (Backup) erstellen, planen oder wiederherstellen",
     "Restore a backup",
     "Stoppe für manuelle Backups oder Wiederherstellungen kurz den Server. Im Tab „Backups“ kannst du:\n• „Jetzt sichern“ klicken (entweder für den vollständigen Server oder ausgewählte Ordner wie world).\n• Automatische Backups nach Zeitplan (z. B. täglich um 03:00 Uhr oder alle 120 Minuten) inkl. Aufbewahrungslimit aktivieren.\n• Jedes Backup als .zip-Archiv auf deinen PC herunterladen oder mit 1 Klick auf „Wiederherstellen“ zurückspielen (vorher legt MineHost automatisch eine Sicherheitskopie des aktuellen Stands an).",
     "Stop the server first. Under Backups, inspect the scope and details and select Restore. Full backups replace the server state; scoped backups replace only their selected scope. A safety copy is created first. Scheduled backups run only while MineHost is active."
    ],
    [
     "Sicherheit und Rechte (Freunde als Co-Admins einladen)",
     "Security and permissions",
     "Teile niemals dein eigenes Konto-Passwort! Öffne stattdessen den Tab „Mitglieder & Rechte“. Dort kannst du einen Einladungslink erstellen und per Checkbox millimetergenau festlegen, was dein Freund darf (z. B. nur „Starten / Stoppen“ und „Konsole lesen“, aber keine „Dateien löschen“). Du kannst jeden Zugang zeitlich begrenzen oder jederzeit mit 1 Klick widerrufen.",
     "Forward only Minecraft ports, no admin ports or DMZ/Exposed Host. Minecraft account verification stays on. Use the allowlist and backups. Limit and revoke website invitations under Members & permissions. Keep your password private."
    ],
    [
     "Häufige Konsolenfehler & Sofort-Lösungen (Troubleshooting)",
     "Common console errors & quick fixes",
     "• „Failed to bind to port“: Der Port (z. B. 25565) wird bereits von einem anderen Prozess belegt. Ändere unter „Einstellungen“ den Minecraft-Port (z. B. auf 25566) oder stoppe die alte Instanz.\n• „java.lang.OutOfMemoryError: Java heap space“: Dem Server geht der RAM aus. Erhöhe im Tab „Einstellungen“ den RAM-Schieberegler oder reduziere die Sichtweite.\n• „UnsupportedClassVersionError“: Ein installiertes Plugin benötigt eine neuere Java-Version. Aktualisiere das Plugin im Tab „Plugins“.\n• „Failed to verify username!“: Ein Spieler ohne gekauftes Original-Minecraft (Cracked) versucht beizutreten, während online-mode=true aktiv ist.\n• Server hängt beim Stoppen („stop_error“): Klicke oben im roten Hinweisbanner auf „Hängenden Server beenden“, um den Prozess sauber zurückzusetzen.",
     "Fixes for 'Failed to bind to port' (change port or stop duplicate process), 'OutOfMemoryError' (increase RAM slider or lower view distance), and 'UnsupportedClassVersionError' (update plugin or Minecraft version)."
    ],
    [
     "Sprache ändern (Deutsch / English)",
     "Change language",
     "Die Sprache folgt zunächst deinem Gerät. Wähle oben rechts in der Kopfzeile der Website (oder in der App) jederzeit Deutsch oder English, um die Sprache sofort umzuschalten.",
     "Language follows your device by default. Select Deutsch or English at the top of the website or in the app to override it."
    ]
   ]
  }
 ];

 const q = search.trim().toLowerCase();
 const filteredCategories = categories.filter(c => cat === "all" || c.id === cat).map(c => ({
  ...c,
  items: c.items.filter(([de,en,bodyDe,bodyEn]) => !q || de.toLowerCase().includes(q) || en.toLowerCase().includes(q) || bodyDe.toLowerCase().includes(q) || bodyEn.toLowerCase().includes(q))
 })).filter(c => c.items.length > 0);

 return <section className="panel help-panel">
  <div className="section-heading">
   <div>
    <h2>{l("Hilfe, Handbuch & Problemlösungen","Help, Manual & Troubleshooting")}</h2>
    <p>{l("Alle Anleitungen, Erklärungen und Lösungen übersichtlich nach Kategorien geordnet.","All guides, explanations, and troubleshooting tips organized by category.")}</p>
   </div>
   <div className="toolbar">
    {owner&&<button className="btn btn-blue" onClick={start}>{l("Komplettes Tutorial starten","Start complete tutorial")}</button>}
    <button type="button" className="btn btn-outline compact" onClick={()=>setOpenAll(!openAll)}>{openAll?l("Alle einklappen","Collapse all"):l("Alle ausklappen","Expand all")}</button>
   </div>
  </div>

  <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
   <input
    value={search}
    onChange={e=>setSearch(e.target.value)}
    placeholder={l("Hilfe durchsuchen (z. B. Domain, Port, Lag, OP, Backup, iOS, Mods) …","Search help topics (e.g. domain, port, lag, OP, backup, iOS, mods) …")}
   />
   <div className="quick-files-bar" style={{marginBottom:0}}>
    <button type="button" className={`chip-btn ${cat==="all"?"active":""}`} onClick={()=>setCat("all")}>{l("Alle Kategorien","All categories")}</button>
    {categories.map(c=><button key={c.id} type="button" className={`chip-btn ${cat===c.id?"active":""}`} onClick={()=>setCat(c.id)}>{l(c.titleDe,c.titleEn)}</button>)}
   </div>
  </div>

  {filteredCategories.map(c=><div key={c.id} style={{marginBottom:26}}>
   <h3 style={{color:"#34d399",fontSize:15,marginBottom:10,paddingBottom:8,borderBottom:"1px solid rgba(52,211,153,0.22)"}}>{l(c.titleDe,c.titleEn)}</h3>
   {c.items.map(([de,en,bodyDe,bodyEn])=><details key={de} open={openAll||!!q||undefined}>
    <summary style={{fontWeight:600,color:"#ecfdf5"}}>{l(de,en)}</summary>
    <p style={{whiteSpace:"pre-line",marginTop:10,color:"#b8d4c6"}}>{l(bodyDe,bodyEn)}</p>
   </details>)}
  </div>)}

  {!filteredCategories.length && <div className="empty-state"><strong>{l("Keine passenden Hilfe-Einträge gefunden.","No matching help topics found.")}</strong><button type="button" className="btn btn-outline compact" onClick={()=>{setSearch("");setCat("all");}}>{l("Filter zurücksetzen","Reset filters")}</button></div>}
 </section>;
}
