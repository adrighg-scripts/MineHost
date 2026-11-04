"use client";
import { useLanguage } from "./language";
import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { Terminal, FolderOpen, Archive, Users, Globe, Settings, Server, Play, Square, RotateCw, ChevronDown, ChevronRight, ArrowLeft, Upload, Download, Plus, Trash2, Save, Menu, X, LogOut, ShieldCheck, Smartphone, RefreshCw, FileText, Puzzle, Copy, ExternalLink, Check, LoaderCircle, CircleHelp } from "lucide-react";
import { LanguageMenu } from "./language";
import {SetupGuide,HelpPanel} from "./setup-guide";
import Profiles from "./profiles";
import FilesPanel from "./files-panel";
import BackupsPanel from "./backups-panel";
import NetworkPanel from "./network";
import PlayersPanel from "./players";
import Members from "./members";
import ResourceMode from "./resource-mode";
import SoftwarePanel from "./software";
import PluginsPanel from "./plugins";
import PumpkinMarket from "./pumpkin-market";
import AccountMenu from "./account-menu";
import ServerIcon from "./server-icon";
import {BedrockOptions,BedrockConnection,type BedrockState} from "./bedrock";
const READ_ACTIONS = new Set(["profiles_list","files_pending", "settings_get", "files_list", "files_read", "backups_list", "players_get", "software_catalog", "software_get", "plugins_list", "mods_list", "player_detail", "backup_schedule_get", "backup_inspect"]);
type Job = {
    id: string;
    kind: string;
    state: string;
    result: any;
    created: number;
};
type Device = {
    publicAccess?: any;
    bedrock?: BedrockState;
    onlinePlayers?: number;
    profileId?: string;
    patchBukkit?: boolean;
    managementVersion?: number;
    profileName?: string;
    profiles?: { active: string; profiles: { id: string; name: string }[] };
    software?: {
        software: string;
        version: string;
        build?: number;
    };
    configured?: boolean;
    online: boolean;
    phase: string;
    message: string;
    console: string;
    lan: string;
    uptime: number;
    ram: number;
    rssMb: number | null;
    cpu: number | null;
    diskUsedMb: number;
    diskFreeMb: number;
    model: string;
    updated: number;
    internet: {
        phase: string;
        addresses: string[];
        claimUrl?: string;
        message?: string;
    };
};
const tabs = [

    { id: "console", title: "Konsole", icon: Terminal }, { id: "files", title: "Dateien", icon: FolderOpen },
    { id: "backups", title: "Backups", icon: Archive }, { id: "players", title: "Spieler", icon: Users },
    { id: "network", title: "Netzwerk", icon: Globe }, { id: "settings", title: "Einstellungen", icon: Settings },
    { id: "software", title: "Serversoftware", icon: Server },
    { id: "plugins", title: "Plugins", icon: Puzzle }, { id: "mods", title: "Mods", icon: Puzzle },
    { id: "members", title: "Mitglieder & Rechte", icon: ShieldCheck },
    {id:"help",title:"Hilfe",icon:CircleHelp},
];
const phases: Record<string, string> = { stopped: "Gestoppt", running: "Läuft", starting: "Startet", preparing: "Wird eingerichtet", stopping: "Stoppt", error: "Fehler", stop_error: "Fehler beim Stoppen", backing_up:"Backup wird erstellt", applying:"Dateiänderungen werden übernommen" };
const size = (bytes: number) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MiB` : `${Math.max(1, Math.round(bytes / 1024))} KiB`;
const duration = (seconds: number) => seconds < 3600 ? `${Math.floor(seconds / 60)} min` : `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min`;
export default function Dashboard({ account, signOut, serverId, servers, initialPermissions, initialOwner, initialProfiles }: {
    account: string;
    signOut: string;
    serverId: string;
    servers: {
        online?: boolean;
        owner?: boolean;
        model?: string;
        id: string;
        name: string;
    }[];
    initialPermissions: string[];
    initialOwner: boolean;
    initialProfiles?: Device["profiles"];
}) {
    const { t, locale } = useLanguage();
    const [permissions, setPermissions] = useState(initialPermissions), [owner, setOwner] = useState(initialOwner);
    const can = (permission: string) => owner || permissions.includes(permission);
    const api = (path: string) => path + (path.includes("?") ? "&" : "?") + "server=" + encodeURIComponent(serverId);
    const [tab, setTab] = useState("console");
    const [drawer, setDrawer] = useState(false);
    useEffect(()=>{window.scrollTo(0,0);},[]);
    const [guide,setGuide]=useState(false);
    const guideChecked=useRef(false);
    const guideKey="minehost-guide:"+account+":"+serverId;
    const closeGuide=()=>{setGuide(false);try{localStorage.setItem(guideKey+":"+(phone?.profileId||"default"),"done");const url=new URL(window.location.href);url.searchParams.delete("setup");history.replaceState(null,"",url);}catch{}};
    const [phone, setPhone] = useState<Device | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState("");
    const [pending, setPending] = useState(0);
    const [command, setCommand] = useState("");
    const [path, setPath] = useState("");
    const [listing, setListing] = useState<any[]>([]);
    const [fileIndex, setFileIndex] = useState<any>(null);
    const [editor, setEditor] = useState<{
        path: string;
        content: string;
    } | null>(null);
    const [backups, setBackups] = useState<any[]>([]);
    const [players, setPlayers] = useState<{
        online: string[];
        whitelist: string[];
    }>({ online: [], whitelist: [] });
    const [playerName, setPlayerName] = useState("");
    const [settings, setSettings] = useState<any>(null);
    const settingsEdited = useRef(false);
    const latest = useRef<Job[]>([]);
    const logPane = useRef<HTMLDivElement>(null);
    const follow = useRef(true);
    const fileInput = useRef<HTMLInputElement>(null);
    const pollRequest = useRef<Promise<void> | null>(null), reads = useRef(new Map<string, Promise<any>>()), readCache = useRef(new Map<string, {
        value: any;
        time: number;
    }>());
    const visibleTabs = tabs.filter(item => item.id === "members" ? owner&&(!phone?.profileId||phone.profileId==="default") : ({ help:true, console: true, files: can("files.read"), software: can("settings.read"), mods: phone?.software?.software === "fabric" && can("mods.read"), plugins: phone?.software?.software !== "fabric" && can("plugins.read"), backups: can("backups.read"), players: can("players"), settings: can("settings.read"), network: can("network") } as Record<string, boolean>)[item.id]);
    useEffect(()=>{if(!owner||!phone||guideChecked.current)return;guideChecked.current=true;try{if(new URLSearchParams(window.location.search).get("setup")==="1"||phone.configured===false&&!localStorage.getItem(guideKey+":"+(phone.profileId||"default")))setGuide(true);}catch{}},[owner,phone]);
    const online = !!phone?.online;
    const running = phone?.phase === "running";
    const active = ["running", "starting", "stopping", "preparing", "stop_error", "backing_up", "applying"].includes(phone?.phase ?? "");
    const notice = useCallback((message: string) => { setToast(t(message)); }, [t]);
    useEffect(() => { if (!visibleTabs.some(item => item.id === tab))
        setTab("console"); if (!can("files.read")) {
        setListing([]);
        setEditor(null);
    } if (!can("backups.read"))
        setBackups([]); if (!can("settings.read"))
        setSettings(null); }, [permissions, owner]);
    useEffect(() => { if (!toast)
        return; const timer = setTimeout(() => setToast(t("")), 6500); return () => clearTimeout(timer); }, [toast]);
    const poll = useCallback(() => {
        if (pollRequest.current)
            return pollRequest.current;
        const request = (async () => {
            try {
                const response = await fetch(api("/api/state"), { cache: "no-store" });
                const data: any = await response.json();
                if (!response.ok)
                    throw new Error(data.error || "Status konnte nicht geladen werden.");
                setPhone(data.device);
                setJobs(data.jobs);
                latest.current = data.jobs;
                setPermissions(data.permissions);
                setOwner(data.owner);
            }
            catch (error) {
                setPhone(null);
                setPermissions([]);
                setOwner(false);
                notice(t(error instanceof Error ? error.message : "Verbindung zur Website fehlgeschlagen."));
            }
            finally {
                setLoading(false);
            }
        })();
        pollRequest.current = request;
        void request.finally(() => { pollRequest.current = null; });
        return request;
    }, [notice]);
    useEffect(() => { let closed = false, timer: ReturnType<typeof setTimeout>; const refresh = async () => { await poll(); if (!closed)
        timer = setTimeout(refresh, document.visibilityState === "hidden" ? 10000 : 2000); }; void refresh(); const wake = () => { if (document.visibilityState !== "hidden")
        void poll(); }; document.addEventListener("visibilitychange", wake); return () => { closed = true; clearTimeout(timer); document.removeEventListener("visibilitychange", wake); }; }, [poll]);
    useEffect(() => { if (!online || !can("files.read")) {
        setFileIndex(null);
        return;
    } let ended = false, timer: ReturnType<typeof setTimeout>; let etag = ""; async function refreshIndex() { try {
        const response = await fetch(api("/api/files/index"), { cache: "no-store", headers: etag ? { "If-None-Match": etag } : {} });
        if (response.status === 200) {
            const value = await response.json();
            if (!ended) {
                setFileIndex(value);
                etag = response.headers.get("etag") || "";
            }
        }
    }
    catch { }
    finally {
        if (!ended)
            timer = setTimeout(refreshIndex, 5000);
    } } void refreshIndex(); return () => { ended = true; clearTimeout(timer); }; }, [online, serverId, owner, permissions.includes("files.read"),phone?.profileId]);
    const settingsKey = phone ? "minehost-settings:" + account + ":" + serverId + ":" + (phone.profileId || "default") : "";
    const currentSettingsKey = useRef(settingsKey);
    currentSettingsKey.current = settingsKey;
    useEffect(() => {
        readCache.current.clear();
        settingsEdited.current = false;
        setSettings(null);
        setFileIndex(null);
        if (settingsKey && can("settings.read")) {
            try { setSettings(JSON.parse(sessionStorage.getItem(settingsKey) || "null")); } catch {}
        }
    }, [settingsKey, can("settings.read")]);
    useEffect(() => { if (!online)
        return; const tasks: string[] = []; if (can("settings.read"))
        tasks.push("settings_get"); if (can("backups.read"))
        tasks.push("backups_list", "backup_schedule_get"); if (phone?.software?.software === "paper" && can("plugins.read"))
        tasks.push("plugins_list"); if (phone?.software?.software === "fabric" && can("mods.read"))
        tasks.push("mods_list"); void Promise.allSettled(tasks.map(kind => job(kind))); }, [online, serverId, phone?.software?.software,phone?.profileId]);
    useEffect(() => { if (follow.current && logPane.current)
        logPane.current.scrollTop = logPane.current.scrollHeight; }, [phone?.console]);
    async function job(kind: string, payload: any = {}) {
        const key = kind + JSON.stringify(payload), isRead = READ_ACTIONS.has(kind);
        if (isRead && reads.current.has(key))
            return reads.current.get(key);
        const cached = readCache.current.get(key);
        if (cached && !["files_pending", "players_get", "player_detail"].includes(kind) && Date.now() - cached.time < (kind === "software_catalog" ? 600000 : 15000))
            return cached.value;
        const request = runJob(kind, payload);
        if (isRead)
            reads.current.set(key, request);
        try {
            const value = await request;
            if (isRead)
                readCache.current.set(key, { value, time: Date.now() });
            return value;
        }
        finally {
            if (isRead)
                reads.current.delete(key);
        }
    }
    async function runJob(kind: string, payload: any) {
        if (!online)
            throw new Error("Das Handy ist nicht verbunden.");
        const mutation = !READ_ACTIONS.has(kind);
        if (mutation)
            setPending(n => n + 1);
        try {
            const response = await fetch(api("/api/commands"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, payload,profileId:phone?.profileId||"default" }) });
            const data: any = await response.json();
            if (!response.ok)
                throw new Error(data.error || "Aktion fehlgeschlagen.");
            const deadline=Date.now()+300000;
            for (let tries=0;Date.now()<deadline;tries++) {
                await new Promise(resolve=>setTimeout(resolve,tries===0?250:tries<6?500:1000));
                const response = await fetch(api("/api/jobs/" + data.id), { cache: "no-store" });
                const result: any = await response.json();
                if (!response.ok)
                    throw new Error(result.error || "Aktion konnte nicht gelesen werden.");
                if (result?.state === "done") {
                    if (mutation) {
                        readCache.current.clear();
                        void poll();
                    }
                    return kind === "device_remove_verify" ? { ...result.result, receipt: data.id } : result.result;
                }
                if (result && ["error", "expired", "unknown"].includes(result.state))
                    throw new Error(result.result?.error || (result.state === "unknown" ? "Handy wurde während der Aktion neu gestartet. Ergebnis bitte prüfen." : "Aktion abgelaufen oder fehlgeschlagen."));
            }
            throw new Error("Die Aktion braucht länger. Den Verlauf unten prüfen.");
        }
        finally {
            if (mutation)
                setPending(n => n - 1);
        }
    }
    async function perform(kind: string, payload: any = {}) { try {
        const result = await job(kind, payload);
        if(!READ_ACTIONS.has(kind))notice(t(result?.message || "Aktion abgeschlossen."));
        return result;
    }
    catch (error) {
        notice(t(error instanceof Error ? error.message : "Aktion fehlgeschlagen."));
    } }
    async function loadFiles(folder = path) { const result = await perform("files_list", { path: folder }); if (result) {
        setPath(folder);
        setListing(result.entries);
        setEditor(null);
    } }
    async function loadBackups() { const result = await perform("backups_list"); if (result)
        setBackups(result.entries); }
    async function loadPlayers() { const result = await perform("players_get"); if (result)
        setPlayers(result); }
    async function loadSettings() {
        if (!online || !settingsKey) return;
        const result = await perform("settings_get", { refresh: Date.now() });
        if (!result || currentSettingsKey.current !== settingsKey) return;
        try { sessionStorage.setItem(settingsKey, JSON.stringify(result)); } catch {}
        if (!settingsEdited.current) setSettings(result);
    }
    useEffect(() => {
        if (tab === "settings" && online && can("settings.read")) void loadSettings();
    }, [tab, online, settingsKey, can("settings.read")]);
    function navigate(id: string) {
        setTab(id);
        window.scrollTo({top:0,behavior:"smooth"});
        setDrawer(false);
        setEditor(null);
        if (id === "backups")
            loadBackups();

    }
    async function sendConsole(event: FormEvent) { event.preventDefault(); if (!command.trim())
        return; const result = await perform("console", { command }); if (result)
        setCommand(""); }
    async function transferTicket(name: string, permission = "files.read") {
        const response = await fetch(api(`/api/transfers?direction=download&name=${encodeURIComponent(name)}&permission=${permission}`), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const data: any = await response.json();
        if (!response.ok)
            throw new Error(data.error);
        return data.id;
    }
    async function download(kind: string, file: string) {
        try {
            const id = await transferTicket(file.split("/").pop() || "download.bin", kind === "backup_download" ? "backups.read" : "files.read");
            await job(kind, { path: file, transferId: id });
            const link = document.createElement("a");
            link.href = api(`/api/transfers/${id}`);
            link.click();
        }
        catch (error) {
            notice(t(error instanceof Error ? error.message : "Download fehlgeschlagen."));
        }
    }
    async function upload(file: File) {
        if (file.size > 64 * 1024 * 1024) {
            notice(t("Maximal 64 MiB pro Datei."));
            return;
        }
        try {
            const response = await fetch(api(`/api/transfers?name=${encodeURIComponent(file.name)}`), { method: "POST", body: file });
            const data: any = await response.json();
            if (!response.ok)
                throw new Error(data.error);
            await job("files_upload", { path: path ? `${path}/${file.name}` : file.name, transferId: data.id });
            notice(t("Datei auf dem Handy gespeichert."));
            loadFiles(path);
        }
        catch (error) {
            notice(t(error instanceof Error ? error.message : "Upload fehlgeschlagen."));
        }
    }
    const selected = tabs.find(item => item.id === tab)!;
    const publicAddress = phone?.publicAccess?.address || phone?.publicAccess?.candidate;
    const playersPresent = running && (phone?.onlinePlayers || 0) > 0;
    const devicePicker = <label className="host-picker">{t("Host-Gerät")}<select aria-label={t("Host-Gerät")} value={serverId} onChange={event => { window.location.href = "/?server=" + encodeURIComponent(event.target.value); }}>{servers.map(server => <option key={server.id} value={server.id}>{server.model || server.name}{(server.id === serverId ? online : server.online) ? "" : " (" + t("Offline") + ")"}</option>)}</select></label>;
    return <div className="app-shell">
    <header className="topbar"><button className="icon-button mobile-menu" aria-label={t("Navigation öffnen")} onClick={() => setDrawer(true)}><Menu size={22}/></button>
      <a className="brand" href="/"><span className="brand-mark"><Server size={23}/></span><span>{t("MineHost")}<small>{t("SERVER CONTROL")}</small></span></a>
      <div className="topbar-right"><LanguageMenu /><span className={`connection ${online ? "connected" : ""}`}><span />{online ? t("Handy verbunden") : loading ? t("Verbindung prüfen") : t("Handy offline")}</span><span className="header-rule"/><AccountMenu account={account} signOut={signOut}/></div>
    </header>
    {drawer && <button className="scrim" aria-label={t("Navigation schließen")} onClick={() => setDrawer(false)}/>}
    <aside className={`sidebar ${drawer ? "open" : ""}`}>
      <div className="server-switch">{devicePicker}{owner && <Profiles devicePicker={devicePicker} renameDevice={async () => {
const current = servers.find(server => server.id === serverId);
        const label = prompt(t("Gerät umbenennen"), current?.model || current?.name || "")?.trim();
        if (!label) return;
        try {
            const response = await fetch(api("/api/host-label"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
            const result = await response.json() as { error?: string };
            if (!response.ok) throw new Error(result.error);
            window.location.reload();
        } catch (error) {
            notice(t(error instanceof Error ? error.message : "Gerätename konnte nicht gespeichert werden."));
        }
      }} canDelete={(phone?.managementVersion || 0) >= 12 || ((phone?.managementVersion || 0) >= 11 && phone?.profileId !== "default")}
        canRemoveDevice={(phone?.managementVersion || 0) >= 12}
        offlineDevices={servers.filter(server => server.owner && !(server.id === serverId ? (phone ? online : server.online) : server.online)).map(server => ({ id: server.id, name: server.model || server.name }))}
        removeOfflineDevice={async (target, password) => {
          const response = await fetch("/api/host-remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, password }) });
          if (!response.ok) {
            const result = await response.json() as { error?: string };
            throw new Error(result.error || t("Aktion fehlgeschlagen."));
          }
        }}
        removeDevice={async (receipt, target) => {
          const response = await fetch(api("/api/host-remove"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt, target }) });
          if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || t("Gerät konnte nicht entfernt werden."));
        }} initialData={phone?.profiles ?? initialProfiles} canRename={(phone?.managementVersion || 0) >= 7} online={online} active={active} running={running} run={job}/>}</div>
      <div className="nav-caption">{t("VERWALTUNG")}</div><nav>{visibleTabs.map(item => <button key={item.id} className={tab === item.id ? "nav-item selected" : "nav-item"} onClick={() => navigate(item.id)}><item.icon size={19}/><span>{t(item.title)}</span>{item.id === "backups" && backups.length > 0 && <b>{backups.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><Smartphone size={18}/><div><strong>{phone?.model || t("Dein Android-Handy")}</strong><small>{t("Der Server bleibt auf deinem Handy")}</small></div></div>
    </aside>
    <main className="workspace">
      <div className="page-heading"><div><div className="breadcrumb">{t("Mein Server ")}<ChevronRight size={13}/> {t(selected.title)}</div><h1>{guide?(locale==="de"?"Einrichtung":"Setup"):t(selected.title)}</h1></div>
        {!guide&&can("power") && <div className="server-actions"><button className="btn btn-blue" disabled={!online || active || pending > 0} onClick={() => perform("start")}><Play size={16} fill="currentColor"/>{t("Start")}</button><button className="btn btn-outline" disabled={!online || !running || pending > 0} onClick={() => perform("restart")}><RotateCw size={16}/>{t("Neustart")}</button><button className="btn btn-red" disabled={!online || !["starting", "running"].includes(phone?.phase ?? "") || pending > 0} onClick={() => perform("stop")}><Square size={14} fill="currentColor"/>{t("Stopp")}</button></div>}
      </div>
      {guide&&owner&&<SetupGuide phone={phone} owner={owner} run={job} navigate={navigate} close={closeGuide}/>}
      {!guide&&<>
      <section className="metrics" aria-label={t("Serverstatus")}>
        <div className="metric"><span>{t("Server")}</span><strong>{phone?.profileName || t("Mein Minecraft-Server")}</strong></div>
        <div className="metric"><span>{t("Status")}</span><strong className={online && running ? "green" : ""}><i className={`status-dot ${online && running ? "live" : ""}`}/>{online ? t(phases[phone?.phase ?? "stopped"]) : t("Offline")}{online && running && <em>{t("(")}{duration(phone?.uptime || 0)}{t(")")}</em>}</strong></div>
        <div className="metric address-metric"><span>{t("Spieladresse")}</span><strong>{publicAddress || t("Netzwerk noch nicht eingerichtet")}</strong>{publicAddress && <button className="tiny" aria-label={t("Spieladresse kopieren")} onClick={() => { navigator.clipboard.writeText(publicAddress); notice(t("Spieladresse kopiert.")); }}><Copy size={14}/></button>}</div>
        <div className="metric"><span>{t("CPU")}</span><strong>{online && phone?.cpu != null ? `${phone.cpu.toFixed(1)} %` : "—"}</strong><small>{t("Serverprozess")}</small></div>
        <div className="metric"><span>{t("RAM")}</span><strong>{online && phone?.rssMb != null ? `${(phone.rssMb / 1024).toFixed(2)} GiB` : "—"}<em>{t(" / ")}{phone?.ram ? `${(phone.ram / 1024).toFixed(1)} GiB Heap-Limit` : "—"}</em></strong></div>
        <div className="metric"><span>{t("Speicher")}</span><strong>{phone ? `${(phone.diskUsedMb / 1024).toFixed(2)} GiB` : "—"}<em>{t(" / ")}{phone ? `${(phone.diskFreeMb / 1024).toFixed(1)} GiB frei` : "—"}</em></strong></div>
      </section>
      {online && !playersPresent && !phone?.publicAccess?.configured && <div className="notice">{t("Portfreigabe noch nicht eingerichtet.")} <button className="btn btn-outline compact" onClick={() => navigate("network")}>{t("Netzwerk einrichten")}</button></div>}
      {!online && <div className="offline-note"><Smartphone size={18}/><div><strong>{loading ? t("Verbindung wird geprüft …") : t("Das Handy ist gerade nicht verbunden.")}</strong><p>{t("Öffne MineHost auf dem Handy und prüfe seine Internetverbindung. Sobald es verbunden ist, kannst du den Server hier verwalten.")}</p></div></div>}
      {online && phone?.message && ["error", "stop_error"].includes(phone.phase) && <div className="notice error-note">{t(phone.message)}{phone.phase === "stop_error" && <button className="btn btn-red" disabled={!!pending} onClick={() => { if (confirm(t("Minecraft hat beim Stoppen einen Fehler gemeldet. Erzwungen beenden? Nicht gespeicherte Änderungen können verloren gehen.")))
        perform("recover", { confirmed: true }); }}>{t("H\u00E4ngenden Server beenden")}</button>}</div>}
      {tab === "members" && owner && <Members serverId={serverId}/>}
      {tab === "software" && <SoftwarePanel online={online} active={active} supported={(phone?.managementVersion || 0) >= 3} current={phone?.software} configured={!!phone?.configured} owner={owner} run={job}/>}
      {tab === "plugins" && phone?.software?.software === "pumpkin" && <PumpkinMarket serverId={serverId} canInstall={online && !active && can("plugins.write") && (phone?.managementVersion || 0) >= 9} canUpload={online && can("files.write") && (phone?.managementVersion || 0) >= 9} run={job}/>}
      {tab === "plugins" && (phone?.software?.software !== "pumpkin" || phone?.patchBukkit) && <PluginsPanel online={online} supported={(phone?.managementVersion || 0) >= 3} canWrite={can("plugins.write")} software={phone?.software?.software} serverId={serverId} run={job} openPatchBukkitFolder={phone?.software?.software === "pumpkin" && can("files.read") ? () => {
        setPath("pumpkin/plugins");
        setTab("files");
      } : undefined} openFiles={() => { if (!can("files.read")) {
        notice(t("Zum Bearbeiten von Plugin-Konfigurationen werden Dateirechte benötigt."));
        return;
    } setTab("files"); setPath(phone?.software?.software==="pumpkin"?"pumpkin/plugins/data/patchbukkit/patchbukkit-plugins":"plugins"); }}/>}
      {tab === "mods" && phone?.software?.software === "fabric" && <PluginsPanel mods online={online} supported={(phone.managementVersion || 0) >= 4} canWrite={can("mods.write")} software="fabric" serverId={serverId} run={job} openFiles={() => { if (!can("files.read")) {
        notice(t("Dafür brauchst du Dateirechte."));
        return;
    } setTab("files"); setPath("mods"); }}/>}
      {tab==="help"&&<HelpPanel owner={owner} start={()=>setGuide(true)}/>}
      {!guide&&owner&&online&&phone?.configured===false&&<section className="panel"><h2>{locale==="de"?"Deinen Server einrichten":"Set up your server"}</h2><button className="btn btn-blue" onClick={()=>setGuide(true)}>{locale==="de"?"Schritt für Schritt starten":"Start step by step"}</button></section>}
      {tab === "console" && <section className="console-panel"><div className="panel-top"><span><Terminal size={15}/>{t("Live-Konsole")}</span><span className="live-indicator"><i />{online ? t("Aktualisiert sich automatisch") : t("Letzte Ausgabe")}</span></div>
        <div className="console-output" ref={logPane} onScroll={() => { if (logPane.current)
            follow.current = logPane.current.scrollHeight - logPane.current.scrollTop - logPane.current.clientHeight < 50; }}>
          {phone?.console ? phone.console.split("\n").map((line, index) => <div key={index} className={/ERROR|Exception/.test(line) ? "log-error" : /WARN/.test(line) ? "log-warning" : /joined the game|Done \(/.test(line) ? "log-success" : ""}>{line || "\u00a0"}</div>) : <div className="console-empty"><Terminal size={30}/><strong>{t("Deine Serverkonsole")}</strong><span>{online ? t("Starte den Server, um die Ausgabe zu sehen.") : t("Warte auf die Verbindung mit deinem Handy.")}</span></div>}
        </div>{can("console.write") && <form className="command-bar" onSubmit={sendConsole}><ChevronRight size={19}/><input aria-label={t("Konsolenbefehl")} placeholder={t("Befehl eingeben …")} value={command} onChange={event => setCommand(event.target.value)} disabled={!online || !running}/><button className="send-command" disabled={!online || !running || !command.trim() || pending > 0}>{t("Senden \u21B5")}</button></form>}
      </section>}
      {can("files.read") && <div hidden={tab !== "files"}><FilesPanel key={phone?.profileId||"default"} serverId={serverId} online={online} active={active} visible={tab==="files"} queueSupported={(phone?.managementVersion||0)>=5} moveSupported={(phone?.managementVersion||0)>=10} canWrite={can("files.write")} index={fileIndex} folder={path} run={job} notice={notice} download={download}/></div>}
      {tab === "backups" && <BackupsPanel idlePolicy={(phone?.managementVersion||0)>=5} online={online} active={active} owner={owner} canCreate={can("backups.create")} canRestore={can("backups.restore")} run={job} download={download}/>}
      {tab === "players" && <PlayersPanel online={online} running={running} bedrock={!!phone?.bedrock?.activePort} canCommand={can("console.write")} run={job}/>}
      {tab === "network" && <><NetworkPanel network={phone?.publicAccess} lan={phone?.lan || ""} online={online} playersPresent={playersPresent} canWrite={can("network")} run={job}/><BedrockConnection state={phone?.bedrock} lan={phone?.lan||""} publicAddress={phone?.publicAccess?.address||phone?.publicAccess?.candidate} outside/></>}
      {tab === "settings" && <section className="panel settings-panel"><div className="section-heading"><div><h2>{t("Servereinstellungen")}</h2><p>{t("Änderungen gelten beim nächsten Start des Servers.")}</p></div><button className="tiny" aria-label={t("Einstellungen laden")} disabled={!online || !!pending} onClick={loadSettings}><RefreshCw size={17}/></button></div>{settings ? <form onChangeCapture={() => { settingsEdited.current = true; }} onSubmit={async (event) => { event.preventDefault(); if (await perform("settings_save", settings)) { settingsEdited.current = false; await loadSettings(); } }}>{phone?.software?.software !== "pumpkin" && <ResourceMode settings={settings} onChange={setSettings} active={active && (phone?.managementVersion || 0) < 8}/>}<div className="settings-grid">{[{ key: "memory", title: t("RAM-Limit (MiB)"), min: 512, max: 4096 }, { key: "maxPlayers", title: t("Maximale Spieler"), min: 1, max: 2147483647 }, { key: "viewDistance", title: t("Sichtweite (Chunks)"), min: 2, max: settings.viewDistanceLimit || 32 }, { key: "simulationDistance", title: t("Simulationsdistanz"), min: 2, max: 32 }, { key: "port", title: t("Minecraft-Port"), min: 1024, max: 65535 }].filter(field => field.key !== "memory" || phone?.software?.software !== "pumpkin").map(field => <label key={field.key}>{t(field.title)}<input type="number" required min={field.min} max={field.key === "memory" ? settings.manualMemoryLimit || 4096 : field.max} disabled={field.key === "memory" && !!settings.maxResources} value={settings[field.key]} onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })}/></label>)}<label>{t("Schwierigkeit")}<select value={settings.difficulty} onChange={event => setSettings({ ...settings, difficulty: event.target.value })}>{["peaceful", "easy", "normal", "hard"].map(value => <option key={value} value={value}>{({ peaceful: t("Friedlich"), easy: t("Einfach"), normal: t("Normal"), hard: t("Schwer") } as any)[value]}</option>)}</select></label><label>{t("Spielmodus")}<select value={settings.gamemode} onChange={event => setSettings({ ...settings, gamemode: event.target.value })}>{["survival", "creative", "adventure", "spectator"].map(value => <option key={value} value={value}>{t(({ survival: "Überleben", creative: "Kreativ", adventure: "Abenteuer", spectator: "Zuschauer" } as Record<string, string>)[value])}</option>)}</select></label><label>{t("Serverbeschreibung")}<input maxLength={120} value={settings.motd} onChange={event => setSettings({ ...settings, motd: event.target.value })}/></label>{phone?.software?.software !== "pumpkin" && typeof settings.pvp === "boolean" && <><label>{t("Inaktivitätslimit (Minuten)")}<input type="number" min={0} max={2147483647} required value={settings.idleTimeout} onChange={event => setSettings({ ...settings, idleTimeout: Number(event.target.value) })}/></label>{([{key:"pvp",label:"PvP"},{key:"allowFlight",label:"Fliegen erlauben"},{key:"hardcore",label:"Hardcore"},{key:"forceGamemode",label:"Spielmodus beim Beitritt erzwingen"}]).map(field => <label className="toggle-row" key={field.key}><span>{t(field.label)}</span><input type="checkbox" checked={!!settings[field.key]} onChange={event => setSettings({ ...settings, [field.key]: event.target.checked })}/></label>)}</>}</div><label className="toggle-row"><span><strong>{t("Whitelist aktivieren")}</strong><small>{t("Deaktiviert: Jeder authentifizierte Java-Spieler mit der Adresse kann beitreten.")}</small></span><input type="checkbox" checked={settings.whitelist} onChange={event => setSettings({ ...settings, whitelist: event.target.checked })}/></label><BedrockOptions settings={settings} software={phone?.software?.software} disabled={!can("settings.write")||!online||!!pending} onChange={setSettings}/><BedrockConnection state={phone?.bedrock} lan={phone?.lan||""} whitelist={settings.whitelist}/><div className="security-row"><ShieldCheck size={18}/><span>{t("Minecraft-Authentifizierung ist eingeschaltet.")}</span></div><button className="btn btn-blue" disabled={!can("settings.write") || !online || (active && (!running || (phone?.managementVersion || 0) < 8)) || !!pending}><Save size={16}/>{t("Einstellungen speichern")}</button></form> : <div className="empty-state"><Settings size={28}/><span>{t("Einstellungen vom Handy laden.")}</span><button className="btn btn-outline" disabled={!online || !!pending} onClick={loadSettings}>{t("Einstellungen laden")}</button></div>}{can("settings.write") && can("files.write") && <ServerIcon key={phone?.profileId || "default"} serverId={serverId} enabled={online && (!active || (phone?.managementVersion || 0) >= 5)} run={job}/>}</section>}
      <footer className="workspace-footer"><span><ShieldCheck size={13}/>{t("Privates Dashboard")}</span><span>{phone?.updated ? `${t("Letzte Rückmeldung:")} ${new Date(phone.updated).toLocaleTimeString(locale)}` : t("Warte auf erste Rückmeldung")}</span><span>{t("MineHost \u00B7 ")}{phone?.software?.version || t("Java Edition")}</span></footer>
      {jobs.some(item => ["error", "unknown"].includes(item.state)) && <details className="job-history"><summary>{t("Letzte Aktionen pr\u00FCfen")}</summary>{jobs.slice(0, 8).map(item => <div key={item.id}><code>{item.kind}</code><span>{item.state}</span>{item.result?.error && <span className="log-error">{t(item.result.error)}</span>}</div>)}</details>}
      </>}
    </main>
    {pending > 0 && <div className="working"><LoaderCircle size={15} className="spin"/>{t("Aktion wird auf dem Handy ausgef\u00FChrt \u2026")}</div>}
    {toast && <div className="toast" role="status"><span>{t(toast)}</span><button className="tiny" aria-label={t("Meldung schließen")} onClick={() => setToast(t(""))}><X size={16}/></button></div>}
  </div>;
}
