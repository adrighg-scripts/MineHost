import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rm, cp } from "node:fs/promises";
import { join } from "node:path";
import { platform } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const GITHUB_LATEST_URL = "https://api.github.com/repos/adrighg-scripts/MineHost/releases/latest";
const UA = "MineHost-AutoUpdater/1.0 (https://minehost-dashboard.adrilolghg.workers.dev)";

export const UPDATE_RESTART_EXIT_CODE = 42;
export const IDLE_REQUIRED_MS = 15 * 60 * 1000; // 15 minutes

function normalizeVersion(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .trim()
    .split(".")
    .map(n => parseInt(n, 10) || 0);
}

export function isNewerVersion(current: string, remote: string): boolean {
  const c = normalizeVersion(current);
  const r = normalizeVersion(remote);
  const len = Math.max(c.length, r.length);
  for (let i = 0; i < len; i++) {
    const cv = c[i] || 0;
    const rv = r[i] || 0;
    if (rv > cv) return true;
    if (rv < cv) return false;
  }
  return false;
}

export async function getCurrentDaemonVersion(rootDir: string): Promise<string> {
  try {
    const pkgPath = join(rootDir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
      if (pkg.version) return String(pkg.version);
    }
  } catch {}
  return "0.10.17";
}

export async function checkLatestGitHubRelease(): Promise<{
  version: string;
  windowsUrl: string;
  linuxUrl: string;
} | null> {
  try {
    const res = await fetch(GITHUB_LATEST_URL, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": UA },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const version = String(data.tag_name || "").replace(/^v/i, "");
    if (!version) return null;
    const assets: any[] = Array.isArray(data.assets) ? data.assets : [];
    const winAsset = assets.find(a => a.name === "MineHost_Windows.zip");
    const linAsset = assets.find(a => a.name === "MineHost_Linux.zip");
    return {
      version,
      windowsUrl:
        winAsset?.browser_download_url ||
        "https://github.com/adrighg-scripts/MineHost/releases/latest/download/MineHost_Windows.zip",
      linuxUrl:
        linAsset?.browser_download_url ||
        "https://github.com/adrighg-scripts/MineHost/releases/latest/download/MineHost_Linux.zip",
    };
  } catch {
    return null;
  }
}

export async function downloadAndApplyHostUpdate(rootDir: string, downloadUrl: string, newVersion: string): Promise<boolean> {
  const tmpDir = join(rootDir, "minehost-data", "tmp-update");
  const zipPath = join(tmpDir, "update.zip");
  const extractDir = join(tmpDir, "extracted");

  try {
    await rm(tmpDir, { recursive: true, force: true });
    await mkdir(extractDir, { recursive: true });

    console.log(`[Auto-Update] Lade MineHost v${newVersion} herunter …`);
    const res = await fetch(downloadUrl, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`Download fehlgeschlagen (HTTP ${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(zipPath, buffer);

    if (platform() === "win32") {
      await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`,
      ]);
    } else {
      await execFileAsync("unzip", ["-q", "-o", zipPath, "-d", extractDir]);
    }

    if (existsSync(join(extractDir, "src"))) {
      await cp(join(extractDir, "src"), join(rootDir, "src"), { recursive: true, force: true });
    }
    if (existsSync(join(extractDir, "package.json"))) {
      const pkg = JSON.parse(await readFile(join(extractDir, "package.json"), "utf8"));
      pkg.version = newVersion;
      await writeFile(join(rootDir, "package.json"), JSON.stringify(pkg, null, 2), "utf8");
    }

    await rm(tmpDir, { recursive: true, force: true });
    console.log(`[Auto-Update] Update auf v${newVersion} erfolgreich installiert!`);
    return true;
  } catch (err) {
    console.error("[Auto-Update] Fehler beim Update:", err instanceof Error ? err.message : err);
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return false;
  }
}

