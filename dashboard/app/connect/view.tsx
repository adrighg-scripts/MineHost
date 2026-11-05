"use client";
import { useEffect, useRef, useState } from "react";
import { Server, CheckCircle2, LoaderCircle } from "lucide-react";
import { LanguageMenu, useLanguage } from "../language";
import "../login.css";

export default function ConnectDevice({ account }: { account: string }) {
    const { locale, t } = useLanguage();
    const l = (de: string, en: string) => locale === "de" ? de : en;
    const [code, setCode] = useState(""), [server, setServer] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
    const autoStarted = useRef(false);

    useEffect(() => {
        const value = new URLSearchParams(window.location.hash.slice(1)).get("device");
        if (value && /^[a-f0-9]{48}$/.test(value)) setCode(value);
    }, []);

    async function connect(targetCode = code) {
        if (!targetCode || busy) return;
        setBusy(true);
        setError("");
        try {
            const response = await fetch("/api/link/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: targetCode }),
            });
            const value: any = await response.json();
            if (!response.ok) throw new Error(value.error);
            setServer(value.server);
        } catch (e) {
            setError(e instanceof Error ? e.message : l("Verknüpfung fehlgeschlagen.", "Linking failed."));
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        if (code && !server && !autoStarted.current) {
            autoStarted.current = true;
            void connect(code);
        }
    }, [code, server]);

    useEffect(() => {
        if (!server) return;
        let ended = false, timer: ReturnType<typeof setTimeout>;
        async function check() {
            try {
                const response = await fetch("/api/state?server=" + server, { cache: "no-store" });
                const value: any = await response.json();
                if (!ended && value.device?.online) {
                    window.location.replace("/?server=" + server + "&setup=1");
                    return;
                }
            } catch {}
            if (!ended) timer = setTimeout(check, 800);
        }
        void check();
        return () => { ended = true; clearTimeout(timer); };
    }, [server]);

    return <main className="login-page">
        <section className="login-card">
            <LanguageMenu />
            <div className="brand">
                <span className="brand-mark"><Server size={24}/></span>
                <span>{t("MineHost")}<small>{t("SERVER CONTROL")}</small></span>
            </div>
            <h1>{l("Server-Host verbinden", "Link Server Host")}</h1>
            <p>{l("Angemeldet als", "Signed in as")} <strong>{account}</strong></p>
            {server ? <>
                <div className="notice" style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                    <CheckCircle2 size={18} />
                    <span>{l("Host verknüpft! Verbinde automatisch im Hintergrund …", "Host linked! Connecting automatically in the background …")}</span>
                </div>
                <p>{l("Sobald dein Host online meldet, öffnet sich das Dashboard vollautomatisch.", "As soon as your host reports online, the dashboard opens automatically.")}</p>
                <a className="btn btn-blue" href={"/?server=" + server + "&setup=1"}>{l("Direkt zum Dashboard öffnen", "Open dashboard directly")}</a>
            </> : code ? <>
                <p>{l("Verbinde deinen Server-Host automatisch mit diesem Konto …", "Linking your server host to this account …")}</p>
                <button className="btn btn-blue" disabled={busy} onClick={() => void connect(code)}>
                    {busy ? <><LoaderCircle size={16} className="spin" /> {l("Wird automatisch verbunden …", "Linking automatically …")}</> : l("Dieses Handy verbinden", "Link this phone")}
                </button>
            </> : <p>{l("Öffne den Einrichtungslink aus deiner MineHost-App (Android, Windows oder Linux).", "Open the setup link from your MineHost app (Android, Windows, or Linux).")}</p>}
            {error && <p className="login-error">{error}</p>}
        </section>
    </main>;
}
