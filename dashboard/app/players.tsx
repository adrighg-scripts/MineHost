"use client";
import Inventory from "./inventory";
import { useLanguage } from "./language";
import { useEffect, useRef, useState } from "react";
export default function PlayersPanel({ online, running, canCommand, bedrock, run }: {
    online: boolean;
    running: boolean;
    canCommand: boolean;
    bedrock?: boolean;
    run: (kind: string, payload?: any) => Promise<any>;
}) {
    const { t, locale } = useLanguage();
    const [players, setPlayers] = useState<any>({ online: [], whitelist: [] }), [selected, setSelected] = useState(""), [detail, setDetail] = useState<any>(null), [message, setMessage] = useState(""), [name, setName] = useState(""), [command, setCommand] = useState(""), [action, setAction] = useState("kick"), [busy, setBusy] = useState(false);
    const latest = useRef(run);
    latest.current = run;
    useEffect(() => { let stopped = false, timer: ReturnType<typeof setTimeout>; async function refresh() { try {
        if (online && document.visibilityState !== "hidden") {
            const value = await latest.current("players_get");
            if (!stopped)
                setPlayers(value);
        }
    }
    catch (e) {
        if (!stopped)
            setMessage(t(e instanceof Error ? e.message : "Spielerliste nicht verfügbar."));
    }
    finally {
        if (!stopped)
            timer = setTimeout(refresh, 5000);
    } } void refresh(); return () => { stopped = true; clearTimeout(timer); }; }, [online]);
    useEffect(() => { setDetail(null); setMessage(t("")); if (!selected || !running)
        return; let stopped = false, timer: ReturnType<typeof setTimeout>; async function refresh() { try {
        if (document.visibilityState !== "hidden") {
            const value = await latest.current("player_detail", { name: selected });
            if (!stopped) {
                setDetail(value);
                setMessage(t(""));
            }
        }
    }
    catch (e) {
        if (!stopped) {
            setDetail(null);
            setMessage(t(e instanceof Error ? e.message : "Spielerdaten nicht verfügbar."));
        }
    }
    finally {
        if (!stopped)
            timer = setTimeout(refresh, 10000);
    } } void refresh(); return () => { stopped = true; clearTimeout(timer); }; }, [selected, running]);
    async function perform(kind: string, payload: any) { setBusy(true); try {
        const result = await run(kind, payload);
        setMessage(t(result.message));
        setPlayers(await run("players_get"));
    }
    catch (e) {
        setMessage(t(e instanceof Error ? e.message : "Aktion fehlgeschlagen."));
    }
    finally {
        setBusy(false);
    } }
    return <section className="panel"><h2>{t("Spieler")}</h2><p className="muted">{t("Aktualisiert sich automatisch. W\u00E4hle einen Spieler aus.")}</p><div className="player-selection">{players.online.map((player: string) => <button className={`btn ${selected === player ? "btn-blue" : "btn-outline"}`} key={player} onClick={() => setSelected(player)}>{player}</button>)}{!players.online.length && <p>{t("Gerade ist niemand online.")}</p>}</div>{selected && <div className="player-detail"><h3>{selected}</h3>{detail ? <><div className="settings-grid"><div>{t("Leben: ")}{detail.health ?? "—"}</div><div>{t("Hunger: ")}{detail.food ?? "—"}</div><div>{t("Level: ")}{detail.level ?? "—"}</div><div>{t("Spielmodus: ")}{([t("Survival"), t("Kreativ"), t("Abenteuer"), t("Zuschauer")] as string[])[detail.gamemode] || "—"}</div><div>{t("Position: ")}{detail.position?.map((n: number) => n.toFixed(1)).join(t(", ")) || "—"}</div></div><Inventory items={detail.inventory||[]} equipment={detail.equipment||{}}/><Inventory ender items={detail.enderChest||[]}/></> : <p>{message || t("Spielerdaten werden geladen …")}</p>}{canCommand && <form className="inline-form" onSubmit={e => { e.preventDefault(); if (["ban", "op", "deop"].includes(action) && !confirm(t(`${action} für ${selected} ausführen?`)))
        return; void perform("player_action", { name: selected, action, command }); }}><select value={action} onChange={e => setAction(e.target.value)}>{Object.entries({ kick: t("Kicken"), ban: t("Bannen"), op: t("Operator geben"), deop: t("Operator entziehen"), heal: t("Heilen"), survival: t("Survival"), creative: t("Kreativ"), adventure: t("Abenteuer"), spectator: t("Zuschauer"), custom: t("Eigener Befehl") }).map(([key, title]) => <option value={key} key={key}>{t(title)}</option>)}</select>{action === "custom" && <input required value={command} onChange={e => setCommand(e.target.value)} placeholder={t("z. B. give {player} diamond 1")}/>}<button className="btn btn-blue" disabled={!running || busy}>{t("Ausf\u00FChren")}</button></form>}</div>}<p role="status">{t(message)}</p><details><summary>{t("Whitelist verwalten")}</summary><p>{t("Wenn die Whitelist in den Einstellungen eingeschaltet ist, k\u00F6nnen nur die hier eingetragenen Spieler beitreten.")}</p><form className="inline-form" onSubmit={e => { e.preventDefault(); void perform("whitelist_add", { name }); setName(""); }}><input value={name} onChange={e => setName(e.target.value)} placeholder={t("Minecraft-Spielername")} pattern={bedrock ? "[A-Za-z0-9_]{1,16}|[.][A-Za-z0-9_]{1,32}" : "[A-Za-z0-9_]{1,16}"} required/><button className="btn btn-blue" disabled={!running || busy}>{t("Hinzuf\u00FCgen")}</button></form>{players.whitelist.map((player: string) => <div className="player-row" key={player}><span>{player}</span><button className="btn btn-outline compact" disabled={!running || busy} onClick={() => perform("whitelist_remove", { name: player })}>{t("Entfernen")}</button></div>)}</details></section>;
}
