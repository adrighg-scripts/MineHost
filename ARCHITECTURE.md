# MineHost — Cross-Platform Architecture & Security Specification (Phase 1–4)

## Phase 1: Systemarchitektur, Ordnerstruktur & Sicherheitskonzept

### 1.1 Architektur-Überblick
MineHost verbindet zwei Welten zu einer einheitlichen Cross-Platform-Plattform:
1. **Cloudflare Edge Control Plane (`dashboard/`)**:
   - Weltweit erreichbares Web-Control-Panel auf **`https://minehost-dashboard.adrilolghg.workers.dev`** (Cloudflare Workers + D1 SQLite + Chunked Blob Storage).
   - Einheitliches React/Next.js (`vinext`) Frontend für Browser, Desktop (Tauri 2.0) und Mobile.
2. **Lokaler Host-Daemon (`host-daemon/` für Windows, Linux/Ubuntu, macOS & `MineHost` APK für Android ARM64)**:
   - Verwaltet den lokalen Minecraft-Server-Prozess (1 aktiver Server pro Profil/Gerät), lädt portable Java-Laufzeiten (Java 8 / 16 / 17 / 21 via Adoptium Temurin API) automatisch herunter und synchronisiert sich verschlüsselt mit dem Web-Panel.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    NUTZER (Webbrowser / Tauri / iOS / Android)          │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ HTTPS / TLS 1.3 (HttpOnly Cookie + CSRF)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│        CLOUDFLARE EDGE CONTROL PANEL (minehost-dashboard.adrilolghg)    │
│  • Auth-System (PBKDF2-SHA256 + Server-Pepper, Sessions, Rate-Limiting) │
│  • Modrinth API v2 & CurseForge Katalog + Auto-Dependency-Planner       │
│  • Job-Queue, Rollen/Mitglieder-Berechtigungen & D1 Blob-Transfers      │
└─────────────────┬───────────────────────────────────┬───────────────────┘
                  │ Bearer Device-Token (SHA-256)     │ Bearer Device-Token
                  ▼                                   ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│   ANDROID ARM64 HOST (MineHost)   │ │ DESKTOP / LINUX HOST (host-daemon)│
│ • Eingebettetes ARM64 OpenJDK 21  │ │ • Windows, Linux (Ubuntu), macOS  │
│ • Paper, Fabric, Vanilla, Pumpkin │ │ • Auto-Java Manager (8/16/17/21)  │
│ • PatchBukkit Native Bridge       │ │ • Paper, Purpur, Folia, Fabric,   │
│ • Lokale Welten & Auto-Backups    │ │   Forge, NeoForge, Quilt, Vanilla │
└───────────────────────────────────┘ └───────────────────────────────────┘
```

### 1.2 Projekt- & Ordnerstruktur
```text
MineHost/
├── ARCHITECTURE.md                  # Systemarchitektur & Sicherheitskonzept (Phase 1–4)
├── README.md                        # Projektübersicht & Schnellstart
├── docs/                            # GitHub Pages Showcase (https://adrighg-scripts.github.io/MineHost/)
│   ├── index.html                   # Interaktiver Showcase & Live-Demo
│   ├── site.css                     # Glassmorphism & Responsive Design
│   └── site.js                      # Interaktive Konsole & Preview-Steuerung
├── dashboard/                       # Cloudflare Worker + D1 Web-Control-Panel
│   ├── app/                         # React/Vinext UI & API-Routen
│   │   ├── dashboard.tsx            # Haupt-Panel (Konsole, Metriken, Schnellbefehle, Filter)
│   │   ├── software.tsx             # Versionswechsel, Java-Runtime-Badge & Downgrade-Schutz
│   │   ├── plugins.tsx              # Modrinth/CurseForge Store & Auto-Kompatibilität
│   │   ├── players.tsx              # Spieler-Avatare, Live-Inventar, 1-Klick OP/Kick/Ban/Whitelist
│   │   ├── files-panel.tsx          # Sandbox-Dateimanager & Config-Editor
│   │   ├── backups-panel.tsx        # 1-Klick-Backups, Zeitpläne & Rollback
│   │   └── network.tsx              # LAN/WAN-IP, Port-Check, Voice-Chat & Domain (A/SRV-Record)
│   ├── lib/
│   │   ├── auth.ts                  # Passwort-Hashing, Pepper, HttpOnly-Sessions & Rate-Limiting
│   │   ├── catalog.ts               # Modrinth API v2 & CurseForge Dependency-Resolver
│   │   ├── control.ts               # D1 Datenbank- & Chunked-Transfer-Engine
│   │   └── permissions.ts           # Granulare Rollen- & Einladungs-Berechtigungen
│   └── drizzle/                     # D1 SQL-Migrationen (0000 bis 0007)
└── host-daemon/                     # Cross-Platform Host-Backend (Windows, Linux/Ubuntu, macOS)
    ├── package.json
    └── src/
        ├── java-manager.ts          # Phase 2: Adoptium Temurin Portable Java 8/16/17/21 Downloader
        ├── software-manager.ts      # Phase 2: Multi-Engine Downloader (Paper, Purpur, Fabric, Vanilla …)
        ├── process-manager.ts       # Phase 2: Prozess-Steuerung, Aikar's Flags & Live-Konsole
        ├── modrinth.ts              # Phase 3: Modrinth v2 Auto-Kompatibilitäts- & Dependency-Prüfer
        └── sandbox-fs.ts            # Phase 4: Strikt gesandboxter Dateimanager (Path-Traversal-Schutz)
```

### 1.3 Verbindliches Sicherheitskonzept
- **Authentifizierung & Session-Schutz**: Passwörter werden mit **PBKDF2-HMAC-SHA256 (210.000 Iterationen)**, individuellem 128-Bit-Salt und serverseitigem `AUTH_PEPPER` (Cloudflare Secret) gehasht. Sessions nutzen kryptografische 256-Bit-Tokens in `HttpOnly; Secure; SameSite=Lax`-Cookies.
- **Brute-Force- & CSRF-Schutz**: Striktes Rate-Limiting (`auth_attempts`-Tabelle nach IP + Benutzername) sowie `Origin`-Validierung auf allen zustandsverändernden Endpunkten.
- **Striktes Sandboxing (Path-Traversal-Schutz)**: Alle Dateioperationen (`files_list`, `files_read`, `files_write`, `files_upload`, `files_delete`) lösen Pfade über `realpath` auf und verweigern jeden Zugriff außerhalb des aktiven Server-Profilverzeichnisses sowie Symlink-Escapes.
- **Automatischer Downgrade-Schutz**: Vor jedem Wechsel der Serversoftware oder Minecraft-Version wird automatisch ein vollständiges Backup der Welt angelegt.
