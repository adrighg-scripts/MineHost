"use client";
import { useLanguage } from "./language";
import { useEffect, useState } from "react";
export default function BackupsPanel({ online, active, owner, canCreate, canRestore, run, download, idlePolicy=false }: {
    idlePolicy?:boolean;
    online: boolean;
    active: boolean;
    owner: boolean;
    canCreate: boolean;
    canRestore: boolean;
    run: (kind: string, payload?: any) => Promise<any>;
    download: (kind: string, path: string) => void;
}) {
    const { t, locale } = useLanguage();
    const [backups, setBackups] = useState<any[]>([]), [plan, setPlan] = useState<any>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [inspect, setInspect] = useState<any>(null);
    async function load() {
        try {
            const [list, schedule] = await Promise.all([run("backups_list"), run("backup_schedule_get")]);
            setBackups(list.entries);
            setPlan(schedule);
        }
        catch (e) {
            setMessage(t(t(e instanceof Error ? e.message : "Sicherungen konnten nicht geladen werden.")));
        }
    }
    useEffect(() => {
        if (online)
            void load();
    }, [online]);
    function update(key: string, value: any) { setPlan((current: any) => ({ ...current, [key]: value })); }
    async function act(kind: string, payload: any = {}) {
        setBusy(true);
        try {
            const result = await run(kind, payload);
            setMessage(t(t(result.message || "Abgeschlossen.")));
            await load();
        }
        catch (e) {
            setMessage(t(t(e instanceof Error ? e.message : "Aktion fehlgeschlagen.")));
        }
        finally {
            setBusy(false);
        }
    }
    return <section className="panel">
      <div className="section-heading"><div><h2>{t("Backups")}</h2><p>{t("Sichere den ganzen Server oder ausgew\u00E4hlte Dateien und Ordner.")}</p></div><button className="btn btn-outline" disabled={!online || busy} onClick={load}>{t("Aktualisieren")}</button></div>
      {plan && <>
       <div className="settings-grid"><label>{t("Umfang")}<select value={plan.mode || "full"} onChange={event => update("mode", event.target.value)}><option value="full">{t("Vollst\u00E4ndiger Server")}</option><option value="custom">{t("Dateien und Ordner ausw\u00E4hlen")}</option></select></label>
        <label>{t("Komprimierung")}<select value={plan.compression ?? 3} onChange={event => update("compression", Number(event.target.value))}><option value={0}>{t("Keine \u00B7 schnell")}</option><option value={3}>{t("Normal")}</option><option value={9}>{t("Stark \u00B7 langsamer")}</option></select></label>
        {plan.mode === "custom" && <label>{t("Einbeziehen \u00B7 ein Pfad pro Zeile")}<textarea value={(plan.include || []).join("\n")} placeholder={"world\nplugins\nserver.properties"} onChange={event => update("include", event.target.value.split("\n").filter(Boolean))}/></label>}
        <label>{t("Ausschlie\u00DFen \u00B7 optional")}<textarea value={(plan.exclude || []).join("\n")} placeholder={"logs\n*.tmp"} onChange={event => update("exclude", event.target.value.split("\n").filter(Boolean))}/></label>
       </div>
       <button className="btn btn-blue" disabled={!online || active || !canCreate || busy} onClick={() => act("backup_create", plan)}>{t("Jetzt sichern")}</button>
       {active && <p className="muted">{t("F\u00FCr eine manuelle Sicherung den Server zuerst stoppen.")}</p>}
       <h3>{t("Automatische Sicherungen")}</h3><label className="toggle-row"><span>{t("Automatische Backups aktivieren")}</span><input type="checkbox" disabled={!owner} checked={!!plan.enabled} onChange={event => update("enabled", event.target.checked)}/></label>
       <div className="settings-grid"><label>{t("Zeitplan")}<select disabled={!owner} value={plan.frequency || "interval"} onChange={event => update("frequency", event.target.value)}><option value="interval">{t("In festen Abst\u00E4nden")}</option><option value="daily">{t("An gew\u00E4hlten Wochentagen")}</option></select></label>
        {plan.frequency === "daily" ? <><label>{t("Uhrzeit")}<input type="time" disabled={!owner} value={plan.time || "03:00"} onChange={event => update("time", event.target.value)}/></label>
         <label>{t("Zeitzone")}<input disabled={!owner} value={plan.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} onChange={event => update("timezone", event.target.value)}/></label>
         <div className="weekday-picker">{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day, index) => <label key={day}><input type="checkbox" disabled={!owner} checked={(plan.weekdays || []).includes(index + 1)} onChange={event => update("weekdays", event.target.checked ? [...(plan.weekdays || []), index + 1] : (plan.weekdays || []).filter((value: number) => value !== index + 1))}/>{t(day)}</label>)}</div>
        </> : <label>{t("Abstand in Minuten")}<input disabled={!owner} type="number" min={15} value={plan.intervalMinutes || 120} onChange={event => update("intervalMinutes", Number(event.target.value))}/></label>}

        {!idlePolicy&&<label>{t("Wenn der Server läuft")}<select disabled={!owner} value={plan.runningPolicy||"wait"} onChange={event=>update("runningPolicy",event.target.value)}><option value="wait">{t("Auf den nächsten Serverstopp warten")}</option><option value="restart">{t("Kurz stoppen, sichern und wieder starten")}</option></select></label>}
        <label>{t("Anzahl behalten \u00B7 0 = unbegrenzt")}<input disabled={!owner} type="number" min={0} value={plan.keep ?? 8} onChange={event => update("keep", Number(event.target.value))}/></label>
        <label>{t("Maximales Alter in Tagen \u00B7 0 = unbegrenzt")}<input disabled={!owner} type="number" min={0} value={plan.maxAgeDays || 0} onChange={event => update("maxAgeDays", Number(event.target.value))}/></label>
        <label>{t("Speicherlimit in MiB \u00B7 0 = unbegrenzt")}<input disabled={!owner} type="number" min={0} value={plan.maxTotalMiB || 0} onChange={event => update("maxTotalMiB", Number(event.target.value))}/></label>
       </div>
       <label className="toggle-row"><span>{t("Aufbewahrungsregeln auch auf manuelle Backups anwenden")}</span><input type="checkbox" disabled={!owner} checked={!!plan.includeManual} onChange={event => update("includeManual", event.target.checked)}/></label>
       <p className="muted">{t(idlePolicy?"MineHost muss aktiv bleiben. Fällige Backups warten, bis mindestens 15 Minuten lang niemand online war. Dann wird der Server kurz gestoppt, gesichert und bei Bedarf wieder gestartet. Währenddessen zeigt die Spieladresse „Backup wird erstellt“.":"Die 15-Minuten-Regel benötigt die aktuelle APK.")}</p>
       <button className="btn btn-blue" disabled={!owner || !online || busy} onClick={() => act("backup_schedule_save", plan)}>{t("Zeitplan speichern")}</button>
       {plan.nextRun > 0 && <p>{t("N\u00E4chste Sicherung: ")}{new Date(plan.nextRun).toLocaleString(locale)}</p>}{plan.status && <p>{t(plan.status)}</p>}{plan.lastError && <p className="log-error">{t(plan.lastError)}</p>}
      </>}
      <p role="status">{t(message)}</p><div className="table-wrap"><table><thead><tr><th>{t("Sicherung")}</th><th>{t("Umfang")}</th><th>{t("Gr\u00F6\u00DFe")}</th><th>{t("Aktionen")}</th></tr></thead><tbody>
       {backups.map(backup => <tr key={backup.name}><td>{new Date(backup.modified).toLocaleString(locale)}<small className="backup-name">{backup.name}</small></td>
        <td>{backup.info?.mode === "custom" ? t("Auswahl") : backup.info?.format === 2 ? t("Vollständig") : t("Ältere Sicherung")}{backup.info?.automatic ? t(" · Automatisch") : ""}</td><td>{(backup.size / 1048576).toFixed(1)}{t(" MiB")}</td>
        <td><button className="btn btn-outline compact" onClick={async () => { try {
            setInspect({ name: backup.name, ...await run("backup_inspect", { path: backup.name }) });
        }
        catch (error) {
            setMessage(t(error instanceof Error ? error.message : "Nicht verfügbar"));
        } }}>{t("Details")}</button>
         <button className="btn btn-outline compact" disabled={!online || busy} onClick={() => download("backup_download", backup.name)}>{t("Download")}</button>
         <button className="btn btn-outline compact" disabled={!online || active || !canRestore || busy} onClick={() => { if (confirm(t(backup.info?.mode === "custom" ? "Die gesicherten Dateien und Ordner zurücksetzen? Nicht ausgewählte Inhalte bleiben erhalten. Vorher wird der aktuelle Server vollständig gesichert." : "Den gesicherten Serverstand wiederherstellen? Vorher wird der aktuelle Stand vollständig gesichert.")))
            void act("backup_restore", { path: backup.name }); }}>{t("Wiederherstellen")}</button>
        </td></tr>)}
      </tbody></table></div>
      {inspect && <div className="notice"><button className="tiny" onClick={() => setInspect(null)}>{t("Schlie\u00DFen")}</button><strong>{inspect.name}</strong><p>{inspect.files ?? "—"}{t(" Dateien \u00B7 ")}{((inspect.bytes || 0) / 1048576).toFixed(1)}{t(" MiB unkomprimiert")}</p><p>{t("Einbezogen: ")}{inspect.mode === "custom" ? (inspect.include || []).join(t(", ")) : t("Vollständiger Server")}</p><p>{t("Ausgeschlossen: ")}{(inspect.exclude || []).join(t(", ")) || t("Keine")}</p>{inspect.skippedLinks > 0 && <p>{inspect.skippedLinks}{t(" symbolische Verkn\u00FCpfungen wurden nicht gesichert.")}</p>}</div>}
    </section>;
}
