"use client";
import { useLanguage } from "./language";
import { LanguageMenu } from "./language";
import { useState, type FormEvent } from "react";
import { Server, LockKeyhole } from "lucide-react";
import "./login.css";
export default function Login({connectingDevice=false}:{connectingDevice?:boolean}) {
    const { t } = useLanguage();
    const [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const [register, setRegister] = useState(false);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
            const username = String(form.get("username") ?? "").trim();
            const password = String(form.get("password") ?? "");
            if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
                throw new Error("Benutzername muss 3–32 Zeichen haben (Buchstaben, Zahlen, . _ -).");
            }
            if (register && password.length < 14) {
                throw new Error("Verwende ein eigenes Passwort mit mindestens 14 Zeichen.");
            }
            const credentials = { username, password };
            if (register) {
                const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials) });
                const result: any = await response.json();
                if (!response.ok)
                    throw new Error(result.error);
            }
            const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials) });
            const result: any = await response.json();
            if (!response.ok)
                throw new Error(result.error);
            if (connectingDevice) window.location.replace("/connect" + window.location.hash);
            else window.location.reload();
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.");
        }
        finally {
            setBusy(false);
        }
    }
    return <main className="login-page"><section className="login-card"><LanguageMenu /><div className="brand"><span className="brand-mark"><Server size={24}/></span><span>{t("MineHost")}<small>{t("SERVER CONTROL")}</small></span></div><h1>{register ? t("Konto erstellen") : t("Anmelden")}</h1><p>{t("Verwalte deinen Minecraft-Server von \u00FCberall.")}</p><form onSubmit={submit}><label>{t("Benutzername")}<input name="username" autoComplete="username" required minLength={3} maxLength={32} autoCapitalize="none" spellCheck={false}/></label><label>{t("Passwort")}<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 14 : undefined} maxLength={128}/></label>{register && <p>{t("Verwende ein eigenes Passwort mit mindestens 14 Zeichen.")}</p>}{error && <p role="alert" className="login-error">{t(error)}</p>}<button className="btn btn-blue" disabled={busy}>{busy ? t("Bitte warten …") : register ? t("Konto erstellen") : t("Anmelden")}</button><button type="button" className="btn btn-outline" onClick={() => { setRegister(!register); setError(""); }}>{register ? t("Ich habe schon ein Konto") : connectingDevice ? t("Konto erstellen") : t("Konto für Einladung erstellen")}</button></form><div className="login-help"><LockKeyhole size={16}/><p>{t("Eigener Server: MineHost installieren → „Einrichtung starten“. Erstelle hier dein Konto und verbinde dein Handy. Eingeladene Freunde brauchen nur ihr Konto und die Einladung.")}</p></div></section></main>;
}
