"use client";
import { useLanguage } from "./language";
import ExtensionIcon from "./extension-icon";
import { useState } from "react";
export default function Catalog({ serverId, mods, canWrite, run, installed }: {
    serverId: string;
    mods: boolean;
    canWrite: boolean;
    run: (kind: string, payload?: any) => Promise<any>;
    installed: () => void;
}) {
    const { t, locale } = useLanguage();
    const [source, setSource] = useState("modrinth"), [query, setQuery] = useState(""), [items, setItems] = useState<any[]>([]), [busy, setBusy] = useState(""), [message, setMessage] = useState("");
    const endpoint = `/api/catalog?server=${encodeURIComponent(serverId)}&type=${mods ? "mods" : "plugins"}&source=${source}`;
    async function search() { setBusy("search"); setMessage(t("")); try {
        const r = await fetch(endpoint + "&q=" + encodeURIComponent(query));
        const data: any = await r.json();
        if (!r.ok)
            throw new Error(data.error);
        setItems(data.items);
        if (!data.items.length)
            setMessage(t("Keine passenden Erweiterungen für deine Serverversion gefunden."));
    }
    catch (e) {
        setMessage(t(e instanceof Error ? e.message : "Suche fehlgeschlagen."));
        setItems([]);
    }
    finally {
        setBusy("");
    } }
    async function download(item: any) { setBusy(item.id); try {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
        const plan: any = await response.json();
        if (!response.ok)
            throw new Error(plan.error);
        const result = await run(mods ? "catalog_mods_install" : "catalog_plugins_install", plan);
        setMessage(t(result.message));
        installed();
    }
    catch (e) {
        setMessage(t(e instanceof Error ? e.message : "Download fehlgeschlagen."));
    }
    finally {
        setBusy("");
    } }
    return <div className="catalog"><h3>{mods ? t("Mods") : t("Plugins")}{t(" suchen")}</h3><form className="inline-form" onSubmit={e => { e.preventDefault(); void search(); }}><select aria-label={t("Katalog")} value={source} onChange={e => { setSource(e.target.value); setItems([]); setMessage(t("")); }}><option value="modrinth">{t("Modrinth")}</option><option value="curseforge">{t("CurseForge")}</option></select><input value={query} onChange={e => setQuery(e.target.value)} placeholder={mods ? t("Mod suchen …") : t("Plugin suchen …")}/><button className="btn btn-outline" disabled={!!busy}>{t("Suchen")}</button></form><p className="muted">{t("Passend zu deinem Server. Ben\u00F6tigte Abh\u00E4ngigkeiten werden mitgeladen. Danach den Server neu starten.")}</p>{items.map(item => <div className="catalog-entry" key={item.id}><ExtensionIcon icon={item.icon} name={item.name}/><div className="catalog-copy"><a href={item.url} target="_blank" rel="noopener noreferrer"><strong>{item.name}</strong></a><p>{item.description}</p></div><button className="btn btn-blue" disabled={!canWrite || !!busy} onClick={() => download(item)}>{busy === item.id ? t("Lädt …") : t("Download")}</button></div>)}<p role="status">{t(message)}</p></div>;
}
