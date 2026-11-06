"use client";
import Inventory from "./inventory";
import { useLanguage } from "./language";
import { useEffect, useRef, useState } from "react";
import { Shield, Heart, Zap, UserMinus, Ban, RotateCcw } from "lucide-react";

function PlayerAvatar({ name, size = 24 }: { name: string; size?: number }) {
    const clean = name.replace(/^[\.*]/, "").trim();
    return <img
        src={`https://mc-heads.net/avatar/${encodeURIComponent(clean)}/${size}`}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 6, imageRendering: "pixelated", flexShrink: 0, background: "#14221b" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />;
}

export default function PlayersPanel({ online, running, canCommand, bedrock, run }: {
    online: boolean;
    running: boolean;
    canCommand: boolean;
    bedrock?: boolean;
    run: (kind: string, payload?: any) => Promise<any>;
}) {
    const { t } = useLanguage();
    const [players, setPlayers] = useState<any>({ online: [], whitelist: [] }), [selected, setSelected] = useState(""), [detail, setDetail] = useState<any>(null), [message, setMessage] = useState(""), [name, setName] = useState(""), [pardonName, setPardonName] = useState(""), [command, setCommand] = useState(""), [action, setAction] = useState("kick"), [busy, setBusy] = useState(false);
    const latest = useRef(run);
    latest.current = run;
    useEffect(() => {
        let stopped = false, timer: ReturnType<typeof setTimeout>;
        async function refresh() {
            try {
                if (online && document.visibilityState !== "hidden") {
                    const value = await latest.current("players_get");
                    if (!stopped && value) {
                        setPlayers(value);
                        if (Array.isArray(value.online) && value.online.length > 0) {
                            setSelected(prev => prev && value.online.includes(prev) ? prev : value.online[0]);
                        }
                    }
                }
            } catch (e) {
                if (!stopped) setMessage(t(e instanceof Error ? e.message : "Spielerliste nicht verfügbar."));
            } finally {
                if (!stopped) timer = setTimeout(refresh, 5000);
            }
        }
        void refresh();
        return () => { stopped = true; clearTimeout(timer); };
    }, [online]);
    useEffect(() => {
        setDetail(null); setMessage(t(""));
        if (!selected || !running) return;
        let stopped = false, timer: ReturnType<typeof setTimeout>;
        async function refresh() {
            try {
                if (document.visibilityState !== "hidden") {
                    const value = await latest.current("player_detail", { name: selected });
                    if (!stopped) {
                        setDetail(value);
                        setMessage(t(""));
                    }
                }
            } catch (e) {
                if (!stopped) {
                    setDetail(null);
                    setMessage(t(e instanceof Error ? e.message : "Spielerdaten nicht verfügbar."));
                }
            } finally {
                if (!stopped) timer = setTimeout(refresh, 10000);
            }
        }
        void refresh();
        return () => { stopped = true; clearTimeout(timer); };
    }, [selected, running]);
    async function perform(kind: string, payload: any) {
        setBusy(true);
        try {
            const result = await run(kind, payload);
            setMessage(t(result.message));
            setPlayers(await run("players_get"));
        } catch (e) {
            setMessage(t(e instanceof Error ? e.message : "Aktion fehlgeschlagen."));
        } finally {
            setBusy(false);
        }
    }
    return <section className="panel">
        <h2>{t("Spieler")}</h2>
        <p className="muted">{t("Aktualisiert sich automatisch. W\u00E4hle einen Spieler aus.")}</p>
        <div className="player-selection">
            {players.online.map((player: string) => {
                const isBedrock = player.startsWith(".") || player.startsWith("*");
                return (
                    <button className={`btn ${selected === player ? "btn-blue" : "btn-outline"}`} key={player} onClick={() => setSelected(player)} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <PlayerAvatar name={player} size={22}/>
                        <span>{player}</span>
                        {isBedrock && <span style={{ fontSize: "0.72rem", background: "rgba(16,185,129,0.2)", color: "#34d399", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Bedrock</span>}
                    </button>
                );
            })}
            {!players.online.length && <p>{t("Gerade ist niemand online.")}</p>}
        </div>
        {selected && <div className="player-detail">
            <h3 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PlayerAvatar name={selected} size={32}/>
                <span>{selected}</span>
                {(selected.startsWith(".") || selected.startsWith("*")) && (
                    <span style={{ fontSize: "0.8rem", background: "rgba(16,185,129,0.2)", color: "#34d399", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
                        Bedrock Crossplay
                    </span>
                )}
            </h3>
            {canCommand && <div className="quick-actions-row">
                <button type="button" className="btn btn-outline compact" disabled={!running || busy} onClick={() => { if (confirm(t(`op für ${selected} ausführen?`))) void perform("player_action", { name: selected, action: "op", command: "" }); }}><Shield size={14}/>OP</button>
                <button type="button" className="btn btn-outline compact" disabled={!running || busy} onClick={() => { if (confirm(t(`deop für ${selected} ausführen?`))) void perform("player_action", { name: selected, action: "deop", command: "" }); }}>De-OP</button>
                <button type="button" className="btn btn-outline compact" disabled={!running || busy} onClick={() => void perform("player_action", { name: selected, action: "heal", command: "" })}><Heart size={14}/>{t("Heilen")}</button>
                <button type="button" className="btn btn-outline compact" disabled={!running || busy} onClick={() => void perform("player_action", { name: selected, action: "creative", command: "" })}><Zap size={14}/>{t("Kreativ")}</button>
                <button type="button" className="btn btn-outline compact" disabled={!running || busy} onClick={() => void perform("player_action", { name: selected, action: "survival", command: "" })}>{t("Survival")}</button>
                <button type="button" className="btn btn-outline compact" disabled={!running || busy} onClick={() => void perform("player_action", { name: selected, action: "kick", command: "" })}><UserMinus size={14}/>{t("Kicken")}</button>
                <button type="button" className="btn btn-red compact" disabled={!running || busy} onClick={() => { if (confirm(t(`ban für ${selected} ausführen?`))) void perform("player_action", { name: selected, action: "ban", command: "" }); }}><Ban size={14}/>{t("Bannen")}</button>
                <button type="button" className="btn btn-outline compact" disabled={!running || busy} onClick={() => void perform("console", { command: `pardon ${selected}` })}><RotateCcw size={14}/>Pardon (Entbannen)</button>
            </div>}
            {detail ? <>
                <div className="settings-grid">
                    <div>{t("Leben: ")}{detail.health ?? "—"}</div>
                    <div>{t("Hunger: ")}{detail.food ?? "—"}</div>
                    <div>{t("Level: ")}{detail.level ?? "—"}</div>
                    <div>{t("Spielmodus: ")}{([t("Survival"), t("Kreativ"), t("Abenteuer"), t("Zuschauer")] as string[])[detail.gamemode] || "—"}</div>
                    <div>{t("Position: ")}{detail.position?.map((n: number) => n.toFixed(1)).join(t(", ")) || "—"}</div>
                </div>
                <Inventory items={detail.inventory || []} equipment={detail.equipment || {}}/>
                <Inventory ender items={detail.enderChest || []}/>
            </> : (selected.startsWith(".") || selected.startsWith("*")) ? (
                <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: 6, padding: "12px 14px", margin: "10px 0" }}>
                    <p style={{ margin: 0, color: "#6ee7b7", fontWeight: 600 }}>
                        🎮 {selected} ist über Minecraft Bedrock online
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                        Bedrock-Spieler sind live auf dem Server. Alle Spieler-Befehle (OP, Heilen, Spielmodus, Kicken, Bannen) funktionieren direkt über die Buttons oben und das Formular unten!
                    </p>
                </div>
            ) : <p>{message || t("Spielerdaten werden geladen …")}</p>}
            {canCommand && <form className="inline-form" onSubmit={e => { e.preventDefault(); if (["ban", "op", "deop"].includes(action) && !confirm(t(`${action} für ${selected} ausführen?`))) return; void perform("player_action", { name: selected, action, command }); }}>
                <select value={action} onChange={e => setAction(e.target.value)}>
                    {Object.entries({ kick: t("Kicken"), ban: t("Bannen"), op: t("Operator geben"), deop: t("Operator entziehen"), heal: t("Heilen"), survival: t("Survival"), creative: t("Kreativ"), adventure: t("Abenteuer"), spectator: t("Zuschauer"), custom: t("Eigener Befehl") }).map(([key, title]) => <option value={key} key={key}>{t(title)}</option>)}
                </select>
                {action === "custom" && <input required value={command} onChange={e => setCommand(e.target.value)} placeholder={t("z. B. give {player} diamond 1")}/>}
                <button className="btn btn-blue" disabled={!running || busy}>{t("Ausf\u00FChren")}</button>
            </form>}
        </div>}
        <p role="status">{t(message)}</p>
        <details><summary>{t("Whitelist verwalten")} ({players.whitelist?.length || 0})</summary>
            <p>{t("Wenn die Whitelist in den Einstellungen eingeschaltet ist, k\u00F6nnen nur die hier eingetragenen Spieler beitreten.")}</p>
            <form className="inline-form" onSubmit={e => { e.preventDefault(); void perform("whitelist_add", { name }); setName(""); }}>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={t("Minecraft-Spielername (z. B. .BedrockName)")} pattern={bedrock ? "[A-Za-z0-9_]{1,16}|[.*][A-Za-z0-9_ ]{1,32}" : "[A-Za-z0-9_]{1,16}"} required/>
                <button className="btn btn-blue" disabled={!running || busy}>{t("Hinzuf\u00FCgen")}</button>
            </form>
            {players.whitelist.map((player: string) => <div className="player-row" key={player}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><PlayerAvatar name={player} size={20}/>{player}</span>
                <button className="btn btn-outline compact" disabled={!running || busy} onClick={() => perform("whitelist_remove", { name: player })}>{t("Entfernen")}</button>
            </div>)}
        </details>
        {canCommand && <details><summary>Gebannte Spieler entbannen (Pardon)</summary>
            <p>Gib den Namen eines gebannten Spielers ein, um die Sperre (Ban) aufzuheben:</p>
            <form className="inline-form" onSubmit={e => { e.preventDefault(); if (!pardonName.trim()) return; void perform("console", { command: `pardon ${pardonName.trim()}` }); setPardonName(""); }}>
                <input value={pardonName} onChange={e => setPardonName(e.target.value)} placeholder="Spielername zum Entbannen" required/>
                <button className="btn btn-outline" disabled={!running || busy}><RotateCcw size={14}/>Pardon ausführen</button>
            </form>
        </details>}
    </section>;
}
