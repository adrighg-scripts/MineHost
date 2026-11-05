"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Settings, X } from "lucide-react";
import { useLanguage } from "./language";

export default function Profiles({ online, active, running, canRename, canDelete = false, canRemoveDevice = false, removeDevice, removeOfflineDevice, offlineDevices = [], renameDevice, devicePicker, initialData, run }: {
    online: boolean;
    canRename: boolean;
    canDelete?: boolean;
    canRemoveDevice?: boolean;
    removeDevice?: (receipt: string, target?: string) => Promise<void>;
    removeOfflineDevice?: (target: string, password: string) => Promise<void>;
    offlineDevices?: { id: string; name: string }[];
    devicePicker?: ReactNode;
    renameDevice?: () => Promise<void>;
    initialData?: { active: string; profiles: { id: string; name: string }[] };
    active: boolean;
    running: boolean;
    run: (kind: string, payload?: unknown) => Promise<any>;
}) {
    const { t, locale } = useLanguage();
    const [data, setData] = useState<{ active: string; profiles: { id: string; name: string }[] } | undefined>(initialData);
    const dialog = useRef<HTMLDialogElement>(null);
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [switchError, setSwitchError] = useState("");
    const [busy, setBusy] = useState(false);
    const [deletionCommand, setDeletionCommand] = useState("");
    const [removal, setRemoval] = useState<"server" | "device" | null>(null);
    const [removeTarget, setRemoveTarget] = useState("");
    const removingHost = removal === "device";
    const offlineRemoval = removingHost && !!removeTarget && !(online && running && canRemoveDevice);

    async function load() {
        try { setData(await run("profiles_list")); }
        catch (failure) { setError(t(failure instanceof Error ? failure.message : "Server konnten nicht geladen werden.")); }
    }

    useEffect(() => { if (initialData) setData(initialData); else if (online) void load(); }, [online, initialData?.active, initialData?.profiles.length]);

    async function select(id: string) {
        setSwitchError("");
        setBusy(true);
        setError("");
        try {
            await run("profiles_select", { id });
            window.location.reload();
        } catch (failure) {
            setSwitchError(t(failure instanceof Error ? failure.message : "Serverwechsel fehlgeschlagen."));
            setBusy(false);
        }
    }

    const currentName = data?.profiles.find(profile => profile.id === data.active)?.name || t("Vorhandener Server");
    const picker = <div className="profile-picker">
        <label className="host-picker">{t("Server auf diesem Gerät")}<select value={data?.active || "default"} disabled={!online || active || busy || !data} onChange={event => void select(event.target.value)}>
            {(data?.profiles || [{ id: "default", name: "" }]).map(profile => <option key={profile.id} value={profile.id}>{profile.name || t("Vorhandener Server")}</option>)}
        </select></label>
        {active && <p className="muted">{t("Stoppe den laufenden Server, um zu wechseln.")}</p>}
        {switchError && <small role="alert">{switchError}</small>}

    </div>;

    return <div className="server-manager">
        <div className="server-manager-trigger">
            {picker}
            <button type="button" className="tiny server-manager-gear" aria-label={t("Server verwalten")} title={t("Server verwalten")}
                onClick={() => dialog.current?.showModal()}><Settings size={19}/></button>
        </div>
        <dialog ref={dialog} className="server-management-dialog" onClose={() => { setRemoval(null); setDeletionCommand(""); setError(""); }} aria-labelledby="server-management-title">
        <div className="section-heading">
            <div><h2 id="server-management-title">{t("Server verwalten")}</h2><p>{locale === "en" ? "Manage servers and the host device that runs them." : "Verwalte deine Server und das Host-Gerät, auf dem sie laufen."}</p></div>
            <button type="button" className="tiny" aria-label={t("Schließen")} onClick={() => dialog.current?.close()}><X size={20}/></button>
        </div>
        <section className="manager-card"><h3>{t("Server")}</h3>{picker}<p className="muted">{locale === "en" ? "Create a separate server with its own world and settings. Rename changes the label of the selected server." : "Erstellen legt einen eigenen Server mit separater Welt und eigenen Einstellungen an. Umbenennen ändert den Namen des ausgewählten Servers."}</p>

        <form className="inline-form" onSubmit={async event => {
            event.preventDefault();
            setBusy(true);
            setError("");
            let sound: AudioContext | undefined;
            try {
                sound = new AudioContext();
                void sound.resume().catch(() => {});
            } catch {}
            try {
                await run("profiles_create", { name });
                setName("");
                if (sound?.state === "running") {
                    const tone = sound.createOscillator();
                    const volume = sound.createGain();
                    const now = sound.currentTime;
                    tone.frequency.setValueAtTime(587, now);
                    tone.frequency.setValueAtTime(784, now + 0.075);
                    volume.gain.setValueAtTime(0.035, now);
                    volume.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                    tone.connect(volume).connect(sound.destination);
                    tone.onended = () => { void sound?.close().catch(() => {}); };
                    tone.start(now);
                    tone.stop(now + 0.19);
                } else {
                    void sound?.close().catch(() => {});
                }
                await load();
            }
            catch (failure) { if (sound?.state !== "closed") void sound?.close().catch(() => {}); setError(t(failure instanceof Error ? failure.message : "Server konnte nicht erstellt werden.")); }
            finally { setBusy(false); }
        }}><input required aria-label={t("Servername")} placeholder={locale === "en" ? "Name for the new server" : "Name für den neuen Server"} maxLength={48} value={name} onChange={event => setName(event.target.value)}/><button className="btn btn-blue" disabled={!online || busy || !name.trim()}>{t("Server erstellen")}</button></form>
        {canRename && <form className="inline-form" onSubmit={async event => {
            event.preventDefault();
            const form = event.currentTarget;
            const newName = String(new FormData(form).get("profileName") || "").trim();
            if (!newName) return;
            setBusy(true);
            setError("");
            try { await run("profiles_rename", { name: newName }); form.reset(); await load(); }
            catch (failure) { setError(t(failure instanceof Error ? failure.message : "Umbenennen fehlgeschlagen.")); }
            finally { setBusy(false); }
        }}><input name="profileName" key={data?.active + ":" + currentName} defaultValue={currentName} required maxLength={48} aria-label={t("Neuer Servername")} placeholder={t("Neuer Servername")}/><button className="btn btn-outline" disabled={!online || busy || !data}>{t("Server umbenennen")}</button></form>}
        {canDelete && data?.active && <button type="button" className="btn btn-red compact" disabled={busy} onClick={() => { setRemoval("server"); setDeletionCommand(""); setError(""); }}>{t("Server löschen")}</button>}
        </section>
        {renameDevice && <section className="manager-card">
            <h3>{locale === "en" ? "Host device" : "Host-Gerät"}</h3>
            {devicePicker}
            <div className="manager-actions">
                <button type="button" className="btn btn-outline compact" onClick={() => void renameDevice()}>{t("Gerät umbenennen")}</button>
                {(canRemoveDevice || offlineDevices.length > 0) && <button type="button" className="btn btn-red compact" disabled={busy} onClick={() => { setRemoval("device"); setRemoveTarget(online && canRemoveDevice ? "" : offlineDevices[0]?.id || ""); setDeletionCommand(""); setError(""); }}>{t("Gerät entfernen")}</button>}
            </div>
        </section>}
        {error && <p role="alert" className="log-error">{error}</p>}
        {removal && <section className="manager-card manager-confirmation">
            <h3>{t(removingHost ? "Gerät entfernen" : "Server löschen")}</h3>
            <p className="muted">{offlineRemoval
                ? (locale === "en" ? "If none of your servers is running, confirm with your password. Otherwise select the device with the running server and confirm in game." : "Wenn keiner deiner Server läuft, bestätige mit deinem Passwort. Ansonsten wähle das Gerät mit dem laufenden Server und bestätige im Spiel.")
                : (locale === "en"
                    ? "Start the server and join as an operator. If Minecraft rejects the command, enter op <your Minecraft name> in the dashboard console and try again."
                    : "Starte den Server und tritt als OP bei. Falls Minecraft den Befehl ablehnt, gib in der Dashboard-Konsole op <dein Minecraft-Name> ein und versuche es erneut.")}</p>
            {!removingHost && <p className="muted">{locale === "en" ? "MineHost stops the server and archives its files." : "MineHost stoppt den Server und archiviert seine Dateien."}</p>}
            {removingHost && offlineDevices.length > 0 && <label className="host-picker">{locale === "en" ? "Device to remove" : "Gerät zum Entfernen"}
                <select value={removeTarget} disabled={busy || !!deletionCommand} onChange={event => setRemoveTarget(event.target.value)}>
                    {online && canRemoveDevice && <option value="">{locale === "en" ? "Current device" : "Aktuelles Gerät"}</option>}
                    {offlineDevices.map(device => <option key={device.id} value={device.id}>{device.name} ({t("Offline")})</option>)}
                </select>
            </label>}
            {!deletionCommand ? <form className="inline-form" onSubmit={async event => {
                event.preventDefault();
                const form = event.currentTarget;
                const password = new FormData(form).get("password");
                form.reset();
                setBusy(true);
                setError("");
                try {
                    if (offlineRemoval && removeOfflineDevice) {
                        await removeOfflineDevice(removeTarget, String(password || ""));
                        window.location.replace("/");
                    } else {
                        const result = await run(removingHost ? "device_remove_begin" : "profiles_delete_begin", { password });
                        if (result.removed) window.location.reload();
                        else setDeletionCommand(result.command);
                    }
                }
                catch (failure) { setError(t(failure instanceof Error ? failure.message : "Aktion fehlgeschlagen.")); }
                finally { setBusy(false); }
            }}><input name="password" type="password" autoComplete="current-password" required aria-label={t("Passwort")}/>
            <button className="btn btn-outline" disabled={busy || (!offlineRemoval && (!online || (removingHost && !running)))}>{t(offlineRemoval ? "Gerät entfernen" : "Bestätigung anfordern")}</button></form> :
                <><p className="muted" style={{overflowWrap:"anywhere"}}><code>{deletionCommand}</code></p>
                <button className="btn btn-red" disabled={!online || busy} onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                        if (removingHost && removeDevice) {
                            const result = await run("device_remove_verify", { command: deletionCommand, target: removeTarget || undefined });
                            await removeDevice(result.receipt, removeTarget || undefined);
                            window.location.replace("/");
                        } else {
                            await run("profiles_delete", { command: deletionCommand });
                            window.location.reload();
                        }
                    }
                    catch (failure) { setError(t(failure instanceof Error ? failure.message : "Aktion fehlgeschlagen.")); }
                    finally { setBusy(false); }
                }}>{t(removingHost ? "Gerät entfernen" : "Server löschen")}</button></>}
            <button type="button" className="btn btn-outline compact" disabled={busy} onClick={() => { setRemoval(null); setDeletionCommand(""); setError(""); }}>{t("Abbrechen")}</button>
        </section>}
    </dialog></div>;
}
