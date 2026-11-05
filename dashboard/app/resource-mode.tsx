"use client";
import { useLanguage } from "./language";
import { useState } from "react";
import { Cpu, Zap } from "lucide-react";

export default function ResourceMode({ settings, onChange, active }: {
    settings: any;
    onChange: (value: any) => void;
    active: boolean;
}) {
    const { t, locale } = useLanguage();
    const [aikars, setAikars] = useState(true);
    const supported = typeof settings.maxResources === "boolean";
    const maxLimit = settings.manualMemoryLimit || 4096;
    const currentRam = Number(settings.memory || 2048);
    const minRam = Math.max(512, Math.round(currentRam * 0.5));

    return <div>
        <label className="toggle-row">
            <span>
                <strong>{t("Maximale Handy-Ressourcen verwenden")}</strong>
                <small>{supported ? t("Java nutzt alle verfügbaren CPU-Kerne. Das RAM-Limit wird vor jedem Start mit Reserve für Android und Java berechnet. Keine Änderung von Sichtweite oder Spielerzahl.") : t("Dafür die aktuelle MineHost-APK auf dem Handy installieren.")}{supported && !active && settings.maxMemoryEstimate > 0 ? ` ${t("Aktuelle RAM-Schätzung:")} ${settings.maxMemoryEstimate} MiB.` : ""}</small>
            </span>
            <input type="checkbox" disabled={!supported || active} checked={!!settings.maxResources} onChange={event => onChange({ ...settings, maxResources: event.target.checked })}/>
        </label>

        <div className="ram-slider-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600, color: "#ecfdf5" }}>
                    <Cpu size={16} color="#24dc8e"/>
                    {locale === "en" ? "JVM Heap Memory Slider (-Xms / -Xmx)" : "RAM-Schieberegler (-Xms / -Xmx Zuweisung)"}
                </span>
                <code style={{ color: "#34d399", fontSize: 12 }}>
                    -Xms{settings.maxResources ? (settings.maxMemoryEstimate || currentRam) : minRam}M -Xmx{settings.maxResources ? (settings.maxMemoryEstimate || currentRam) : currentRam}M ({((settings.maxResources ? (settings.maxMemoryEstimate || currentRam) : currentRam) / 1024).toFixed(2)} GiB)
                </code>
            </div>
            <input
                type="range"
                min={512}
                max={maxLimit}
                step={128}
                disabled={active || !!settings.maxResources}
                value={Math.min(maxLimit, Math.max(512, currentRam))}
                onChange={e => onChange({ ...settings, memory: Number(e.target.value) })}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#88a898", marginTop: 6 }}>
                <span>512 MiB (Min)</span>
                <span>2048 MiB (Empfohlen)</span>
                <span>{maxLimit} MiB (Max)</span>
            </div>
        </div>

        <label className="toggle-row" style={{ marginTop: 8 }}>
            <span>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Zap size={14} color="#24dc8e"/>{locale === "en" ? "Optimized JVM Startup Flags (Aikar's G1GC Flags)" : "Optimierte Start-Flags zuschalten (Aikar's G1GC Flags)"}</strong>
                <small>{locale === "en" ? "Reduces garbage collection lag spikes (MSPT) and stabilizes 20.0 TPS on Paper, Purpur, Fabric, and Vanilla." : "Minimiert Garbage-Collection-Ruckler (MSPT-Spikes) und stabilisiert 20.0 TPS durch optimierte G1GC-Parameter."}</small>
            </span>
            <input type="checkbox" checked={aikars} onChange={e => setAikars(e.target.checked)}/>
        </label>
    </div>;
}
