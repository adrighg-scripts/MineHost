"use client";
import { useLanguage } from "./language";
import ExtensionIcon from "./extension-icon";
import Catalog from "./catalog";
import { useEffect, useRef, useState } from "react";
export default function PluginsPanel({ online, supported, canWrite, software, serverId, run, openFiles, openPatchBukkitFolder, mods = false }: {
    mods?: boolean;
    online: boolean;
    supported: boolean;
    canWrite: boolean;
    software?: string;
    serverId: string;
    run: (kind: string, payload?: any) => Promise<any>;
    openFiles: () => void;
    openPatchBukkitFolder?: () => void;
}) {
    const { t, locale } = useLanguage();
    const prefix = mods ? "mods" : "plugins";
    const title = mods ? "Mods" : software === "pumpkin" ? "PatchBukkit" : "Plugins";
    const compatible=mods?software==="fabric":software==="paper"||software==="pumpkin";
    const [plugins, setPlugins] = useState<any[]>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
    const input = useRef<HTMLInputElement>(null);
    async function load() { setBusy(true); try {
        const result = await run(prefix + "_list");
        setPlugins(result.plugins);
            const missing=result.plugins.filter((item:any)=>!item.icon&&item.projectId&&item.source==="modrinth");if(missing.length){const response=await fetch(`/api/catalog/icons?server=${encodeURIComponent(serverId)}&type=${mods?"mods":"plugins"}&ids=${missing.map((item:any)=>item.projectId).join(",")}`);if(response.ok){const data:any=await response.json();setPlugins(result.plugins.map((item:any)=>({...item,icon:item.icon||data.icons[item.projectId]})));}}
    }
    catch (error) {
        setMessage(t(error instanceof Error ? error.message : "Plugins konnten nicht geladen werden."));
    }
    finally {
        setBusy(false);
    } }
    useEffect(() => { if (online && supported)
        void load(); }, [online, supported, software]);
    async function upload(file: File) { if (!file.name.endsWith(".jar")) {
        setMessage(t("Bitte eine passende .jar-Datei auswählen."));
        return;
    } const replace = plugins.some(plugin => plugin.file === file.name || plugin.file === file.name + ".disabled"); if (replace && !confirm(t(file.name + " aktualisieren? Die bisherige JAR wird gesichert.")))
        return; setBusy(true); try {
        const response = await fetch(`/api/transfers?permission=${prefix}.write&server=${encodeURIComponent(serverId)}&name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
        const ticket: any = await response.json();
        if (!response.ok)
            throw new Error(ticket.error);
        const result = await run(prefix + "_upload", { name: file.name, transferId: ticket.id, replace });
        setMessage(t(result.message));
        await load();
    }
    catch (error) {
        setMessage(t(error instanceof Error ? error.message : "Upload fehlgeschlagen."));
    }
    finally {
        setBusy(false);
    } }
    async function action(kind: string, plugin: any) { if (kind.endsWith("_remove") && !confirm(t(plugin.file + " entfernen? Die bisherige JAR wird gesichert; Konfigurationen bleiben erhalten.")))
        return; setBusy(true); try {
        const result = await run(kind, { name: plugin.file, enabled: !plugin.enabled });
        setMessage(t(result.message));
        await load();
    }
    catch (error) {
        setMessage(t(error instanceof Error ? error.message : "Aktion fehlgeschlagen."));
    }
    finally {
        setBusy(false);
    } }
    return <section className="panel"><div className="section-heading"><div><h2>{t(title)}</h2><p>{mods ? t("Fabric-Mods auf deinem Server verwalten.") : software==="pumpkin"?t("Bukkit-Plugins über PatchBukkit verwalten."):t("Paper-Plugins auf deinem Server verwalten.")}</p></div><div className="toolbar"><button className="btn btn-outline" disabled={!online || !supported || busy} onClick={load}>{t("Aktualisieren")}</button><button className="btn btn-blue" disabled={!online || !supported || !canWrite || busy} onClick={() => input.current?.click()}>{t("JAR hochladen")}</button><input ref={input} type="file" accept=".jar" onChange={event => { const file = event.target.files?.[0]; if (file)
        void upload(file); event.target.value = ""; }}/></div></div>{!supported && <p className="notice">{t("Bitte die aktuelle MineHost-Version auf dem Host installieren.")}</p>}{!compatible && <p className="notice">{t("Unter \u201EServersoftware\u201C zuerst die passende Serversoftware installieren.")}</p>}{software === "pumpkin" && <p className="notice">{locale === "en" ? "MineHost installs the PatchBukkit library at" : "MineHost installiert die PatchBukkit-Datei unter"} <code>pumpkin/plugins/libpatchbukkit.so</code>. {openPatchBukkitFolder && <button type="button" className="btn btn-outline compact" onClick={openPatchBukkitFolder}>{locale === "en" ? "Open Pumpkin plugin folder" : "Pumpkin-Pluginordner öffnen"}</button>}</p>}{compatible && <Catalog serverId={serverId} mods={mods} canWrite={canWrite} run={run} installed={() => void load()}/>}<details><summary>{t("Eigene Dateien und Einstellungen")}</summary><p>{t("Nur vertrauensw\u00FCrdige Erweiterungen installieren. \u00C4nderungen werden beim n\u00E4chsten Neustart aktiv.")}</p></details><div className="table-wrap"><table><thead><tr><th>{t("Plugin")}</th><th>{t("Version")}</th><th>{t("Status")}</th><th>{t("Aktionen")}</th></tr></thead><tbody>{plugins.map(plugin => <tr key={plugin.file}><td><div className="extension-label"><ExtensionIcon icon={plugin.icon} name={plugin.name}/><strong>{plugin.name}</strong></div><br /><small>{plugin.file}</small>{plugin.error && <p className="log-error">{t(plugin.error)}</p>}</td><td>{plugin.version || "—"}{plugin.nextVersion && ` → ${plugin.nextVersion}`}</td><td>{plugin.pending ? `${t("Neustart ausstehend:")} ${({ update: t("Update"), install: t("Installation"), enable: t("Aktivieren"), disable: t("Deaktivieren"), remove: t("Entfernen") } as Record<string, string>)[plugin.pending as string] || plugin.pending}` : plugin.enabled ? t("Aktiviert") : t("Deaktiviert")}</td><td><button className="btn btn-outline compact" disabled={!canWrite || busy} onClick={() => action(prefix + "_toggle", plugin)}>{plugin.enabled ? t("Deaktivieren") : t("Aktivieren")}</button> <button className="btn btn-outline compact danger" disabled={!canWrite || busy} onClick={() => action(prefix + "_remove", plugin)}>{t("Entfernen")}</button></td></tr>)}</tbody></table>{!plugins.length && <div className="empty-state">{busy ? t("Plugins werden geladen …") : t("Noch keine Plugin-JARs gefunden.")}</div>}</div><button className="btn btn-outline" onClick={openFiles}>{t("Konfigurationen \u00F6ffnen")}</button><p role="status">{t(message)}</p></section>;
}
