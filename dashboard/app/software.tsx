"use client";
import { useLanguage } from "./language";
import { useEffect, useState } from "react";
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
    const [versions, setVersions] = useState<any[]>([]), [software, setSoftware] = useState("paper"), [version, setVersion] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [accepted, setAccepted] = useState(false);
    useEffect(() => {
        try {
            const cached = JSON.parse(sessionStorage.getItem("minehost-software-catalog") || "[]");
            if (Array.isArray(cached)) setVersions(cached);
        } catch {}
    }, []);

    async function load() { setBusy(true); setMessage(""); try {
        const result = await run("software_catalog");
        setVersions(result.versions);
        try { sessionStorage.setItem("minehost-software-catalog", JSON.stringify(result.versions)); } catch {}
        const options = result.versions.filter((item: any) => item[software]);
        setVersion(current && options.some((item: any) => item.version === current.version) ? current.version : options.find((item: any) => item.version.startsWith(current?.version?.split(".").slice(0, 2).join(".") + "."))?.version || options[0]?.version || "");
    }
    catch (error) {
        setMessage(t(error instanceof Error ? error.message : "Katalog konnte nicht geladen werden."));
    }
    finally {
        setBusy(false);
    } }
    useEffect(() => { if (online && supported)
        void load(); }, [online, supported]);
    async function install() { if (!confirm((locale==="en"?`Install ${software} ${version}? Your current server will be backed up. Changing versions can modify the world; older Minecraft versions may damage newer worlds. Continue?`:`${software} ${version} installieren? Vor einem Wechsel wird der vorhandene Server gesichert. Versionswechsel können die Welt verändern; ältere Minecraft-Versionen können neuere Welten beschädigen. Weiter?`)))
        return; setBusy(true); setMessage(""); try {
        const result = await run("software_install", { software, version, confirmed: true, accepted });
        setMessage(t(result.message));
    }
    catch (error) {
        setMessage(t(error instanceof Error ? error.message : "Installation fehlgeschlagen."));
    }
    finally {
        setBusy(false);
    } }
    const available = versions.filter(item => item[software]);
    const alreadyInstalled = configured && current?.software === software && current.version === version;
    return <section className="panel settings-panel"><div className="section-heading"><div><h2>{t("Serversoftware & Minecraft-Version")}</h2><p>{t("W\u00E4hle Paper f\u00FCr Plugins, Fabric f\u00FCr Mods oder Vanilla ohne Erweiterungen. Pumpkin ist eine alternative Serversoftware.")}</p></div></div><div className="notice">{t("Installiert: ")}{configured && current ? `${current.software} ${current.version}${current.build ? ` · Build ${current.build}` : ""}` : online ? t("Noch keine Serversoftware installiert") : t("Wird vom Handy geladen")}</div>{!online && <p className="notice">{t("Das Handy ist nicht verbunden.")}</p>}{online && !supported && <p className="notice">{t("F\u00FCr die Software- und Plugin-Verwaltung die aktuelle MineHost-APK installieren.")}</p>}<div className="settings-grid"><label>{t("Serversoftware")}<select disabled={busy && !versions.length} value={software} onChange={event => { const engine = event.target.value; setSoftware(engine); setVersion(versions.find(item => item[engine])?.version || ""); }}><option value="paper">{t("Paper \u00B7 Plugins")}</option><option value="vanilla">{t("Vanilla")}</option><option value="fabric">{t("Fabric \u00B7 Mods")}</option><option value="pumpkin">{t("Pumpkin")}</option></select></label><label>{t("Minecraft-Version")}<select value={version} disabled={!available.length} onChange={event => setVersion(event.target.value)}><option value="">{t("Version w\u00E4hlen")}</option>{available.map(item => <option key={item.version} value={item.version}>{item.version}</option>)}</select></label></div>{!configured && <label className="toggle-row"><span>{t("Ich habe die ")}<a href="https://www.minecraft.net/eula" target="_blank" rel="noopener noreferrer">{t("Minecraft-EULA")}</a>{t(" gelesen und stimme zu.")}</span><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)}/></label>}<details><summary>{t("Welche Software soll ich w\u00E4hlen?")}</summary><p>{t("Paper: Plugins ohne Mods auf den Spielger\u00E4ten. Fabric: Mods; einige m\u00FCssen auch bei deinen Freunden installiert sein. Vanilla: normales Minecraft. Pumpkin: eigener Server mit nativen Plugins aus dem Pumpkin Market. PatchBukkit kann kompatible Paper-Plugins experimentell laden. Pumpkin nutzt eine eigene Welt. Vor einem Wechsel wird dein bisheriger Server gesichert. \u00C4ltere Versionen k\u00F6nnen neuere Welten nicht zuverl\u00E4ssig laden.")}</p></details><div className="toolbar">{alreadyInstalled ? <span role="status">{t("Diese Version ist bereits installiert.")}</span> : <button className="btn btn-blue" disabled={!online || active || !owner || !supported || busy || !version || (!configured && !accepted)} onClick={install}>{busy ? t("Bitte warten …") : t("Software installieren")}</button>}<button className="btn btn-outline" disabled={!online || busy || !supported} onClick={load}>{t("Versionen aktualisieren")}</button></div>{active && <p className="notice">{t("Der laufende Server bleibt unver\u00E4ndert. Zum Wechsel zuerst stoppen.")}</p>}<p role="status">{t(message)}</p></section>;
}
