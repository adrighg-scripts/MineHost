"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "./language";
import "./account-menu.css";

export default function AccountMenu({ account, signOut }: { account: string; signOut: string }) {
    const { t } = useLanguage();
    const menu = useRef<HTMLDetailsElement>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState("");

    return <>
        <details className="account-menu" ref={menu}>
            <summary className="avatar" aria-label={t("Kontomenü")}>{account.slice(0, 1).toUpperCase()}</summary>
            <button className="btn btn-outline account-options" aria-label={t("Optionen")} onClick={() => {
                menu.current?.removeAttribute("open");
                setStatus("");
                dialog.current?.showModal();
            }}>{t("Optionen")}</button>
        </details>
        <dialog ref={dialog} className="server-management-dialog account-dialog" aria-labelledby="account-options-title">
            <div className="section-heading"><div><h2 id="account-options-title">{t("Kontooptionen")}</h2><p>{account}</p></div>
                <button className="tiny" aria-label={t("Schließen")} onClick={() => dialog.current?.close()}><X size={20}/></button></div>
            <form className="account-password" onSubmit={async event => {
                event.preventDefault();
                const form = event.currentTarget;
                const values = new FormData(form);
                if (values.get("newPassword") !== values.get("confirmPassword")) {
                    setStatus("Die neuen Passwörter stimmen nicht überein.");
                    return;
                }
                setBusy(true);
                try {
                    const response = await fetch("/api/auth/password", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ currentPassword: values.get("currentPassword"), newPassword: values.get("newPassword") }),
                    });
                    if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error);
                    form.reset();
                    setStatus("Passwort geändert.");
                } catch (error) {
                    setStatus(error instanceof Error && error.message ? error.message : "Passwort konnte nicht geändert werden.");
                } finally { setBusy(false); }
            }}>
                <label>{t("Aktuelles Passwort")}<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128}/></label>
                <label>{t("Neues Passwort")}<input name="newPassword" type="password" autoComplete="new-password" required minLength={14} maxLength={128}/></label>
                <label>{t("Neues Passwort wiederholen")}<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={14} maxLength={128}/></label>
                <button className="btn btn-blue" disabled={busy}>{t("Passwort ändern")}</button>
            </form>
            {status && <p role="status">{t(status)}</p>}
            <form action={signOut} method="post">
                <button className="btn btn-outline" disabled={busy}>{t("Abmelden")}</button>
            </form>
        </dialog>
    </>;
}
