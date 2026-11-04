"use client";
import { useLanguage } from "./language";
import { useState, useEffect } from "react";
const rights: Record<string, string> = { "mods.read": "Mods ansehen", "mods.write": "Mods installieren / ändern", "plugins.read": "Plugins ansehen", "plugins.write": "Plugins installieren / ändern (ausführbarer Code)", power: "Starten / Stoppen / Neustart", "console.read": "Konsole lesen", "console.write": "Befehle senden (volle Spielkontrolle)", "files.read": "Dateien lesen / herunterladen", "files.write": "Dateien ändern / hochladen / löschen (auch ausführbarer Code)", "backups.read": "Backups lesen / herunterladen", "backups.create": "Backups erstellen", "backups.restore": "Backups wiederherstellen", "players": "Spieler / Whitelist verwalten", "settings.read": "Einstellungen ansehen", "settings.write": "Einstellungen ändern", "network": "Internetzugang verwalten" };
export default function Members({ serverId }: {
    serverId: string;
}) {
    const { t, locale } = useLanguage();
    const [members, setMembers] = useState<any[]>([]), [links, setLinks] = useState<any[]>([]), [label, setLabel] = useState(""), [recipient, setRecipient] = useState(""), [hours, setHours] = useState(24), [maxUses, setMaxUses] = useState(1), [accessHours, setAccessHours] = useState(0), [permissions, setPermissions] = useState<string[]>([]), [invite, setInvite] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
    const endpoint = "/api/members?server=" + encodeURIComponent(serverId);
    async function load() { try {
        const response = await fetch(endpoint);
        const data: any = await response.json();
        if (!response.ok)
            throw new Error(data.error);
        setMembers(data.members);
        setLinks(data.invitations || []);
    }
    catch (error) {
        setMessage(t(error instanceof Error ? error.message : "Fehler"));
    } }
    useEffect(() => { load(); }, [serverId]);
    async function action(input: any) { setBusy(true); try {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
        const data: any = await response.json();
        if (!response.ok)
            throw new Error(data.error);
        if (data.url)
            setInvite(data.url);
        setMessage(t(data.url ? "Link erstellt. Kopiere ihn jetzt und gib ihn weiter." : "Rechte aktualisiert. Bereits laufende Befehle können noch abgeschlossen werden."));
        await load();
    }
    catch (error) {
        setMessage(t(error instanceof Error ? error.message : "Fehler"));
    }
    finally {
        setBusy(false);
    } }
    function choices(values: string[], change: (next: string[]) => void) { return <div className="settings-grid">{Object.entries(rights).map(([key, label]) => <label key={key}><span><input type="checkbox" checked={values.includes(key)} onChange={event => change(event.target.checked ? [...values, key] : values.filter(value => value !== key))}/> {t(label)}</span></label>)}</div>; }
    return <section className="panel"><h2>{t("Mitglieder & Rechte")}</h2><p className="muted">{t("Nur du als Besitzer kannst Rechte vergeben. Ohne Auswahl darf ein Freund nur den Serverstatus sehen. Datei\u00E4nderungen und Konsolenbefehle nur vertrauensw\u00FCrdigen Personen erlauben.")}</p><h3>{t("Freigabelink erstellen")}</h3><div className="settings-grid"><label>{t("Name f\u00FCr diesen Link")}<input maxLength={80} value={label} placeholder={t("z. B. Alex")} onChange={e => setLabel(e.target.value)}/></label><label>{t("Nur f\u00FCr Benutzername (optional)")}<input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={t("Leer: jeder mit diesem Link")}/></label><label>{t("Link g\u00FCltig f\u00FCr (Stunden)")}<input type="number" min={1} max={8760} value={hours} onChange={e => setHours(Number(e.target.value))}/></label><label>{t("Wie oft nutzbar?")}<input type="number" min={0} max={10000} value={maxUses} onChange={e => setMaxUses(Number(e.target.value))}/><small>{t("0 = unbegrenzt; jedes Konto kann einmal annehmen.")}</small></label><label>{t("Zugang nach Annahme (Stunden)")}<input type="number" min={0} max={87600} value={accessHours} onChange={e => setAccessHours(Number(e.target.value))}/><small>{t("0 = bis du den Zugang entziehst.")}</small></label></div>{choices(permissions, setPermissions)}<button className="btn btn-blue" disabled={busy} onClick={() => action({ action: "invite", permissions, label, recipient, hours, maxUses, accessHours })}>{t("Einladungslink erstellen")}</button>{invite && <label className="invite-link">{t("Link an deinen Freund weitergeben")}<input readOnly value={invite} onFocus={event => event.target.select()}/></label>}<p role="status">{t(message)}</p><h3>{t("Erstellte Links")}</h3>{links.map(link => <div className="member-entry" key={link.id}><strong>{link.label}</strong><p>{link.recipient ? `${t("Für")} ${link.recipient} · ` : ""}{link.uses}{t(" / ")}{link.max_uses || "∞"}{t(" Nutzungen \u00B7 ")}{link.revoked ? t("Widerrufen") : link.expires < Date.now() ? t("Abgelaufen") : `${t("Gültig bis")} ${new Date(link.expires).toLocaleString(locale)}`}</p>{!link.revoked && <button className="btn btn-outline" disabled={busy} onClick={() => action({ action: "revoke", id: link.id })}>{t("Link widerrufen")}</button>}</div>)}<h3>{t("Mitglieder")}</h3>{members.map(member => <div className="member-entry" key={member.account_id}><h3>{member.username}</h3><label>{t("Zugang bis")}<input type="datetime-local" value={member.expires ? new Date(member.expires - new Date(member.expires).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} onChange={e => setMembers(current => current.map(item => item.account_id === member.account_id ? { ...item, expires: e.target.value ? new Date(e.target.value).getTime() : 0 } : item))}/><small>{t("Leer = ohne Zeitlimit.")}</small></label>{choices(member.permissions, next => setMembers(current => current.map(item => item.account_id === member.account_id ? { ...item, permissions: next } : item)))}<button className="btn btn-blue" disabled={busy} onClick={() => action({ action: "update", accountId: member.account_id, permissions: member.permissions, expires: member.expires })}>{t("Rechte speichern")}</button> <button className="btn btn-red" disabled={busy} onClick={() => { if (confirm((locale==="en"?`Revoke access for ${member.username}?`:`Zugang für ${member.username} entziehen?`)))
        action({ action: "remove", accountId: member.account_id }); }}>{t("Zugang entziehen")}</button></div>)}</section>;
}
