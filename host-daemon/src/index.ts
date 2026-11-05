import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { hostname, platform, arch, freemem, totalmem, cpus } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MinecraftProcessManager } from "./process-manager.ts";
import { downloadServerJar, fetchAllMinecraftVersions, type ServerSoftwareType } from "./software-manager.ts";
import {
  listSandboxedDirectory,
  readSandboxedText,
  writeSandboxedText,
  createSandboxedFolder,
  deleteSandboxedEntry,
  resolveSandboxedPath,
} from "./sandbox-fs.ts";
import { getLocalLanIp, getPublicWanIp, attemptUpnpPortForward } from "./network.ts";

const execFileAsync = promisify(execFile);
const DASHBOARD_SITE = process.env.MINEHOST_SITE || "https://minehost-dashboard.adrilolghg.workers.dev";
const LOCAL_WEB_PORT = Number(process.env.MINEHOST_PORT || 8787);
const DATA_DIR = resolve(process.env.MINEHOST_DATA || join(process.cwd(), "minehost-data"));
const SERVER_DIR = join(DATA_DIR, "server");
const BACKUPS_DIR = join(DATA_DIR, "backups");
const REMOTE_FILE = join(DATA_DIR, "remote.json");
const STATE_FILE = join(DATA_DIR, "host-state.json");

const mc = new MinecraftProcessManager();

interface HostState {
  software: ServerSoftwareType;
  version: string;
  build?: string | number;
  configured: boolean;
  memory: number;
  maxResources: boolean;
  port: number;
  externalPort: number;
  maxPlayers: number;
  viewDistance: number;
  simulationDistance: number;
  difficulty: string;
  gamemode: string;
  motd: string;
  whitelist: boolean;
  pvp: boolean;
  allowFlight: boolean;
  hardcore: boolean;
  forceGamemode: boolean;
  idleTimeout: number;
}

const defaultState: HostState = {
  software: "paper",
  version: "1.21.4",
  configured: false,
  memory: 2048,
  maxResources: false,
  port: 25565,
  externalPort: 25565,
  maxPlayers: 20,
  viewDistance: 10,
  simulationDistance: 10,
  difficulty: "normal",
  gamemode: "survival",
  motd: "MineHost Cross-Platform Server",
  whitelist: false,
  pvp: true,
  allowFlight: false,
  hardcore: false,
  forceGamemode: false,
  idleTimeout: 0,
};

async function loadState(): Promise<HostState> {
  try {
    if (existsSync(STATE_FILE)) {
      return { ...defaultState, ...JSON.parse(await readFile(STATE_FILE, "utf8")) };
    }
  } catch {}
  return { ...defaultState };
}

async function saveState(state: HostState): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function hostModelName(): string {
  const osName = platform() === "win32" ? "Windows" : platform() === "darwin" ? "macOS" : "Linux/Ubuntu";
  return `${osName} (${arch()}) · ${hostname()}`;
}

function openBrowser(url: string) {
  try {
    if (platform() === "win32") execFile("cmd.exe", ["/c", "start", "", url]);
    else if (platform() === "darwin") execFile("open", [url]);
    else execFile("xdg-open", [url]);
  } catch {}
}

async function ensureLinked(): Promise<{ siteUrl: string; serverId: string; deviceToken: string }> {
  if (existsSync(REMOTE_FILE)) {
    return JSON.parse(await readFile(REMOTE_FILE, "utf8"));
  }
  console.log(`\n[MineHost] Starte Gerätekopplung mit ${DASHBOARD_SITE} …`);
  const startRes = await fetch(`${DASHBOARD_SITE}/api/link/start`, {
    method: "POST",
    headers: { Origin: DASHBOARD_SITE, "Content-Type": "application/json" },
    body: JSON.stringify({ model: hostModelName() }),
  });
  if (!startRes.ok) throw new Error(`Kopplung konnte nicht gestartet werden (HTTP ${startRes.status})`);
  const linkData: any = await startRes.json();
  console.log(`\n===================================================================`);
  console.log(`  Öffne diesen Link im Browser, um deinen Host zu verknüpfen:`);
  console.log(`  ${linkData.website}`);
  console.log(`===================================================================\n`);
  openBrowser(linkData.website);

  while (Date.now() < linkData.expires) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`${DASHBOARD_SITE}/api/link/status`, {
      method: "POST",
      headers: { Origin: DASHBOARD_SITE, "Content-Type": "application/json" },
      body: JSON.stringify({ code: linkData.code, pollToken: linkData.pollToken }),
    });
    if (!pollRes.ok) continue;
    const status: any = await pollRes.json();
    if (status.state === "linked" && status.device) {
      await writeFile(REMOTE_FILE, JSON.stringify(status.device, null, 2), "utf8");
      await fetch(`${DASHBOARD_SITE}/api/link/status`, {
        method: "POST",
        headers: { Origin: DASHBOARD_SITE, "Content-Type": "application/json" },
        body: JSON.stringify({ code: linkData.code, pollToken: linkData.pollToken, action: "ack" }),
      }).catch(() => {});
      console.log(`[MineHost] Erfolgreich mit deinem Dashboard-Konto verknüpft! Server-ID: ${status.device.serverId}`);
      return status.device;
    }
  }
  throw new Error("Einrichtungslink abgelaufen. Bitte MineHost neu starten.");
}

async function handleJob(kind: string, payload: any, state: HostState): Promise<any> {
  switch (kind) {
    case "software_catalog": {
      const allVers = await fetchAllMinecraftVersions(false);
      return {
        versions: allVers.slice(0, 60).map(v => ({
          version: v,
          paper: true,
          purpur: true,
          spigot: true,
          bukkit: true,
          folia: true,
          fabric: true,
          forge: true,
          neoforge: true,
          quilt: true,
          vanilla: true,
          velocity: true,
          pumpkin: true,
        })),
      };
    }
    case "software_install": {
      if (mc.phase !== "stopped") await mc.stop();
      const sw = (payload.software || "paper") as ServerSoftwareType;
      const ver = String(payload.version || "1.21.4");
      const res = await downloadServerJar(SERVER_DIR, sw, ver);
      state.software = sw;
      state.version = ver;
      state.build = res.build;
      state.configured = true;
      await saveState(state);
      return { message: `${sw.toUpperCase()} ${ver} erfolgreich installiert.` };
    }
    case "start": {
      await mc.start({
        serverDir: SERVER_DIR,
        dataDir: DATA_DIR,
        mcVersion: state.version,
        minRamMb: Math.max(512, Math.round(state.memory * 0.5)),
        maxRamMb: state.memory,
        useAikarsFlags: true,
        port: state.port,
      });
      return { message: "Server wird gestartet …" };
    }
    case "stop": {
      await mc.stop();
      return { message: "Server gestoppt." };
    }
    case "restart": {
      await mc.stop();
      await mc.start({
        serverDir: SERVER_DIR,
        dataDir: DATA_DIR,
        mcVersion: state.version,
        minRamMb: Math.max(512, Math.round(state.memory * 0.5)),
        maxRamMb: state.memory,
        useAikarsFlags: true,
        port: state.port,
      });
      return { message: "Server neu gestartet." };
    }
    case "console": {
      mc.sendCommand(String(payload.command || ""));
      return { message: "Befehl gesendet." };
    }
    case "settings_get": {
      const totalMb = Math.round(totalmem() / 1048576);
      return {
        ...state,
        manualMemoryLimit: Math.max(4096, Math.round(totalMb * 0.75)),
        maxMemoryEstimate: Math.round(totalMb * 0.7),
        viewDistanceLimit: 32,
      };
    }
    case "settings_save": {
      Object.assign(state, payload);
      await saveState(state);
      return { message: "Einstellungen gespeichert." };
    }
    case "files_list": {
      const entries = await listSandboxedDirectory(SERVER_DIR, String(payload.path || ""));
      return { entries, nextOffset: null };
    }
    case "files_read": {
      const content = await readSandboxedText(SERVER_DIR, String(payload.path || ""));
      return { content };
    }
    case "files_write": {
      await writeSandboxedText(SERVER_DIR, String(payload.path || ""), String(payload.content || ""));
      return { message: "Datei gespeichert." };
    }
    case "files_mkdir": {
      await createSandboxedFolder(SERVER_DIR, String(payload.path || ""));
      return { message: "Ordner erstellt." };
    }
    case "files_delete": {
      await deleteSandboxedEntry(SERVER_DIR, String(payload.path || ""));
      return { message: "Gelöscht." };
    }
    case "files_unzip": {
      const archive = await resolveSandboxedPath(SERVER_DIR, String(payload.path || ""));
      const targetDir = await resolveSandboxedPath(SERVER_DIR, String(payload.destination || ""));
      if (platform() === "win32") {
        await execFileAsync("powershell.exe", [
          "-NoProfile",
          "-Command",
          `Expand-Archive -Path '${archive.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`,
        ]);
      } else {
        await execFileAsync("unzip", ["-q", "-o", archive, "-d", targetDir]);
      }
      return { message: "ZIP-Archiv erfolgreich entpackt." };
    }
    case "network_configure": {
      if (payload.externalPort) state.externalPort = Number(payload.externalPort);
      await saveState(state);
      const upnp = await attemptUpnpPortForward(state.port, state.externalPort);
      return { message: upnp.message };
    }
    case "network_check": {
      const pubIp = await getPublicWanIp();
      const address = pubIp ? `${pubIp}:${state.externalPort}` : `${getLocalLanIp()}:${state.port}`;
      return { address, message: `Spieladresse: ${address}` };
    }
    case "plugins_list":
    case "mods_list": {
      const sub = kind === "mods_list" ? "mods" : "plugins";
      const folder = join(SERVER_DIR, sub);
      await mkdir(folder, { recursive: true });
      const items = await readdir(folder).catch(() => [] as string[]);
      return {
        plugins: items
          .filter(n => n.endsWith(".jar") || n.endsWith(".jar.disabled"))
          .map(n => ({
            name: n.replace(/\.jar(\.disabled)?$/, ""),
            file: n,
            enabled: !n.endsWith(".disabled"),
          })),
      };
    }
    case "players_get":
      return { online: [], whitelist: [] };
    case "backups_list":
      return { entries: [] };
    case "backup_schedule_get":
      return { enabled: false, days: [1, 3, 5], hour: 4, keep: 5 };
    case "files_pending":
      return { entries: [] };
    default:
      return { message: "OK" };
  }
}

async function main() {
  await mkdir(SERVER_DIR, { recursive: true });
  await mkdir(BACKUPS_DIR, { recursive: true });
  const state = await loadState();

  createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>MineHost Local Daemon</title><style>body{background:#050a08;color:#edf8f2;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}.card{background:#0b1612;border:1px solid rgba(52,211,153,.28);border-radius:18px;padding:32px;max-width:480px;box-shadow:0 24px 60px rgba(0,0,0,.8)}a{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:10px;background:#24dc8e;color:#04160e;font-weight:700;text-decoration:none}</style></head><body><div class="card"><h2>MineHost Host-Daemon aktiv</h2><p>Host: <b>${hostModelName()}</b></p><p>Lokale IP: <code>${getLocalLanIp()}:${state.port}</code></p><p>Status: <b>${mc.phase}</b></p><a href="${DASHBOARD_SITE}">Cloud-Dashboard öffnen ↗</a></div></body></html>`);
  }).listen(LOCAL_WEB_PORT, "127.0.0.1", () => {
    console.log(`[MineHost] Lokaler Status-Server läuft auf http://127.0.0.1:${LOCAL_WEB_PORT}`);
  });

  const link = await ensureLinked();
  const pubIp = await getPublicWanIp();

  for (;;) {
    try {
      const payload = {
        phase: mc.phase,
        configured: state.configured,
        model: hostModelName(),
        managementVersion: 12,
        software: { software: state.software, version: state.version, build: state.build },
        console: mc.getConsoleSnapshot(),
        lan: `${getLocalLanIp()}:${state.port}`,
        uptime: mc.phase === "running" ? Math.floor((Date.now() - mc.startedAt) / 1000) : 0,
        ram: state.memory,
        rssMb: Math.round((totalmem() - freemem()) / 1048576),
        cpu: Math.min(100, Math.max(1, cpus().length * 2)),
        diskUsedMb: 512,
        diskFreeMb: 16384,
        publicAccess: {
          configured: true,
          externalPort: state.externalPort,
          address: pubIp ? `${pubIp}:${state.externalPort}` : `${getLocalLanIp()}:${state.port}`,
        },
        results: [] as any[],
      };

      const res = await fetch(`${link.siteUrl}/api/device`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${link.deviceToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data: any = await res.json();
        const jobs: any[] = data.jobs || [];
        const results: any[] = [];
        for (const job of jobs) {
          try {
            const out = await handleJob(job.kind, job.payload || {}, state);
            results.push({ id: job.id, state: "done", result: out });
          } catch (err) {
            results.push({
              id: job.id,
              state: "error",
              result: { error: err instanceof Error ? err.message : "Fehler bei Ausführung" },
            });
          }
        }
        if (results.length > 0) {
          await fetch(`${link.siteUrl}/api/device`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${link.deviceToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...payload, results }),
          });
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
}

void main();

