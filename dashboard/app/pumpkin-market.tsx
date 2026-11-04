"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./language";

type Plugin = { id: number; name: string; version: string; category: string; free: boolean };

export default function PumpkinMarket({ canInstall, canUpload, serverId, run }: {
    canInstall: boolean;
    canUpload: boolean;
    serverId: string;
    run: (kind: string, payload: unknown) => Promise<any>;
}) {
    const { locale, t } = useLanguage();
    const english = locale === "en";
    const [query, setQuery] = useState("");
    const [items, setItems] = useState<Plugin[]>();
    const [failed, setFailed] = useState(false);
    const [installing, setInstalling] = useState<number>();
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");
    const input = useRef<HTMLInputElement>(null);

    async function upload(file: File) {
        setUploading(true);
        setMessage("");
        try {
            const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
            if (!file.name.toLowerCase().endsWith(".wasm") || file.size < 8 ||
                header[0] !== 0 || header[1] !== 97 || header[2] !== 115 || header[3] !== 109) {
                throw new Error(english ? "Select a valid Pumpkin .wasm plugin." : "Wähle ein gültiges Pumpkin-Plugin im .wasm-Format.");
            }
            const name = file.name.slice(0, -5).slice(0, 145) + ".wasm";
            const query = new URLSearchParams({ server: serverId, name });
            const response = await fetch("/api/transfers?" + query, { method: "POST", body: file });
            const ticket = await response.json() as { id: string; name: string; error?: string };
            if (!response.ok) throw new Error(ticket.error);
            const result = await run("files_uploads", {
                files: [{ path: "pumpkin/plugins/" + ticket.name, transferId: ticket.id }],
            });
            setMessage(result.queued
                ? (english ? "Upload queued." : "Upload vorgemerkt.")
                : (english ? "Plugin uploaded. Start Pumpkin to load it." : "Plugin hochgeladen. Starte Pumpkin, um es zu laden."));
        } catch (error) {
            setMessage(error instanceof Error ? error.message : english ? "Upload failed." : "Upload fehlgeschlagen.");
        } finally {
            setUploading(false);
        }
    }

    useEffect(() => {
        const controller = new AbortController();
        const timeout = setTimeout(async () => {
            try {
                const response = await fetch("/api/pumpkin-market?q=" + encodeURIComponent(query), { signal: controller.signal });
                if (!response.ok) throw new Error("Catalog unavailable");
                setItems(await response.json());
                setFailed(false);
            } catch {
                if (!controller.signal.aborted) setFailed(true);
            }
        }, 220);
        return () => { clearTimeout(timeout); controller.abort(); };
    }, [query]);

    return <section className="panel pumpkin-market">
        <div className="section-heading">
            <div><h2>Pumpkin Market</h2><p>{english ? "Install native Pumpkin plugins here. For Bukkit, Spigot and Paper JARs, use PatchBukkit below." : "Installiere hier native Pumpkin-Plugins. Für Bukkit-, Spigot- und Paper-JARs findest du unten den PatchBukkit-Bereich."}</p></div>
            <div className="toolbar">
                {canUpload && <button type="button" className="btn btn-blue" disabled={uploading || installing !== undefined} onClick={() => input.current?.click()}>{english ? "Upload WASM" : "WASM hochladen"}</button>}
                <input ref={input} hidden type="file" accept=".wasm" onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void upload(file);
                }}/>
                <a className="btn btn-outline" href="https://market.pumpkinmc.org/" target="_blank" rel="noopener noreferrer">{english ? "Open marketplace" : "Marktplatz öffnen"}</a>
            </div>
        </div>
        <label className="host-picker">{english ? "Search by name" : "Nach Namen suchen"}<input value={query} onChange={event => setQuery(event.target.value)}/></label>
        {failed ? <p role="status">{english ? "Catalog unavailable." : "Katalog gerade nicht erreichbar."}</p> :
            !items ? <p role="status">{english ? "Loading catalog…" : "Katalog wird geladen …"}</p> :
            !items.length ? <p role="status">{english ? "No matches." : "Keine Treffer."}</p> :
            <ul className="pumpkin-results">{items.map(item => <li key={item.id}>
                <a href={"https://market.pumpkinmc.org/plugin/" + item.id} target="_blank" rel="noopener noreferrer">{item.name}</a>
                <small>{[item.category, item.version].filter(Boolean).join(" · ")}</small>
                {item.free && <button className="btn btn-outline" disabled={!canInstall || installing !== undefined || uploading}
                    onClick={async () => {
                        setInstalling(item.id);
                        setMessage("");
                        try { setMessage((await run("pumpkin_market_install", { id: item.id })).message); }
                        catch (error) { setMessage(error instanceof Error ? error.message : "Installation failed."); }
                        finally { setInstalling(undefined); }
                    }}>{installing === item.id ? "…" : english ? "Install" : "Installieren"}</button>}
                {!item.free && <a className="btn btn-outline" href={"https://market.pumpkinmc.org/plugin/" + item.id} target="_blank" rel="noopener noreferrer">{english ? "Get on Pumpkin Market" : "Auf Pumpkin Market beziehen"}</a>}
            </li>)}</ul>}
        {message && <p role="status">{t(message)}</p>}
    </section>;
}
