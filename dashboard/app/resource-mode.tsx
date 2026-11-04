"use client";
import { useLanguage } from "./language";
export default function ResourceMode({ settings, onChange, active }: {
    settings: any;
    onChange: (value: any) => void;
    active: boolean;
}) {
    const { t, locale } = useLanguage();
    const supported = typeof settings.maxResources === "boolean";
    return <label className="toggle-row"><span><strong>{t("Maximale Handy-Ressourcen verwenden")}</strong><small>{supported ? t("Java nutzt alle verfügbaren CPU-Kerne. Das RAM-Limit wird vor jedem Start mit Reserve für Android und Java berechnet. Keine Änderung von Sichtweite oder Spielerzahl.") : t("Dafür die aktuelle MineHost-APK auf dem Handy installieren.")}{supported && !active && settings.maxMemoryEstimate > 0 ? ` ${t("Aktuelle RAM-Schätzung:")} ${settings.maxMemoryEstimate} MiB.` : ""}</small></span><input type="checkbox" disabled={!supported || active} checked={!!settings.maxResources} onChange={event => onChange({ ...settings, maxResources: event.target.checked })}/></label>;
}
