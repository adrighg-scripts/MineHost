"use client";
import { useLanguage } from "./language";
import { useState, useEffect } from "react";
import { Globe, Copy } from "lucide-react";

export default function NetworkPanel({ network, lan, online, canWrite, run, tutorial = false, playersPresent = false }: {
    network: any;
    lan: string;
    online: boolean;
    canWrite: boolean;
    tutorial?: boolean;
    playersPresent?: boolean;
    run: (kind: string, payload?: any) => Promise<any>;
}) {
    const { t, locale } = useLanguage();
    const [router, setRouter] = useState("generic"), [dirty, setDirty] = useState(false), [port, setPort] = useState<number>(network?.configured ? network.externalPort : tutorial ? 0 : network?.externalPort || 25565), [saved, setSaved] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
    const [customDomain, setCustomDomain] = useState("mc.deinedomain.de");
    useEffect(() => {
        if (!dirty && network?.externalPort && (network.configured || !tutorial))
            setPort(network.externalPort);
    }, [network?.externalPort, network?.configured, dirty, tutorial]);
    const validPort = Number.isInteger(port) && port >= 1 && port <= 65535;
    const needsSave = dirty || !network?.configured;
    const [voiceInternal, setVoiceInternal] = useState(24454), [voiceExternal, setVoiceExternal] = useState(24454), [voiceDirty, setVoiceDirty] = useState(false);
    useEffect(() => {
        if (network?.voice && !voiceDirty) {
            setVoiceInternal(network.voice.internalPort);
            setVoiceExternal(network.voice.externalPort);
        }
    }, [network?.voice?.internalPort, network?.voice?.externalPort, voiceDirty]);
    async function saveVoice() {
        setBusy(true);
        try {
            const result = await run("voice_configure", { internalPort: voiceInternal, externalPort: voiceExternal });
            setMessage(t(result.message));
            setVoiceDirty(false);
        } catch (error) {
            setMessage(t(error instanceof Error ? error.message : "Aktion fehlgeschlagen."));
        } finally {
            setBusy(false);
        }
    }
    async function check() {
        setBusy(true);
        try {
            if (needsSave && saved && validPort) {
                await run("network_configure", { externalPort: port, configured: true });
                setDirty(false);
                setSaved(false);
            }
            const result = await run("network_check");
            setMessage(result.address ? t("Spieladresse") + " " + result.address : playersPresent ? "" : result.message);
        } catch (e) {
            setMessage(t(e instanceof Error ? e.message : "Prüfung fehlgeschlagen."));
        } finally {
            setBusy(false);
        }
    }
    const split = lan.lastIndexOf(":"), localIp = split >= 0 ? lan.slice(0, split) : lan, localPort = split >= 0 ? lan.slice(split + 1) : "25565";
    const pubRaw = (network?.address || network?.candidate || "") as string;
    const pubIp = pubRaw.includes(":") ? pubRaw.split(":")[0] : (pubRaw || "203.0.113.10");
    const extPort = port || network?.externalPort || 25565;
    const subParts = customDomain.trim().replace(/\.$/, "").split(".");
    const subPrefix = subParts.length > 2 ? subParts.slice(0, -2).join(".") : "@";

    return <section className="panel settings-panel">
        <h2>{t("Mit Freunden spielen")}</h2>
        <p className="muted">{locale === "en" ? "Devices on the same router share its public IP. Give each server a different external TCP port, such as 12652 and 12654. The internal port can be the same on different phones." : "Geräte am selben Router teilen sich die öffentliche IP. Verwende je Server einen eigenen externen TCP-Port, etwa 12652 und 12654. Auf verschiedenen Handys darf der interne Port gleich sein."}</p>
        <div className="public-address">{network?.address || network?.candidate || t("Noch nicht öffentlich erreichbar")}</div>
        {!network?.address && !playersPresent && <p>{t(network?.message || "Richte einmal deinen Router ein. Danach können Freunde die Spieladresse verwenden.")}</p>}
        <label>{t("Router")}<select value={router} onChange={e => setRouter(e.target.value)}><option value="generic">{t("Allgemeine Anleitung")}</option><option value="fritz">{t("FRITZ!Box")}</option></select></label>
        <ol className="setup-steps">
            <li><strong>{t("Handy bereit machen")}</strong><p>{t("Handy im Heim-WLAN lassen und den Server starten. Es muss w\u00E4hrend des Spielens eingeschaltet bleiben.")}</p></li>
            <li><strong>{t("Handy im Router ausw\u00E4hlen")}</strong><p>{t("\u00D6ffne die Router-Adresse vom Aufkleber. ")}{router === "fritz" ? <>{t("FRITZ!Box: ")}<b>{t("fritz.box \u2192 Heimnetz \u2192 Netzwerk")}</b>{t(".")}</> : <>{t("Suche im Router nach \u201EHeimnetz\u201C, \u201ELAN\u201C oder \u201EVerbundene Ger\u00E4te\u001C.")}</>}{t(" W\u00E4hle das Handy mit der WLAN-IP ")}<b>{localIp || t("wird vom Handy geladen")}</b>{t(". Aktiviere \u201Eimmer die gleiche IPv4-Adresse zuweisen\u201C.")}</p></li>
            <li><strong>{t("Eine Portfreigabe anlegen")}</strong><p>{router === "fritz" ? <>{t("FRITZ!Box: ")}<b>{t("Internet \u2192 Freigaben \u2192 Portfreigaben \u2192 Ger\u00E4t hinzuf\u00FCgen \u2192 Handy \u2192 Neue Freigabe \u2192 Andere Anwendung")}</b>{t(".")}</> : <>{t("Suche nach \u201EPortweiterleitung\u201C, \u201EPort Forwarding\u201C oder \u201ENAT\u201C. Lege eine Regel f\u00FCr dein Handy an.")}</>}</p><p>{t("Sieh in der Liste der Portfreigaben deines Routers nach. Wähle einen freien externen TCP-Port und trage dieselbe Nummer im Router und hier unter „Port für Freunde“ ein. Der Port am Handy steht unten.")}</p>
                <div className="settings-grid">
                    <label>{t("Protokoll")}<input readOnly value="TCP"/></label>
                    <label>{t("Port am Handy")}<input readOnly value={localPort}/></label>
                    <label>{t("Port f\u00FCr Freunde")}<input type="number" min={1} max={65535} value={port || ""} onChange={e => { setDirty(true); setSaved(false); setPort(Number(e.target.value)); }}/></label>
                </div>
                <p>{t("Nur diesen einzelnen TCP-Port freigeben. \u201EExposed Host\u201C/DMZ bleibt aus. Anschlie\u00DFend speichern.")}</p>
            </li>
            <li><strong>{t("Verbindung pr\u00FCfen")}</strong><p>{t("Speichere die Freigabe im Router und best\u00E4tige es hier. MineHost pr\u00FCft den Spielport von au\u00DFen.")}</p>
                <label className="toggle-row"><span>{t("Ich habe die Freigabe gespeichert.")}</span><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)}/></label>
                <button className="btn btn-blue" disabled={!online || !canWrite || busy || (needsSave && (!saved || !validPort))} onClick={check}>{busy ? t("Wird geprüft …") : needsSave ? t("Port speichern und prüfen") : t("Spieladresse prüfen")}</button>
                <p role="status">{t(message)}</p>
            </li>
            <li><strong>{t("Adresse weitergeben")}</strong><p>{t("Freunde \u00F6ffnen Minecraft Java \u2192 Mehrspieler \u2192 Server hinzuf\u00FCgen und tragen die angezeigte Spieladresse ein. Die Minecraft-Version muss zum Server passen. F\u00FCr alle Spieler die Whitelist ausschalten; f\u00FCr ausgew\u00E4hlte Freunde die Whitelist verwenden.")}</p></li>
        </ol>
        {network?.voice && <details open={network.voice.installed || undefined}><summary>Simple Voice Chat</summary><p>{t("Voice Chat braucht eine eigene UDP-Freigabe auf dieselbe Handy-IP. Der interne Port muss zur Serverkonfiguration passen. Bei einem anderen externen Port teilt MineHost diesen den Clients mit.")}</p><form onSubmit={event => { event.preventDefault(); void saveVoice(); }}><div className="settings-grid"><label>{t("UDP-Port am Handy")}<input type="number" required min={1024} max={65535} value={voiceInternal} onChange={event => { setVoiceDirty(true); setVoiceInternal(Number(event.target.value)); }}/></label><label>{t("Externer UDP-Port")}<input type="number" required min={1} max={65535} value={voiceExternal} onChange={event => { setVoiceDirty(true); setVoiceExternal(Number(event.target.value)); }}/></label></div><button className="btn btn-blue" disabled={!online || !canWrite || busy}>{t("Voice Chat speichern")}</button></form><p>{t("Installiere Simple Voice Chat passend zur Minecraft-Version auf dem Server und bei allen Spielern, die sprechen möchten. Danach den Server neu starten und über die öffentliche Spieladresse verbinden.")}</p><p role="status">{t(message)}</p></details>}
        <details><summary><Globe size={15} style={{ verticalAlign: "middle", marginRight: 6 }}/>{locale === "en" ? "Custom Domain (A-Record & SRV-Record)" : "Eigene Domain verbinden (A-Record & SRV-Record)"}</summary>
            <p>{locale === "en" ? "Want friends to join via a custom domain like mc.yourdomain.com without typing a port number? Enter these DNS records at your domain provider (e.g. Cloudflare DNS, IONOS, Strato):" : "Damit Freunde über eine eigene Wunsch-Domain (z. B. mc.deinedomain.de) ohne Portnummer beitreten können, trage diese beiden DNS-Einträge bei deinem Domain-Anbieter (z. B. Cloudflare DNS, Strato, IONOS) ein:"}</p>
            <label style={{ maxWidth: 340, marginBottom: 12 }}>{locale === "en" ? "Your desired server address" : "Deine Wunsch-Domain"}
                <input value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="mc.deinedomain.de"/>
            </label>
            <div className="dns-records-box">
                <div className="dns-row">
                    <span><strong>1. A-Record</strong> (Verweist auf deine öffentliche Router-IP)</span>
                    <code>Typ: A · Name: {subPrefix} · Ziel: {pubIp} · Proxy: DNS Only (Graue Wolke)</code>
                </div>
                <div className="dns-row">
                    <span><strong>2. SRV-Record</strong> (Erspart die Porteingabe :{extPort} in Minecraft)</span>
                    <code>Typ: SRV · Name: _minecraft._tcp{subPrefix === "@" ? "" : "." + subPrefix} · Priorität: 0 · Gewicht: 5 · Port: {extPort} · Ziel: {customDomain.trim()}</code>
                </div>
            </div>
        </details>
        <details><summary>{t("Es klappt noch nicht")}</summary><p>{t("Pr\u00FCfe, ob der Server l\u00E4uft und Ziel-IP, TCP und Ports stimmen. Unter Internet \u2192 Online-Monitor muss dein Router eine \u00F6ffentliche IPv4 haben. Bei DS-Lite/CGNAT frage deinen Anbieter nach einer \u00F6ffentlichen IPv4. Bei zwei Routern ist auch am ersten eine Weiterleitung n\u00F6tig.")}</p><p>{t("Die WLAN-Adresse ")}{lan || t("deines Handys")}{t(" funktioniert nur zu Hause. Eine \u00F6ffentliche IPv4 kann sich \u00E4ndern; MineHost pr\u00FCft sie regelm\u00E4\u00DFig.")}</p></details>
        <details><summary>{t("Sicher bleiben und Freigabe schlie\u00DFen")}</summary><p>{t("Minecraft und Erweiterungen aktuell halten, nur vertrauensw\u00FCrdige Mods/Plugins installieren und Backups machen. Keine Adminports freigeben. Wenn du die Freigabe nicht mehr brauchst, l\u00F6sche die TCP-Regel im Router. Die Website braucht keine eigene Portfreigabe.")}</p></details>
    </section>;
}
