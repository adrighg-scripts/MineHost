"use client";
import { useLanguage } from "./language";
import { useEffect, useRef, useState } from "react";
import { FolderOpen, FileText, ArrowLeft, Upload, Download, Trash2, Plus, Save, RefreshCw, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";

type Entry = {
    name: string;
    directory: boolean;
    size: number;
    modified: number;
};
type UploadItem = {
    file: File;
    path: string;
};

function validateConfigContent(filePath: string, content: string): { valid: boolean; label: string } | null {
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".json")) {
        try {
            JSON.parse(content);
            return { valid: true, label: "JSON gültig" };
        } catch (err) {
            return { valid: false, label: `JSON-Syntaxfehler: ${err instanceof Error ? err.message : "Ungültig"}` };
        }
    }
    if (lower.endsWith(".properties")) {
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
            if (!trimmed.includes("=") && !trimmed.includes(":")) {
                return { valid: false, label: `Zeile ${i + 1}: Fehlendes '=' in server.properties` };
            }
        }
        return { valid: true, label: "Properties gültig" };
    }
    if (lower.endsWith(".yml") || lower.endsWith(".yaml")) {
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            if (/^\t+/.test(lines[i])) {
                return { valid: false, label: `Zeile ${i + 1}: YAML erlaubt keine Tabulatoren (bitte Leerzeichen nutzen)` };
            }
        }
        return { valid: true, label: "YAML-Struktur gültig" };
    }
    return null;
}

export async function collectDrop(data: DataTransfer) {
    const files: UploadItem[] = [], directories: string[] = [];
    async function walk(entry: any, parent = "") {
        const path = parent + entry.name;
        if (entry.isFile) {
            const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject));
            files.push({ file, path });
        }
        else if (entry.isDirectory) {
            directories.push(path);
            const reader = entry.createReader();
            for (;;) {
                const batch: any[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
                if (!batch.length)
                    break;
                for (const child of batch)
                    await walk(child, path + "/");
            }
        }
        if (files.length + directories.length > 20000)
            throw new Error("Bitte weniger Dateien auf einmal auswählen.");
    }
    const entries = Array.from(data.items).filter(item => item.kind === "file").map(item => (item as any).webkitGetAsEntry?.()).filter(Boolean);
    if (entries.length)
        for (const entry of entries)
            await walk(entry);
    else
        for (const file of Array.from(data.files))
            files.push({ file, path: file.name });
    return { files, directories };
}

export default function FilesPanel({ serverId, online, active, canWrite, index, run, notice, download, folder = "", visible = true, queueSupported = false, moveSupported = false }: {
    folder?: string;
    visible?: boolean;
    queueSupported?: boolean;
    moveSupported?: boolean;
    serverId: string;
    online: boolean;
    active: boolean;
    canWrite: boolean;
    index: any;
    run: (kind: string, payload?: any) => Promise<any>;
    notice: (message: string) => void;
    download: (kind: string, path: string) => void;
}) {
    const { t, locale } = useLanguage();
    const [path, setPath] = useState(""), [listing, setListing] = useState<Entry[]>([]), [editor, setEditor] = useState<{
        path: string;
        content: string;
    } | null>(null), [loading, setLoading] = useState(false), [dragging, setDragging] = useState(false), [uploading, setUploading] = useState(false), [progress, setProgress] = useState("");
    const cache = useRef(new Map<string, Entry[]>()), generation = useRef(0), fileInput = useRef<HTMLInputElement>(null), folderInput = useRef<HTMLInputElement>(null);
    const [queued, setQueued] = useState<any[]>([]);
    const [query, setQuery] = useState("");
    const latestRun = useRef(run); latestRun.current = run;
    useEffect(() => { if (!online || !visible || !queueSupported) return; let ended = false, timer: ReturnType<typeof setTimeout>; async function refresh() { try { const value = await latestRun.current("files_pending"); if (!ended) setQueued(value.entries || []); } catch {} if (!ended) timer = setTimeout(refresh, 5000); } void refresh(); return () => { ended = true; clearTimeout(timer); }; }, [online, visible, queueSupported]);
    const changedAt = useRef(0);
    const currentPath = useRef(path);
    currentPath.current = path;
    const endpoint = (suffix: string) => suffix + (suffix.includes("?") ? "&" : "?") + "server=" + encodeURIComponent(serverId);
    function warm(value: any) {
        if (!value?.folders || value.updated < changedAt.current)
            return;
        for (const [folder, rows] of Object.entries(value.folders))
            if (Array.isArray(rows))
                cache.current.set(folder, (rows as any[]).map(row => ({ name: row[0], directory: row[1], size: row[2], modified: row[3] })));
    }
    useEffect(() => {
        warm(index);
        const rows = cache.current.get(currentPath.current);
        if (rows)
            setListing(rows);
    }, [index]);
    async function load(folder: string, force = false) {
        const turn = ++generation.current;
        setPath(folder);
        setEditor(null);
        const cached = cache.current.get(folder);
        if (cached && !force) setListing(cached);
        setListing(cached || []);
        setLoading(true);
        try {
            const refresh = Date.now();
            let offset: number | null = 0;
            const entries: Entry[] = [];
            do {
                const page = await run("files_list", { path: folder, refresh, offset });
                if (turn !== generation.current) return;
                entries.push(...page.entries);
                offset = page.nextOffset ?? null;
            } while (offset !== null);
            const result = { entries };
            cache.current.set(folder, result.entries);
            if (turn === generation.current)
                setListing(result.entries);
        }
        catch (e) {
            notice(t(t(e instanceof Error ? e.message : "Ordner konnte nicht geladen werden.")));
        }
        finally {
            if (turn === generation.current)
                setLoading(false);
        }
    }
    const search = query.trim().toLocaleLowerCase(locale);
    const results = new Map<string, Entry>();
    if (search) {
        for (const [directory, entries] of cache.current) {
            for (const file of entries) {
                const target = join(directory, file.name);
                if (file.name.toLocaleLowerCase(locale).includes(search)) results.set(target, file);
                if (results.size === 200) break;
            }
            if (results.size === 200) break;
        }
        for (const file of listing) {
            if (results.size >= 200) break;
            if (file.name.toLocaleLowerCase(locale).includes(search)) results.set(join(path, file.name), file);
        }
    }
    const visibleFiles = search ? Array.from(results) : listing.map(file => [join(path, file.name), file] as const);
    useEffect(() => {
        warm(index);
        const current = currentPath.current;
        if (online) void load(current);
    }, [online]);
    useEffect(() => {
        if (visible && online && !listing.length && !loading) {
            void load(currentPath.current);
        }
    }, [visible, online]);
    useEffect(() => {
        if (folder !== currentPath.current)
            void load(folder);
    }, [folder]);
    function join(base: string, name: string) { return base ? base + "/" + name : name; }
    async function upload(items: UploadItem[], directories: string[] = []) {
        if (active && !queueSupported || !canWrite || !online) {
            notice(t(t("Zum Hochladen den Server zuerst stoppen.")));
            return;
        }
        if (items.some(item => item.file.size > 64 * 1024 * 1024)) {
            notice(t(t("Maximal 64 MiB pro Datei.")));
            return;
        }
        let overwrite = false;
        const conflicts = items.filter(item => { const target = join(path, item.path), parts = target.split('/'), name = parts.pop(); return cache.current.get(parts.join('/'))?.some(row => row.name === name); });
        if (conflicts.length) {
            overwrite = confirm(t(t(`${conflicts.length} vorhandene Dateien ersetzen?`)));
            if (!overwrite)
                return;
        }
        setUploading(true);
        const base = path;
        let done = 0, queuedUpload = false, appliedUpload = false;
        try {
            for (let start = 0; start < items.length || start === 0 && directories.length; start += 24) {
                const group = items.slice(start, start + 24);
                const tickets: any[] = [];
                for (let offset = 0; offset < group.length; offset += 4) {
                    await Promise.all(group.slice(offset, offset + 4).map(async (item) => {
                        const response = await fetch(endpoint('/api/transfers?name=' + encodeURIComponent(item.file.name)), { method: 'POST', body: item.file });
                        const ticket: any = await response.json();
                        if (!response.ok)
                            throw new Error(ticket.error);
                        tickets.push({ path: join(base, item.path), transferId: ticket.id });
                        done++;
                        setProgress(`${done} / ${items.length} ${t("Dateien übertragen")}`);
                    }));
                }
                const result = await run("files_uploads", { files: tickets, directories: start === 0 ? directories.map(folder => join(base, folder)) : [], overwrite });
                if (result.queued) queuedUpload = true; else appliedUpload = true;
            }
            if (!queuedUpload) notice(t("Upload abgeschlossen."));
            if (queuedUpload && queueSupported) setQueued((await run("files_pending")).entries || []);
            if (appliedUpload) { changedAt.current = Date.now(); cache.current.clear(); if (currentPath.current === base) await load(base, true); }
        }
        catch (e) {
            notice(t(t(e instanceof Error ? e.message : "Upload fehlgeschlagen.")));
        }
        finally {
            setUploading(false);
            setProgress("");
        }
    }
    async function open(file: Entry, target: string) {
        if (file.directory) {
            setQuery("");
            void load(target);
            return;
        }
        setLoading(true);
        try {
            const result = await run("files_read", { path: target });
            setEditor({ path: target, content: result.content });
        }
        catch (e) {
            notice(t(t(e instanceof Error ? e.message : "Datei konnte nicht geöffnet werden.")));
        }
        finally {
            setLoading(false);
        }
    }
    const validation = editor ? validateConfigContent(editor.path, editor.content) : null;

    return <section className={`panel file-panel ${dragging ? "drop-active" : ""}`} onDragOver={event => { if (Array.from(event.dataTransfer.types).includes("Files")) {
        event.preventDefault();
        setDragging(true);
    } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node))
        setDragging(false); }} onDrop={async (event) => { event.preventDefault(); setDragging(false); try {
        const dropped = await collectDrop(event.dataTransfer);
        void upload(dropped.files, dropped.directories);
    }
    catch (error) {
        notice(t(error instanceof Error ? error.message : "Dateien konnten nicht gelesen werden."));
    } }}>
      <div className="section-heading"><div><h2>{t("Serverdateien")} & Config-Editor</h2><p>{t("Dateien und Ordner hierher ziehen oder ausw\u00E4hlen.")}</p></div>
       <div className="toolbar">
        <button className="btn btn-outline" disabled={!online || uploading} onClick={() => load(path, true)}><RefreshCw size={15}/>{t("Aktualisieren")}</button>
        <button className="btn btn-blue" disabled={!canWrite || active && !queueSupported || !online || uploading} onClick={() => fileInput.current?.click()}><Upload size={15}/>{t("Dateien")}</button>
        <button className="btn btn-outline" disabled={!canWrite || active && !queueSupported || !online || uploading} onClick={() => folderInput.current?.click()}><FolderOpen size={15}/>{t("Ordner hochladen")}</button>
        <input hidden multiple type="file" ref={fileInput} onChange={event => { const items = Array.from(event.target.files || []).map(file => ({ file, path: file.name })); if (items.length)
        void upload(items); event.target.value = ""; }}/>
        <input hidden multiple type="file" {...({ webkitdirectory: "" } as any)} ref={folderInput} onChange={event => { const items = Array.from(event.target.files || []).map(file => ({ file, path: file.webkitRelativePath || file.name })); if (items.length)
        void upload(items); event.target.value = ""; }}/>
       </div>
      </div>
      {dragging && <div className="drop-hint">{t("Dateien und Ordner hier ablegen")}</div>}
      {uploading && progress && <div className="notice" role="status">{progress}</div>}
      {queued.length > 0 && <div className="notice pending-files"><strong>{queued.length} {t("vorgemerkte Änderungen")}</strong>{queued.map(change => <div key={change.id}><span>{change.kind === "files_delete" ? t("Löschen") : t("Upload")}: {change.paths.join(", ")}</span>{change.error && <p className="log-error">{t(change.error)}</p>}{canWrite && <button className="btn btn-outline compact" onClick={async () => { try { await run("files_pending_cancel", { id: change.id }); setQueued(current => current.filter(row => row.id !== change.id)); } catch (error) { notice(t(error instanceof Error ? error.message : "Aktion fehlgeschlagen.")); } }}>{t("Vormerkung verwerfen")}</button>}</div>)}</div>}
      {editor ? <>
       <div className="file-path">
        <button className="tiny" aria-label={t("Zur Dateiliste")} onClick={() => setEditor(null)}><ArrowLeft size={18}/></button>
        <code>{editor.path}</code>
        {validation && <span className={`config-validator ${validation.valid ? "valid" : "invalid"}`}>
            {validation.valid ? <CheckCircle2 size={13}/> : <AlertTriangle size={13}/>}
            {validation.label}
        </span>}
        <button className="btn btn-blue" disabled={!canWrite || active || !online || loading || (validation != null && !validation.valid)} onClick={async () => { try {
            await run("files_write", editor);
            notice(t("Gespeichert."));
            setEditor(null);
        }
        catch (error) {
            notice(t(error instanceof Error ? error.message : "Speichern fehlgeschlagen."));
        } }}><Save size={15}/>{t("Speichern")}</button>
       </div>
       <textarea className="file-editor" value={editor.content} spellCheck={false} onChange={event => setEditor({ ...editor, content: event.target.value })}/>
      </> : <>
       <div className="quick-files-bar">
        <span style={{ fontSize: 11, color: "#88a898", display: "inline-flex", alignItems: "center", gap: 5 }}><ShieldCheck size={13} color="#24dc8e"/>Sandbox: <code>server/</code></span>
        {["server.properties", "whitelist.json", "ops.json", "banned-players.json", "eula.txt"].map(cfg => (
            <button key={cfg} type="button" className="chip-btn" disabled={!online || loading} onClick={() => void open({ name: cfg, directory: false, size: 0, modified: Date.now() }, cfg)}>{cfg}</button>
        ))}
       </div>
       <div className="file-path"><button className="tiny" aria-label={t("Übergeordneter Ordner")} disabled={!path} onClick={() => load(path.split("/").slice(0, -1).join("/"))}><ArrowLeft size={18}/></button><code>{t("server/")}{path}</code>
        <button className="btn btn-outline compact" disabled={!canWrite || active || !online || uploading} onClick={async () => { const name = prompt(t("Ordnername")); if (name)
            try {
                await run("files_mkdir", { path: join(path, name) });
                await load(path, true);
            }
            catch (error) {
                notice(t(error instanceof Error ? error.message : "Ordner konnte nicht erstellt werden."));
            } }}><Plus size={15}/>{t("Ordner")}</button>
        {loading && <span className="loading-inline">{t("Wird geladen \u2026")}</span>}
       </div>
       <input type="search" aria-label={t("Dateien suchen")} placeholder={t("Dateien suchen")} value={query} onChange={event => setQuery(event.target.value)}/>
       <div className="table-wrap"><table><thead><tr><th>{t("Name")}</th><th>{t("Gr\u00F6\u00DFe")}</th><th>{t("Ge\u00E4ndert")}</th><th>{t("Aktionen")}</th></tr></thead><tbody>
        {visibleFiles.map(([target, file]) => <tr key={target}><td><button className="file-name" onClick={() => open(file, target)}>{file.directory ? <FolderOpen size={17}/> : <FileText size={17}/>} {search ? target : file.name}</button></td>
         <td>{file.directory ? t("Ordner") : `${Math.ceil(file.size / 1024)} KiB`}</td><td>{new Date(file.modified).toLocaleString(locale)}</td>
         <td className="row-actions">{canWrite && moveSupported && <button className="btn btn-outline compact" disabled={!online || active} onClick={async () => {
            const source = target;
            const destination = prompt(locale === "en" ? "Destination path from the server root, including the file name" : "Zielpfad ab dem Serverordner, inklusive Dateiname", source)?.trim();
            if (!destination || destination === source) return;
            try {
                const result = await run("files_move", { path: source, destination });
                cache.current.clear();
                await load(path, true);
                notice(t(result.message));
            } catch (error) {
                notice(t(error instanceof Error ? error.message : "Verschieben fehlgeschlagen."));
            }
         }}>{t("Verschieben")}</button>}{!file.directory && file.name.toLowerCase().endsWith(".zip") && canWrite && <button className="btn btn-outline compact" disabled={!online || active} onClick={async () => { try { await run("files_unzip", { path: target, destination: path }); cache.current.clear(); await load(path, true); notice(t("ZIP-Archiv entpackt.")); } catch (e) { notice(t(e instanceof Error ? e.message : "Entpacken fehlgeschlagen.")); } }}>{t("Entpacken")}</button>}{!file.directory && <button className="tiny" aria-label={t("Herunterladen")} disabled={!online} onClick={() => download("files_download", target)}><Download size={16}/></button>}
          <button className="tiny danger" aria-label={t("Löschen")} disabled={!canWrite || active && !queueSupported || !online || uploading} onClick={async () => { if (confirm(t(file.name + " löschen?")))
                try {
                    const result = await run("files_delete", { path: target });
                    if (result.queued && queueSupported) setQueued((await run("files_pending")).entries || []); else { changedAt.current = Date.now(); cache.current.clear(); await load(path, true); }
                }
                catch (error) {
                    notice(t(error instanceof Error ? error.message : "Löschen fehlgeschlagen."));
                } }}><Trash2 size={16}/></button>
         </td></tr>)}
       </tbody></table>{!visibleFiles.length && !loading && <div className="empty-state">{t(search ? "Keine Dateien gefunden." : "Dieser Ordner ist leer.")}</div>}</div>
      </>}
    </section>;
}
