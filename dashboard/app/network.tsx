"use client";
import { useLanguage } from "./language";
import { useState, useEffect } from "react";
import { Globe, Copy, Zap, ShieldCheck, Server } from "lucide-react";

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
    async function triggerUpnp() {
        setBusy(true);
        try {
            const res = await run("network_configure", { externalPort: port || 25565, configured: true, upnp: true });
            const checkRes = await run("network_check");
            setMessage(checkRes?.address ? `UPnP & Port-Check aktiv: ${checkRes.address}` : (res?.message || "UPnP-Portfreigabe am Router angefordert."));
        } catch (e) {
            setMessage(t(e instanceof Error ? e.message : "UPnP-Anfrage fehlgeschlagen."));
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
        <h2>{t("Netzwerk, IP, UPnP & Domain-Support")}</h2>
        <p className="muted">{locale === "en" ? "Overview of your local LAN IP, public WAN IP, Minecraft port status (default 25565), UPnP automatic port forwarding, and custom domain DNS records." : "Übersicht über lokale LAN-IP, öffentliche WAN-IP, Port-Status (Standard: 25565 für Minecraft & HTTPS für das Web-Panel), automatische UPnP-Portfreigabe und eigene Domains."}</p>

        <div className="telemetry-grid" style={{ marginBottom: 18 }}>
            <div className="telemetry-card">
                <div className="telemetry-head"><span>Lokale IP (Heimnetz / LAN)</span></div>
                <strong style={{ fontSize: 15, color: "#ecfdf5", fontFamily: "monospace" }}>{lan || `${localIp || "192.168.178.x"}:${localPort}`}</strong>
                <small style={{ color: "#88a898", fontSize: 11 }}>Direktverbindung im selben WLAN/LAN</small>
            </div>
            <div className="telemetry-card">
                <div className="telemetry-head"><span>Öffentliche IP (Internet / WAN)</span></div>
                <strong style={{ fontSize: 15, color: "#34d399", fontFamily: "monospace" }}>{network?.address || network?.candidate || "Wird beim Port-Check ermittelt"}</strong>
                <small style={{ color: "#88a898", fontSize: 11 }}>Für Freunde über das Internet</small>
            </div>
            <div className="telemetry-card">
                <div className="telemetry-head"><span>Port- & Web-Panel-Status</span></div>
                <strong style={{ fontSize: 14, color: "#ecfdf5" }}>MC: TCP {localPort} → {extPort}</strong>
                <small style={{ color: "#34d399", fontSize: 11 }}>Web-Panel: HTTPS/TLS 1.3 (Cloudflare Edge + Lokal :8787)</small>
            </div>
        </div>

        <div className="java-runtime-badge" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexDirection: "row" }}>
                <Zap size={18}/>
                <div>
                    <strong>Automatische Router-Portfreigabe via UPnP (Universal Plug and Play)</strong>
                    <span>Öffnet TCP-Port {extPort} automatisch am Router, sofern UPnP im Router aktiviert ist.</span>
                </div>
            </div>
            <button type="button" className="btn btn-blue compact" disabled={!online || !canWrite || busy} onClick={triggerUpnp}>
                <Zap size={14}/>{busy ? "UPnP läuft …" : "UPnP-Portfreigabe aktivieren"}
            </button>
        </div>

        <label>{t("Router-Anleitung (falls UPnP am Router deaktiviert ist)")}<select value={router} onChange={e => setRouter(e.target.value)}><option value="generic">{t("Allgemeine Anleitung")}</option><option value="fritz">{t("FRITZ!Box")}</option></select></label>
        <ol className="setup-steps">
            <li><strong>{t("Server-Host bereit machen")}</strong><p>{t("Host-Gerät (Android, Windows oder Linux) im Heimnetz lassen und den Server starten.")}</p></li>
            <li><strong>{t("Host-Gerät im Router auswählen")}</strong><p>{t("\u00D6ffne die Router-Adresse vom Aufkleber. ")}{router === "fritz" ? <>{t("FRITZ!Box: ")}<b>{t("fritz.box \u2192 Heimnetz \u2192 Netzwerk")}</b>{t(".")}</> : <>{t("Suche im Router nach \u201EHeimnetz\u201C, \u201ELAN\u201C oder \u201EVerbundene Ger\u00E4te\u001C.")}</>}{t(" W\u00E4hle dein Host-Gerät mit der IP ")}<b>{localIp || t("wird geladen")}</b>{t(". Aktiviere \u201Eimmer die gleiche IPv4-Adresse zuweisen\u201C.")}</p></li>
            <li><strong>{t("Eine Portfreigabe anlegen")}</strong><p>{router === "fritz" ? <>{t("FRITZ!Box: ")}<b>{t("Internet \u2192 Freigaben \u2192 Portfreigaben \u2192 Ger\u00E4t hinzuf\u00FCgen \u2192 Neue Freigabe \u2192 Andere Anwendung")}</b>{t(".")}</> : <>{t("Suche nach \u201EPortweiterleitung\u201C, \u201EPort Forwarding\u201C oder \u201ENAT\u201C. Lege eine TCP-Regel f\u00FCr deinen Host an.")}</>}</p>
                <div className="settings-grid">
                    <label>{t("Protokoll")}<input readOnly value="TCP"/></label>
                    <label>{t("Interner Port (Host)")}<input readOnly value={localPort}/></label>
                    <label>{t("Externer Port (Freunde)")}<input type="number" min={1} max={65535} value={port || ""} onChange={e => { setDirty(true); setSaved(false); setPort(Number(e.target.value)); }}/></label>
                </div>
            </li>
            <li><strong>{t("Verbindung pr\u00FCfen")}</strong><p>{t("Speichere die Freigabe im Router und best\u00E4tige es hier. MineHost pr\u00FCft den Spielport von au\u00DFen.")}</p>
                <label className="toggle-row"><span>{t("Ich habe die Freigabe gespeichert.")}</span><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)}/></label>
                <button className="btn btn-blue" disabled={!online || !canWrite || busy || (needsSave && (!saved || !validPort))} onClick={check}>{busy ? t("Wird geprüft …") : needsSave ? t("Port speichern und prüfen") : t("Spieladresse prüfen")}</button>
                <p role="status">{t(message)}</p>
            </li>
        </ol>
        {network?.voice && <details open={network.voice.installed || undefined}><summary>Simple Voice Chat (UDP)</summary><p>{t("Voice Chat braucht eine eigene UDP-Freigabe auf dieselbe Host-IP.")}</p><form onSubmit={event => { event.preventDefault(); void saveVoice(); }}><div className="settings-grid"><label>{t("Interner UDP-Port")}<input type="number" required min={1024} max={65535} value={voiceInternal} onChange={event => { setVoiceDirty(true); setVoiceInternal(Number(event.target.value)); }}/></label><label>{t("Externer UDP-Port")}<input type="number" required min={1} max={65535} value={voiceExternal} onChange={event => { setVoiceDirty(true); setVoiceExternal(Number(event.target.value)); }}/></label></div><button className="btn btn-blue" disabled={!online || !canWrite || busy}>{t("Voice Chat speichern")}</button></form><p role="status">{t(message)}</p></details>}
        <details open><summary><Globe size={15} style={{ verticalAlign: "middle", marginRight: 6 }}/>{locale === "en" ? "Custom Domain (A-Record & SRV-Record)" : "Eigene Domain verbinden (A-Record & SRV-Record)"}</summary>
            <p>{locale === "en" ? "Want friends to join via a custom domain like mc.yourdomain.com without typing a port number? Enter these DNS records at your domain provider:" : "Damit Freunde über eine eigene Wunsch-Domain (z. B. mc.deinedomain.de) ohne Portnummer beitreten können, trage diese beiden DNS-Einträge bei deinem Domain-Anbieter (z. B. Cloudflare DNS, Strato, IONOS) ein:"}</p>
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
        <details><summary><ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: 6 }}/>Reverse-Proxy, HTTPS/TLS (Let&apos;s Encrypt) & Cloudflare Tunnel</summary>
            <p>Dein Web-Control-Panel ist über <b>https://minehost-dashboard.adrilolghg.workers.dev</b> bereits weltweit per HTTPS/TLS 1.3 (Cloudflare Edge) geschützt — ohne dass du einen Web-Port am Router öffnen musst. Für eine eigene Dashboard-Domain oder den lokalen Host-Daemon (Port 8787) kannst du wahlweise nutzen:</p>
            <div className="dns-records-box">
                <div className="dns-row">
                    <span><strong>Option A: Cloudflare Tunnel (Ohne Router-Portfreigabe fürs Web-Panel)</strong></span>
                    <code>cloudflared tunnel --url http://127.0.0.1:8787</code>
                </div>
                <div className="dns-row">
                    <span><strong>Option B: Caddy Reverse-Proxy mit automatischem Let&apos;s Encrypt HTTPS/TLS</strong></span>
                    <code>panel.deinedomain.de &#123; reverse_proxy 127.0.0.1:8787 &#125;</code>
                </div>
            </div>
        </details>
    </section>;
}
