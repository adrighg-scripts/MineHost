import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type JavaMajor = 8 | 16 | 17 | 21;

/**
 * Determines the required Java major version for any Minecraft Java version (1.0 to latest).
 */
export function resolveRequiredJavaVersion(mcVersion: string): JavaMajor {
  const match = mcVersion.match(/^1\.(\d+)(?:\.(\d+))?/);
  if (!match) return 21; // Snapshots or 26.x+ default to Java 21 LTS
  const minor = parseInt(match[1], 10);
  const patch = match[2] ? parseInt(match[2], 10) : 0;

  if (minor <= 16) return 8;
  if (minor === 17) return 16;
  if (minor < 20 || (minor === 20 && patch <= 4)) return 17;
  return 21;
}

function adoptiumPlatform(): { os: string; arch: string; ext: "zip" | "tar.gz" } {
  const os =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "mac"
        : "linux";
  const arch =
    process.arch === "arm64"
      ? "aarch64"
      : process.arch === "x64"
        ? "x64"
        : "x64";
  const ext = os === "windows" ? "zip" : "tar.gz";
  return { os, arch, ext };
}

/**
 * Ensures the required portable Adoptium Temurin JRE is downloaded and ready in `<dataDir>/runtimes/java-<major>`.
 * No manual system Java installation is required on Windows, Linux (Ubuntu), or macOS.
 */
export async function ensurePortableJava(
  dataDir: string,
  mcVersion: string,
  onProgress?: (msg: string) => void
): Promise<{ javaBin: string; major: JavaMajor }> {
  const major = resolveRequiredJavaVersion(mcVersion);
  const runtimeDir = join(dataDir, "runtimes", `java-${major}`);
  await mkdir(runtimeDir, { recursive: true });

  const existing = await findJavaBinary(runtimeDir);
  if (existing) {
    return { javaBin: existing, major };
  }

  const { os, arch, ext } = adoptiumPlatform();
  const apiUrl = `https://api.adoptium.net/v3/binary/latest/${major}/ga/${os}/${arch}/jre/hotspot/normal/eclipse?project=jdk`;
  onProgress?.(`Lade portable Java ${major} Laufzeitumgebung (${os}/${arch}) über Adoptium Temurin herunter …`);

  const archivePath = join(runtimeDir, `temurin-jre-${major}.${ext}`);
  const response = await fetch(apiUrl, {
    headers: { "User-Agent": "MineHost-Daemon/1.0" },
    redirect: "follow",
  });
  if (!response.ok || !response.body) {
    throw new Error(`Adoptium Java ${major} Download fehlgeschlagen: HTTP ${response.status}`);
  }

  await pipeline(response.body as any, createWriteStream(archivePath));
  onProgress?.(`Entpacke portable Java ${major} Laufzeitumgebung …`);

  if (ext === "zip") {
    if (process.platform === "win32") {
      await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${runtimeDir.replace(/'/g, "''")}' -Force`,
      ]);
    } else {
      await execFileAsync("unzip", ["-q", "-o", archivePath, "-d", runtimeDir]);
    }
  } else {
    await execFileAsync("tar", ["-xzf", archivePath, "-C", runtimeDir]);
  }

  const javaBin = await findJavaBinary(runtimeDir);
  if (!javaBin) {
    throw new Error(`Java ${major} Binary konnte nach dem Entpacken nicht gefunden werden.`);
  }
  if (process.platform !== "win32") {
    await chmod(javaBin, 0o755);
  }
  return { javaBin, major };
}

async function findJavaBinary(dir: string): Promise<string | null> {
  const exe = process.platform === "win32" ? "java.exe" : "java";
  const direct = join(dir, "bin", exe);
  if (existsSync(direct)) return direct;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(dir, entry.name, "bin", exe);
    if (existsSync(candidate)) return candidate;
    const macCandidate = join(dir, entry.name, "Contents", "Home", "bin", exe);
    if (existsSync(macCandidate)) return macCandidate;
  }
  return null;
}
