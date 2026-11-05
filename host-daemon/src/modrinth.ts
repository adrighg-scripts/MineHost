const UA = "MineHost/1.0 (https://minehost-dashboard.adrilolghg.workers.dev)";
const MODRINTH_API = "https://api.modrinth.com/v2";

export interface ModrinthCompatibilityReport {
  compatible: { projectId: string; title: string; filename: string; downloadUrl: string; sha512: string }[];
  incompatible: { projectId: string; title: string; reason: string }[];
}

async function modrinthGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${MODRINTH_API}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Modrinth API Fehler (${res.status}) bei ${path}`);
  return res.json() as Promise<T>;
}

/**
 * Checks all installed Modrinth plugins/mods against a target Minecraft version and loader,
 * automatically resolving required dependencies and warning about any incompatible projects before upgrading/downgrading.
 */
export async function checkCompatibilityForVersionSwitch(
  installedProjectIds: string[],
  targetMcVersion: string,
  loader: "paper" | "purpur" | "spigot" | "fabric" | "forge" | "neoforge" | "quilt"
): Promise<ModrinthCompatibilityReport> {
  const compatible: ModrinthCompatibilityReport["compatible"] = [];
  const incompatible: ModrinthCompatibilityReport["incompatible"] = [];
  const visited = new Set<string>();

  const loaders =
    loader === "paper" || loader === "purpur" || loader === "spigot"
      ? ["paper", "spigot", "bukkit"]
      : [loader];

  async function resolveProject(projectId: string) {
    if (visited.has(projectId)) return;
    visited.add(projectId);

    const project = await modrinthGet(`/project/${encodeURIComponent(projectId)}`);
    const query =
      `?game_versions=${encodeURIComponent(JSON.stringify([targetMcVersion]))}` +
      `&loaders=${encodeURIComponent(JSON.stringify(loaders))}`;
    const versions = await modrinthGet<any[]>(`/project/${encodeURIComponent(projectId)}/version${query}`);
    const best = versions.find(v => v.version_type === "release") || versions[0];

    if (!best) {
      incompatible.push({
        projectId,
        title: project.title || projectId,
        reason: `Noch kein Release für Minecraft ${targetMcVersion} (${loader}) auf Modrinth verfügbar.`,
      });
      return;
    }

    for (const dep of best.dependencies || []) {
      if (dep.dependency_type === "required" && dep.project_id) {
        await resolveProject(dep.project_id);
      }
    }

    const file = best.files?.find((f: any) => f.primary) || best.files?.[0];
    if (file?.url && file?.hashes?.sha512) {
      compatible.push({
        projectId,
        title: project.title || projectId,
        filename: file.filename,
        downloadUrl: file.url,
        sha512: file.hashes.sha512,
      });
    }
  }

  for (const id of installedProjectIds) {
    await resolveProject(id);
  }

  return { compatible, incompatible };
}
