"use client";
import { useLanguage } from "./language";
import { useEffect, useState, type ReactNode } from "react";
export default function Invitation({ children }: {
    children: ReactNode;
}) {
    const { t, locale } = useLanguage();
    const [token, setToken] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
    useEffect(() => { const value = new URLSearchParams(window.location.hash.slice(1)).get("invite"); if (value && /^[a-f0-9]{64}$/.test(value))
        setToken(value); }, []);
    async function accept() { setBusy(true); try {
        const response = await fetch("/api/members/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
        const data: any = await response.json();
        if (!response.ok)
            throw new Error(data.error);
        window.location.replace("/?server=" + encodeURIComponent(data.server));
    }
    catch (error) {
        setMessage(t(error instanceof Error ? error.message : "Einladung fehlgeschlagen."));
    }
    finally {
        setBusy(false);
    } }
    return <>{children}{token && <div className="invite-overlay"><section className="panel"><h2>{t("Server-Einladung")}</h2><p>{t("Du erh\u00E4ltst nur die Rechte, die der Besitzer ausgew\u00E4hlt hat.")}</p><p role="status">{t(message)}</p><button className="btn btn-blue" disabled={busy} onClick={accept}>{t("Einladung annehmen")}</button><button className="btn btn-outline" onClick={() => { setToken(""); window.history.replaceState(null, "", window.location.pathname + window.location.search); }}>{t("Schlie\u00DFen")}</button></section></div>}</>;
}
