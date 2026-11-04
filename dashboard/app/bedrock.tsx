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
        {software === "pumpkin" && !available && <p>{l("Aktualisiere MineHost auf dem Handy, um Crossplay einzurichten.", "Update MineHost on the phone to set up crossplay.")}</p>}
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
    const host = (outside ? publicAddress : lan)?.replace(/:\d+$/, "");
    const localIp = lan.replace(/:\d+$/, "");
    const port = state.activePort || state.port;
    return <div className="bedrock-options">
        <strong>{l("Mit Bedrock beitreten", "Join with Bedrock")}</strong>
        {(!state.activePort || state.activePort !== state.port || !state.enabled) && <p>{l("Die gespeicherten Einstellungen gelten nach dem nächsten Start.", "Saved settings apply the next time the server starts.")}</p>}
        {outside && state.enabled && <p>{l(
            `Lege zwei Freigaben auf ${localIp || "die IP deines Handys"} an: TCP ${state.port} und UDP ${state.port}. Verwende innen und außen dieselbe Nummer. Teste danach von einem anderen Netzwerk.`,
            `Forward TCP ${state.port} and UDP ${state.port} to ${localIp || "your phone's IP"}. Use the same port inside and outside. Then test from another network.`)}</p>}
        {host && <p>{l("Bedrock → Spielen → Server → Server hinzufügen:", "Bedrock → Play → Servers → Add Server:")} <strong>{host}</strong> · {l("Port", "Port")} <strong>{port}</strong>{state.version && <> · {state.version}</>}</p>}
        {!outside && whitelist && <p>{l("Mit Whitelist: Lass deinen Freund einmal einen Beitritt versuchen. Füge danach unter Spieler seinen Gamertag mit Punkt davor ein (Leerzeichen als Unterstriche).", "With the allowlist on, ask your friend to try joining once. Then add their gamertag under Players, with a dot in front and underscores in place of spaces.")}</p>}
    </div>;
}
