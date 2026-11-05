import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

export type ServerSoftwareType =
  | "paper"
  | "purpur"
  | "folia"
  | "spigot"
  | "bukkit"
  | "fabric"
  | "forge"
  | "neoforge"
  | "quilt"
  | "vanilla"
  | "velocity";

const UA = "MineHost/1.0 (https://minehost-dashboard.adrilolghg.workers.dev)";

async function fetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`API ${url} antwortete mit HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Resolves the direct server JAR download URL and optional checksum for any supported Minecraft server engine.
 */
export async function resolveServerJar(
  software: ServerSoftwareType,
  mcVersion: string
): Promise<{ url: string; sha256?: string; sha1?: string; build?: string | number }> {
  switch (software) {
    case "paper":
    case "folia":
    case "velocity": {
      const vData = await fetchJson(`https://api.papermc.io/v2/projects/${software}/versions/${mcVersion}/builds`);
      const builds = vData.builds || [];
      const latest = builds[builds.length - 1];
      if (!latest) throw new Error(`Kein ${software}-Build für ${mcVersion} gefunden.`);
      const file = latest.downloads?.application;
      return {
        url: `https://api.papermc.io/v2/projects/${software}/versions/${mcVersion}/builds/${latest.build}/downloads/${file.name}`,
        sha256: file.sha256,
        build: latest.build,
      };
    }
    case "purpur": {
      const vData = await fetchJson(`https://api.purpurmc.org/v2/purpur/${mcVersion}`);
      const latest = vData.builds?.latest;
      if (!latest) throw new Error(`Kein Purpur-Build für ${mcVersion} gefunden.`);
      return {
        url: `https://api.purpurmc.org/v2/purpur/${mcVersion}/${latest}/download`,
        build: latest,
      };
    }
    case "fabric": {
      const loaders = await fetchJson<any[]>(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
      const installers = await fetchJson<any[]>(`https://meta.fabricmc.net/v2/versions/installer`);
      const loader = loaders.find(l => l.loader?.stable)?.loader?.version || loaders[0]?.loader?.version;
      const installer = installers.find(i => i.stable)?.version || installers[0]?.version;
      if (!loader || !installer) throw new Error(`Fabric Loader für ${mcVersion} nicht verfügbar.`);
      return {
        url: `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loader}/${installer}/server/jar`,
        build: loader,
      };
    }
    case "quilt": {
      const loaders = await fetchJson<any[]>(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`);
      const loader = loaders[0]?.loader?.version;
      if (!loader) throw new Error(`Quilt Loader für ${mcVersion} nicht verfügbar.`);
      return {
        url: `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}/${loader}/server/jar`,
        build: loader,
      };
    }
    case "vanilla": {
      const manifest = await fetchJson(`https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`);
      const entry = manifest.versions?.find((v: any) => v.id === mcVersion);
      if (!entry) throw new Error(`Mojang-Version ${mcVersion} nicht im Manifest gefunden.`);
      const detail = await fetchJson(entry.url);
      const srv = detail.downloads?.server;
      if (!srv?.url) throw new Error(`Kein offizieller Server-Download für ${mcVersion}.`);
      return { url: srv.url, sha1: srv.sha1 };
    }
    default:
      throw new Error(`Direkter Resolver für ${software} wird über den Mod-Installer bereitgestellt.`);
  }
}

export async function downloadServerJar(
  serverDir: string,
  software: ServerSoftwareType,
  mcVersion: string
): Promise<{ jarPath: string; build?: string | number }> {
  await mkdir(serverDir, { recursive: true });
  const resolved = await resolveServerJar(software, mcVersion);
  const jarPath = join(serverDir, "server.jar");

  const res = await fetch(resolved.url, {
    headers: { "User-Agent": UA },
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`Server-JAR Download fehlgeschlagen: HTTP ${res.status}`);
  }
  await pipeline(res.body as any, createWriteStream(jarPath));

  const bytes = await readFile(jarPath);
  if (resolved.sha256) {
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== resolved.sha256) throw new Error("SHA-256 Prüfsumme der Server-JAR stimmt nicht überein.");
  }
  if (resolved.sha1) {
    const actual = createHash("sha1").update(bytes).digest("hex");
    if (actual !== resolved.sha1) throw new Error("SHA-1 Prüfsumme der Server-JAR stimmt nicht überein.");
  }

  return { jarPath, build: resolved.build };
}
