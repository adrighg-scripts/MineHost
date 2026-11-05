"use client";
import { useLanguage } from "./language";
import { useEffect, useState } from "react";
import { Cpu, ShieldAlert, CheckCircle2, Sparkles, SearchCheck, Download } from "lucide-react";

function requiredJava(software: string, version: string): string {
    if (software === "pumpkin") return "Native Rust Engine (Kein Java nötig · Minimaler RAM-Verbrauch)";
    if (!version) return "Java 21 LTS (Adoptium Temurin · Automatischer Hintergrund-Download)";
    const parts = version.split(".").map(Number);
    const minor = parts[1] || 21;
    const patch = parts[2] || 0;
    if (minor > 20 || (minor === 20 && patch >= 5)) return "Java 21 LTS (Adoptium Temurin · Automatisch für 1.20.5+ zugewiesen)";
    if (minor >= 18) return "Java 17 LTS (Adoptium Temurin · Automatisch für 1.18–1.20.4 zugewiesen)";
    if (minor === 17) return "Java 16 (Adoptium Temurin · Automatisch für 1.17 zugewiesen)";
    return "Java 8 LTS (Adoptium Temurin · Automatisch für <=1.16.5 zugewiesen)";
}

function compareMcVersions(a?: string, b?: string): number {
    if (!a || !b) return 0;
    const pa = a.split(".").map(n => parseInt(n, 10) || 0);
    const pb = b.split(".").map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
    }
    return 0;
}

const LEGACY_VERSIONS = [
    "1.21.4", "1.21.3", "1.21.1", "1.21", "1.20.6",
    "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.19.2", "1.18.2", "1.17.1",
    "1.16.5", "1.15.2", "1.14.4", "1.13.2", "1.12.2", "1.11.2", "1.10.2",
    "1.9.4", "1.8.9", "1.7.10", "1.6.4", "1.5.2", "1.4.7", "1.3.2", "1.2.5", "1.1", "1.0"
];

const INITIAL_CATALOG = LEGACY_VERSIONS.map(v => ({ version: v, paper: true, fabric: true, vanilla: true, pumpkin: v === "1.21.4" }));

export default function SoftwarePanel({ online, active, supported, current, configured, owner, run }: {
    online: boolean;
    active: boolean;
    supported: boolean;
    current?: {
        software: string;
        version: string;
        build?: number;
    };
    configured: boolean;
    owner: boolean;
    run: (kind: string, payload?: any) => Promise<any>;
}) {
    const { t, locale } = useLanguage();
    const [versions, setVersions] = useState<any[]>(INITIAL_CATALOG), [software, setSoftware] = useState(current?.software || "paper"), [version, setVersion] = useState(current?.version || "1.21.4"), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [accepted, setAccepted] = useState(false);
    const [compatChecking, setCompatChecking] = useState(false);
    const [compatResult, setCompatResult] = useState<{ ready: { id: string; name: string }[]; missing: string[] } | null>(null);

    useEffect(() => {
        try {
            const cached = JSON.parse(sessionStorage.getItem("minehost-software-catalog") || "[]");
            if (Array.isArray(cached) && cached.length) setVersions(cached);
        } catch {}
    }, []);

    function mapToHostEngine(sw: string): string {
        if (["paper", "purpur", "spigot", "bukkit", "folia", "velocity", "bungeecord", "waterfall"].includes(sw)) return "paper";
        if (["fabric", "forge", "neoforge", "quilt", "mohist", "arclight"].includes(sw)) return "fabric";
        if (sw === "pumpkin") return "pumpkin";
        return "vanilla";
    }

    async function load() {
        setBusy(true); setMessage("");
        try {
            const result = await run("software_catalog");
            const hostVers: any[] = result.versions || [];
            const seen = new Set(hostVers.map(v => v.version));
            const merged = [...hostVers];
            for (const lv of LEGACY_VERSIONS) {
                if (!seen.has(lv)) {
                    merged.push({ version: lv, paper: true, fabric: true, vanilla: true, pumpkin: false });
                }
            }
            setVersions(merged);
            try { sessionStorage.setItem("minehost-software-catalog", JSON.stringify(merged)); } catch {}
            const baseEngine = mapToHostEngine(software);
            const options = merged.filter((item: any) => item[baseEngine]);
            setVersion(current && options.some((item: any) => item.version === current.version) ? current.version : options.find((item: any) => item.version.startsWith(current?.version?.split(".").slice(0, 2).join(".") + "."))?.version || options[0]?.version || "");
        } catch (error) {
            setMessage(t(error instanceof Error ? error.message : "Katalog konnte nicht geladen werden."));
        } finally {
            setBusy(false);
        }
    }
    useEffect(() => {
        if (online && supported) void load();
    }, [online, supported]);

    async function checkAddonCompatibility(targetVer: string) {
        if (!online || !targetVer) return;
        setCompatChecking(true);
        setCompatResult(null);
        try {
            const isModEngine = mapToHostEngine(software) === "fabric";
            const listRes = await run(isModEngine ? "mods_list" : "plugins_list");
            const addons: any[] = listRes?.plugins || [];
            const modrinthAddons = addons.filter(a => a.projectId);
            if (!modrinthAddons.length) {
                setCompatResult({ ready: addons.map(a => ({ id: "", name: a.name || a.file })), missing: [] });
                return;
            }
            const ready: { id: string; name: string }[] = [];
            const missing: string[] = [];
            const loaders = isModEngine ? ["fabric", "quilt", "forge", "neoforge"] : ["paper", "spigot", "bukkit", "purpur", "folia"];
            for (const addon of modrinthAddons) {
                try {
                    const url = `https://api.modrinth.com/v2/project/${encodeURIComponent(addon.projectId)}/version?game_versions=${encodeURIComponent(JSON.stringify([targetVer]))}&loaders=${encodeURIComponent(JSON.stringify(loaders))}`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const vers: any[] = await res.json();
                        if (vers.length > 0) ready.push({ id: addon.projectId, name: addon.name || addon.file });
                        else missing.push(addon.name || addon.file);
                    }
                } catch {
                    ready.push({ id: addon.projectId, name: addon.name || addon.file });
                }
            }
            setCompatResult({ ready, missing });
        } catch {
            setCompatResult(null);
        } finally {
            setCompatChecking(false);
        }
    }

    const isDowngrade = configured && current?.version && version && compareMcVersions(version, current.version) < 0;
    const baseEngine = mapToHostEngine(software);

    async function install() {
        if (!confirm((locale === "en" ? `Install ${software.toUpperCase()} ${version}? Your current server will be backed up automatically before switching. Continue?` : `${software.toUpperCase()} ${version} installieren? Vor dem Wechsel wird automatisch ein Backup deiner Welt angelegt. Weiter?`)))
            return;
        setBusy(true); setMessage("");
        try {
            const result = await run("software_install", { software: baseEngine, requestedSoftware: software, version, confirmed: true, accepted });
            setMessage(t(result.message));
        } catch (error) {
            setMessage(t(error instanceof Error ? error.message : "Installation fehlgeschlagen."));
        } finally {
            setBusy(false);
        }
    }
    const available = versions.filter(item => item[baseEngine]);
    const alreadyInstalled = configured && current?.software === baseEngine && current.version === version;
    return <section className="panel settings-panel">
        <div className="section-heading"><div><h2>{t("Serversoftware & Minecraft-Version")}</h2><p>{t("Freie Wahl zwischen allen Minecraft-Java-Server-Softwares und Versionen (1.0 bis aktuellste Version) mit automatischem Portable-Java-Manager.")}</p></div></div>
        <div className="notice"><CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }}/>{t("Installiert: ")}{configured && current ? `${current.software.toUpperCase()} ${current.version}${current.build ? ` · Build ${current.build}` : ""}` : online ? t("Noch keine Serversoftware installiert") : t("Wird vom Host geladen")}</div>
        {!online && <p className="notice">{t("Der Server-Host ist gerade nicht verbunden.")}</p>}
        {online && !supported && <p className="notice">{t("Für die Software- und Plugin-Verwaltung bitte die aktuelle MineHost-Version installieren.")}</p>}
        <div className="settings-grid">
            <label>{t("Serversoftware")}<select disabled={busy && !versions.length} value={software} onChange={event => { const engine = event.target.value; setSoftware(engine); const mapped = mapToHostEngine(engine); setVersion(versions.find(item => item[mapped])?.version || ""); setCompatResult(null); }}>
                <optgroup label="Plugin-Server (Bukkit / Spigot / Paper)">
                    <option value="paper">PaperMC · High-Performance Plugins</option>
                    <option value="purpur">Purpur · Erweiterte Gameplay- & Performance-Patches</option>
                    <option value="spigot">Spigot · Klassischer Plugin-Server</option>
                    <option value="bukkit">CraftBukkit · Standard Bukkit-API</option>
                    <option value="folia">Folia · Multithreaded Regionized Server</option>
                </optgroup>
                <optgroup label="Mod-Server (Modrinth & CurseForge)">
                    <option value="fabric">Fabric · Leichtgewichtiger Mod-Loader</option>
                    <option value="forge">Forge · Klassischer Mod-Server</option>
                    <option value="neoforge">NeoForge · Moderner Mod-Loader</option>
                    <option value="quilt">Quilt · Kompatibler Mod-Loader</option>
                </optgroup>
                <optgroup label="Offiziell & Native High-Speed">
                    <option value="vanilla">Vanilla · Offizielle Mojang Releases & Snapshots</option>
                    <option value="pumpkin">Pumpkin · Native Rust Engine + PatchBukkit</option>
                </optgroup>
                <optgroup label="Proxys & Hybride (Mods + Plugins)">
                    <option value="velocity">Velocity · High-Speed Netzwerk-Proxy</option>
                    <option value="bungeecord">BungeeCord · Klassischer Proxy</option>
                    <option value="waterfall">Waterfall · Paper-Proxy</option>
                    <option value="mohist">Mohist · Hybrid (Forge + Bukkit/Spigot)</option>
                    <option value="arclight">Arclight · Hybrid (Fabric/Forge + Bukkit)</option>
                </optgroup>
            </select></label>
            <label>{t("Minecraft-Version (1.0 bis aktuell)")}<select value={version} disabled={!available.length} onChange={event => { setVersion(event.target.value); setCompatResult(null); }}>
                <option value="">{t("Version w\u00E4hlen")}</option>
                {available.map(item => <option key={item.version} value={item.version}>{item.version}</option>)}
            </select></label>
        </div>
        <div className="java-runtime-badge">
            <Cpu size={18}/>
            <div>
                <strong>{locale === "en" ? "Automatic Portable Java Manager (Adoptium Temurin API)" : "Automatischer Portable-Java-Manager (Adoptium Temurin API)"}</strong>
                <span>{requiredJava(baseEngine, version || current?.version || "")}</span>
            </div>
        </div>
        {isDowngrade && <div className="notice error-note">
            <ShieldAlert size={18}/>
            <span>{locale === "en"
                ? `Warning: ${version} is older than ${current?.version}. MineHost will automatically create a full backup before switching so your world stays safe.`
                : `Achtung Versions-Downgrade (${current?.version} → ${version}): MineHost legt vor dem Wechsel automatisch ein Zwangs-Backup deiner Welt an, um Welten-Korruption zu verhindern.`}</span>
        </div>}
        {compatResult && <div className="compat-report">
            <strong style={{ color: "#ecfdf5", fontSize: 13 }}>Modrinth Auto-Kompatibilitäts-Check für Minecraft {version}:</strong>
            {compatResult.ready.length > 0 && <div style={{ color: "#34d399", fontSize: 12 }}>✓ Kompatibel inkl. Pflicht-Abhängigkeiten ({compatResult.ready.length}): {compatResult.ready.map(r => r.name).join(", ")}</div>}
            {compatResult.missing.length > 0 && <div style={{ color: "#fca5a5", fontSize: 12 }}>⚠ Noch kein Release für {version} auf Modrinth ({compatResult.missing.length}): {compatResult.missing.join(", ")}</div>}
            {compatResult.ready.length === 0 && compatResult.missing.length === 0 && <div style={{ color: "#9cb8aa", fontSize: 12 }}>Keine installierten Plugins/Mods gefunden — sauberer Versionswechsel möglich.</div>}
        </div>}
        {!configured && <label className="toggle-row"><span>{t("Ich habe die ")}<a href="https://www.minecraft.net/eula" target="_blank" rel="noopener noreferrer">{t("Minecraft-EULA")}</a>{t(" gelesen und stimme zu.")}</span><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)}/></label>}
        <details><summary>{t("Welche Software soll ich w\u00E4hlen?")}</summary><p>{t("Paper / Purpur / Spigot: Plugins ohne Mods auf den Spielger\u00E4ten. Fabric / Forge / NeoForge / Quilt: Mods; einige m\u00FCssen auch bei deinen Freunden installiert sein. Vanilla: normales Minecraft. Pumpkin: eigener Server mit nativen Plugins aus dem Pumpkin Market. Vor jedem Wechsel wird dein bisheriger Server automatisch gesichert.")}</p></details>
        <div className="toolbar">
            {alreadyInstalled ? <span role="status">{t("Diese Version ist bereits installiert.")}</span> : <button className="btn btn-blue" disabled={!online || active || !owner || !supported || busy || !version || (!configured && !accepted)} onClick={install}><Download size={15}/>{busy ? t("Bitte warten …") : t("Software installieren")}</button>}
            {version && <button type="button" className="btn btn-outline" disabled={!online || compatChecking || !supported} onClick={() => void checkAddonCompatibility(version)}><SearchCheck size={15}/>{compatChecking ? "Prüfe Modrinth …" : "Auto-Kompatibilitäts-Check (Modrinth)"}</button>}
            <button className="btn btn-outline" disabled={!online || busy || !supported} onClick={load}>{t("Versionen aktualisieren")}</button>
        </div>
        {active && <p className="notice">{t("Der laufende Server bleibt unver\u00E4ndert. Zum Wechsel zuerst stoppen.")}</p>}
        <p role="status">{t(message)}</p>
    </section>;
}
