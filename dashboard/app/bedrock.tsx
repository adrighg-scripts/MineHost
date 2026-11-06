"use client";

import { useLanguage } from "./language";

export type BedrockState = { supported: boolean; enabled: boolean; port: number; version: string; activePort: number };
type BedrockSettings = {
    bedrock?: BedrockState;
    bedrockEnabled?: boolean;
    bedrockPort?: number;
    port: number;
};

export function BedrockOptions<T extends BedrockSettings>({ settings, software, disabled, onChange }: {
    settings: T;
    software?: string;
    disabled?: boolean;
    onChange: (settings: T) => void;
}) {
    const { locale } = useLanguage();
    const l = (de: string, en: string) => locale === "de" ? de : en;
    const available = software === "pumpkin" && settings.bedrock?.supported === true;
    const enabled = available && (settings.bedrockEnabled ?? settings.bedrock?.enabled ?? false);
    const port = settings.bedrockPort ?? settings.bedrock?.port ?? 19132;
    return <fieldset className="bedrock-options">
        <legend>{l("Java & Bedrock", "Java & Bedrock")}</legend>
        <label className="toggle-row">
            <span><strong>{l("Bedrock-Spieler erlauben", "Allow Bedrock players")}</strong>
            <small>{l("In MineHost ist Crossplay nur für Paper und Pumpkin vorgesehen.", "In MineHost, crossplay is only intended for Paper and Pumpkin.")}</small></span>
            <input type="checkbox" checked={enabled} disabled={!available || disabled}
                onChange={event => onChange({ ...settings, bedrockEnabled: event.target.checked, bedrockPort: port })}/>
        </label>
        {software === "paper" && <p>{l("Paper braucht Geyser. Dessen Netzwerkbibliothek läuft in der Android-App derzeit nicht.", "Paper needs Geyser. Its networking library currently does not run in the Android app.")}</p>}
        {software === "pumpkin" && !available && <p>{l("Aktualisiere MineHost auf dem Host-Gerät, um Crossplay einzurichten.", "Update MineHost on your host device to set up crossplay.")}</p>}
        {available && <p>{l("Pumpkin-Crossplay ist experimentell und läuft derzeit ohne Plugins und PatchBukkit. Änderungen gelten beim nächsten Start.", "Pumpkin crossplay is experimental and currently runs without plugins or PatchBukkit. Changes apply the next time the server starts.")}</p>}
        {enabled && <label>{l("Bedrock-Port", "Bedrock port")}
            <input type="number" min={1024} max={65535} required disabled={disabled} value={port || ""}
                onChange={event => onChange({ ...settings, bedrockEnabled: true, bedrockPort: Number(event.target.value) })}/>
        </label>}
    </fieldset>;
}

export function BedrockConnection({ state, lan, publicAddress, outside = false, whitelist }: {
    state?: BedrockState;
    lan: string;
    publicAddress?: string;
    outside?: boolean;
    whitelist?: boolean;
}) {
    const { locale } = useLanguage();
    const l = (de: string, en: string) => locale === "de" ? de : en;
    if (!state?.supported || (!state.enabled && !state.activePort)) return null;
    const pubHost = publicAddress?.replace(/:\d+$/, "") || "";
    const localIp = lan.replace(/:\d+$/, "");
    const port = state.activePort || state.port || 19132;

    return <div className="bedrock-options" style={{ marginTop: 16, padding: "14px 16px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: 8 }}>
        <strong style={{ fontSize: "1.05rem", color: "#10b981", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🎮</span> {l("Mit Bedrock beitreten (Handy, Konsole, Windows)", "Join with Bedrock (Mobile, Console, Windows)")}
        </strong>

        {(!state.activePort || state.activePort !== state.port || !state.enabled) && (
            <p style={{ color: "#f59e0b", margin: "8px 0" }}>
                ⚠️ {l("Die gespeicherten Einstellungen gelten nach dem nächsten Server-Neustart.", "Saved settings apply the next time the server starts.")}
            </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 12 }}>
            {/* Lokaler Beitritt (Gleiches WLAN / Heimnetzwerk) */}
            <div style={{ background: "rgba(0,0,0,0.25)", padding: 12, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontWeight: "bold", color: "#6ee7b7", marginBottom: 4 }}>
                    🏠 {l("Für dich zuhause (Gleiches WLAN / PC)", "For you at home (Same Wi-Fi / PC)")}
                </div>
                <div style={{ fontSize: "0.88rem", marginBottom: 6, color: "var(--text-muted, #94a3b8)" }}>
                    {l("Nutze immer diese lokale Adresse. Keine Routerfreigabe erforderlich!", "Always use this local address. No router port forwarding required!")}
                </div>
                <div style={{ fontSize: "0.95rem" }}>
                    <strong>IP:</strong> <code style={{ color: "#38bdf8" }}>{localIp || "192.168.178.X"}</code> · <strong>Port:</strong> <code style={{ color: "#38bdf8" }}>{port}</code>
                </div>
            </div>

            {/* Externer Beitritt (Freunde aus dem Internet) */}
            {pubHost && (
                <div style={{ background: "rgba(0,0,0,0.25)", padding: 12, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontWeight: "bold", color: "#93c5fd", marginBottom: 4 }}>
                        🌐 {l("Für Freunde (Über das Internet)", "For Friends (Over the Internet)")}
                    </div>
                    <div style={{ fontSize: "0.88rem", marginBottom: 6, color: "var(--text-muted, #94a3b8)" }}>
                        {l("Deine Freunde nutzen die öffentliche IP. Du selbst kannst diese Adresse von zuhause wegen Router-Loopback nicht testen.", "Friends use this public IP. You cannot test this from home due to router NAT loopback.")}
                    </div>
                    <div style={{ fontSize: "0.95rem" }}>
                        <strong>IP:</strong> <code style={{ color: "#38bdf8" }}>{pubHost}</code> · <strong>Port:</strong> <code style={{ color: "#38bdf8" }}>{port}</code>
                    </div>
                </div>
            )}
        </div>

        <div style={{ marginTop: 12, fontSize: "0.85rem", color: "var(--text-muted, #94a3b8)", lineHeight: 1.5 }}>
            💡 <strong>{l("Warum geht UPnP auf dem Handy nicht automatisch?", "Why doesn't UPnP work automatically on the phone?")}</strong><br />
            {l(
                "In der FRITZ!Box ist UPnP für Smartphones standardmäßig gesperrt. Damit Freunde über die öffentliche IP joinen können, richte in deiner FRITZ!Box unter „Internet → Freigaben“ eine Portfreigabe für dein Handy ein: UDP Port " + port + " an Port " + port + ".",
                "UPnP is locked for mobile phones by default in most routers. For friends to join via the public IP, add a port forward in your router for your phone: UDP port " + port + " to port " + port + "."
            )}
        </div>

        {!outside && whitelist && (
            <p style={{ marginTop: 10, fontSize: "0.85rem" }}>
                {l("Mit Whitelist: Lass deinen Freund einmal einen Beitritt versuchen. Füge danach unter Spieler seinen Gamertag mit Punkt davor ein (Leerzeichen als Unterstriche).", "With the allowlist on, ask your friend to try joining once. Then add their gamertag under Players, with a dot in front and underscores in place of spaces.")}
            </p>
        )}
    </div>;
}
