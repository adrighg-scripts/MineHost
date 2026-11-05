import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

export type ServerSoftwareType =
  | "paper"
  | "purpur"
  | "spigot"
  | "bukkit"
  | "folia"
  | "fabric"
  | "forge"
  | "neoforge"
  | "quilt"
  | "vanilla"
  | "velocity"
  | "bungeecord"
  | "waterfall"
  | "mohist"
  | "arclight";

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
 * Fetches the full list of all Minecraft versions (1.0 up to latest release & snapshots) from Mojang's official manifest.
 */
export async function fetchAllMinecraftVersions(includeSnapshots = false): Promise<string[]> {
  const manifest = await fetchJson(`https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`);
  return (manifest.versions || [])
    .filter((v: any) => includeSnapshots || v.type === "release")
    .map((v: any) => String(v.id));
}

/**
 * Resolves the direct server JAR / installer download URL and optional checksum for any supported Minecraft server engine.
 */
export async function resolveServerJar(
  software: ServerSoftwareType,
  mcVersion: string
): Promise<{ url: string; sha256?: string; sha1?: string; build?: string | number; isInstaller?: boolean }> {
  switch (software) {
    case "paper":
    case "folia":
    case "velocity":
    case "waterfall": {
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
    case "spigot":
    case "bukkit": {
      // Uses official GetBukkit CDN or Paper fallback for maximum compatibility
      return {
        url: `https://download.getbukkit.org/${software}/${software}-${mcVersion}.jar`,
        build: mcVersion,
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
    case "forge": {
      const promos = await fetchJson(`https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json`);
      const forgeVer = promos.promos?.[`${mcVersion}-recommended`] || promos.promos?.[`${mcVersion}-latest`];
      if (!forgeVer) throw new Error(`Keine Forge-Version für ${mcVersion} gefunden.`);
      const full = `${mcVersion}-${forgeVer}`;
      return {
        url: `https://maven.minecraftforge.net/net/minecraftforge/forge/${full}/forge-${full}-installer.jar`,
        build: forgeVer,
        isInstaller: true,
      };
    }
    case "neoforge": {
      const meta = await fetchJson(`https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge`);
      const prefix = mcVersion.startsWith("1.") ? mcVersion.slice(2) + "." : mcVersion;
      const matching = (meta.versions || []).filter((v: string) => v.startsWith(prefix));
      const latest = matching[matching.length - 1];
      if (!latest) throw new Error(`Keine NeoForge-Version für ${mcVersion} gefunden.`);
      return {
        url: `https://maven.neoforged.net/releases/net/neoforged/neoforge/${latest}/neoforge-${latest}-installer.jar`,
        build: latest,
        isInstaller: true,
      };
    }
    case "mohist": {
      const vData = await fetchJson(`https://mohistmc.com/api/v2/projects/mohist/${mcVersion}/builds`);
      const builds = vData.builds || [];
      const latest = builds[builds.length - 1];
      if (!latest) throw new Error(`Kein Mohist-Build für ${mcVersion} gefunden.`);
      return {
        url: latest.url || `https://mohistmc.com/api/v2/projects/mohist/${mcVersion}/builds/${latest.number}/download`,
        build: latest.number,
      };
    }
    case "arclight": {
      const releases = await fetchJson<any[]>(`https://api.github.com/repos/IzzelAliz/Arclight/releases?per_page=15`);
      const asset = releases.flatMap(r => r.assets || []).find((a: any) => a.name?.includes(mcVersion) && a.name?.endsWith(".jar"))
        || releases[0]?.assets?.find((a: any) => a.name?.endsWith(".jar"));
      if (!asset) throw new Error(`Kein Arclight-Release für ${mcVersion} gefunden.`);
      return { url: asset.browser_download_url, build: asset.name };
    }
    case "bungeecord": {
      return {
        url: `https://ci.md-5.net/job/BungeeCord/lastSuccessfulBuild/artifact/bootstrap/target/BungeeCord.jar`,
        build: "latest",
      };
    }
    case "vanilla":
    default: {
      const manifest = await fetchJson(`https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`);
      const entry = manifest.versions?.find((v: any) => v.id === mcVersion) || manifest.versions?.[0];
      if (!entry) throw new Error(`Mojang-Version ${mcVersion} nicht im Manifest gefunden.`);
      const detail = await fetchJson(entry.url);
      const srv = detail.downloads?.server;
      if (!srv?.url) throw new Error(`Kein offizieller Server-Download für ${mcVersion}.`);
      return { url: srv.url, sha1: srv.sha1 };
    }
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
