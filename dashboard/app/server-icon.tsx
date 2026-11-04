"use client";

import { useRef, useState } from "react";
import { useLanguage } from "./language";

export default function ServerIcon({ serverId, enabled, run }: {
    serverId: string;
    enabled: boolean;
    run: (kind: string, payload: unknown) => Promise<{ queued?: boolean }>;
}) {
    const { t } = useLanguage();
    const picker = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");

    async function upload(file: File) {
        setBusy(true);
        setMessage("");
        try {
            if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
                throw new Error("Wähle ein PNG-, JPG- oder WebP-Bild bis 8 MiB.");
            }
            const bitmap = await createImageBitmap(file).catch(() => { throw new Error("Das Bild konnte nicht geöffnet werden."); });
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 64;
            try {
                const context = canvas.getContext("2d");
                if (!context) throw new Error("Das Bild konnte nicht geöffnet werden.");
                const side = Math.min(bitmap.width, bitmap.height);
                context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 64, 64);
            } finally { bitmap.close(); }
            const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
            if (!png) throw new Error("Das Bild konnte nicht geöffnet werden.");
            const query = new URLSearchParams({ server: serverId, name: "server-icon.png" });
            const response = await fetch("/api/transfers?" + query, { method: "POST", body: png });
            const ticket = await response.json() as { id: string; error?: string };
            if (!response.ok) throw new Error(ticket.error || "Upload fehlgeschlagen.");
            await run("files_uploads", { files: [{ path: "server-icon.png", transferId: ticket.id }], overwrite: true });
            setMessage("Das Icon erscheint beim nächsten Start.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
        } finally { setBusy(false); }
    }

    return <div className="toolbar">
        <input hidden ref={picker} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
        }}/>
        <button type="button" className="btn btn-outline" disabled={!enabled || busy} onClick={() => picker.current?.click()}>
            {t(busy ? "Icon wird hochgeladen …" : "Server-Icon ändern")}
        </button>
        {message && <small role="status">{t(message)}</small>}
    </div>;
}
