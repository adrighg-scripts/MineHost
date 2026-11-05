# MineHost — Cross-Platform Self-Hosted Minecraft Server Platform

Host a dedicated Minecraft Java & Crossplay server on **Android (ARM64)**, **Windows 10/11**, or **Linux / Ubuntu**—and manage everything in real time from any browser or **iOS Web-App**.

[**Android (.apk)**](https://github.com/adrighg-scripts/MineHost/releases/latest/download/MineHost.apk) · [**Windows (.zip)**](https://github.com/adrighg-scripts/MineHost/releases/latest/download/MineHost_Windows.zip) · [**Linux / Ubuntu (.zip)**](https://github.com/adrighg-scripts/MineHost/releases/latest/download/MineHost_Linux.zip) · [**Web & iOS Dashboard**](https://minehost-dashboard.adrilolghg.workers.dev/) · [**Showcase & Setup Guide**](https://adrighg-scripts.github.io/MineHost/)

---

## Supported Platforms

1. **Android (ARM64 APK)**: Install `MineHost.apk` on Android 8+ with an ARM64 processor. Bundled with OpenJDK 25 & native Rust Pumpkin runtime.
2. **Windows 10 / 11 (x64)**: Download `MineHost_Windows.zip`, extract, and double-click `Start-MineHost-Windows.bat`. Automatically bootstraps portable Node.js 22 LTS and Adoptium Temurin Java (8, 16, 17, 21) without manual installation.
3. **Linux / Ubuntu / Debian (x64 & ARM64)**: Download `MineHost_Linux.zip`, extract, and run `./start-minehost-linux.sh`. Starts the local Web Panel (`http://localhost:8787`) and syncs with the remote Web Dashboard.
4. **iOS (iPhone & iPad) & Web Browser**: Open [`https://minehost-dashboard.adrilolghg.workers.dev/`](https://minehost-dashboard.adrilolghg.workers.dev/) in Safari and tap **Share → Add to Home Screen** to install MineHost as a full-screen iOS App for remote server control.

---

## Core Architecture & Features

- **16 Server Softwares (Versions 1.0 to Latest)**:
  - **Plugin Servers**: `PaperMC`, `Purpur`, `Folia`, `Spigot`, `Bukkit`
  - **Mod Servers**: `Fabric`, `Forge`, `NeoForge`, `Quilt`
  - **Official Mojang**: `Vanilla` Releases & Weekly Snapshots (`1.0` to latest)
  - **Proxies, Hybrids & Native**: `Velocity`, `BungeeCord`, `Waterfall`, `Mohist`, `Arclight`, `Pumpkin` (Native Rust + Bedrock Crossplay)
- **Automatic Portable Java Manager**: Automatically downloads and assigns the required portable Java version via the Adoptium Temurin API (`Java 8` for `<=1.16.5`, `Java 16` for `1.17`, `Java 17` for `1.18–1.20.4`, `Java 21/25` for `1.20.5+`).
- **Integrated Modrinth Store & Auto-Compatibility Check**: Browse and install plugins/mods via Modrinth API v2 with automatic version & loader validation when switching Minecraft versions.
- **Live Telemetry & Resource Controls**: Real-time rolling SVG graphs for **CPU %**, **RAM (MB/GB)**, and **TPS / MSPT**, interactive RAM allocation slider (`-Xms` / `-Xmx`), and 1-click **Aikar's G1GC Flags** toggle.
- **Sandboxed File Manager & Config Validator**: Path-traversal protected file explorer with upload, `.zip` extraction (`files_unzip`), and live syntax validation for JSON, YAML, and `server.properties`.
- **Graphical Player & World Management**: Live player list with 3D Minecraft skin avatars, NBT inventory & Ender Chest viewer, 1-click `OP`, `De-OP`, `Kick`, `Ban`, `Pardon`, and Whitelist Manager.
- **Network, UPnP & Custom Domain**: Local LAN IP, Public WAN IP, Port status indicator, **1-Click UPnP Port Forwarding (25565)**, and **Custom Domain (`A-Record` & `SRV-Record`)** configurator.

---

## Repository Structure

- [`dashboard/`](dashboard/) — React Server Components + Cloudflare Workers Web Control Panel (`https://minehost-dashboard.adrilolghg.workers.dev/`).
- [`host-daemon/`](host-daemon/) — Cross-Platform Host Daemon for Windows, Linux/Ubuntu, and macOS with Portable Java Manager, Modrinth API v2, Sandboxed FS, and UPnP.
- [`docs/`](docs/) — Showcase website and interactive preview deployed to GitHub Pages (`https://adrighg-scripts.github.io/MineHost/`).
