import { realpath, readdir, readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { resolve, relative, sep, isAbsolute } from "node:path";

/**
 * Strict Path-Traversal Sandbox Guard.
 * Ensures every file operation stays strictly inside the server root directory.
 */
export async function resolveSandboxedPath(serverRoot: string, userRelativePath: string): Promise<string> {
  if (userRelativePath.includes("\0")) {
    throw new Error("Ungültiger Dateipfad (Null-Byte blockiert).");
  }
  const canonicalRoot = await realpath(serverRoot);
  const cleaned = userRelativePath.replace(/^[/\\]+/, "");
  const candidate = resolve(canonicalRoot, cleaned);
  const rel = relative(canonicalRoot, candidate);

  if (rel.startsWith("..") || isAbsolute(rel) || rel.split(sep).includes("..")) {
    throw new Error("Zugriff verweigert: Pfad liegt außerhalb des Server-Verzeichnisses (Path-Traversal-Schutz).");
  }
  return candidate;
}

export async function listSandboxedDirectory(serverRoot: string, dirPath = "") {
  const target = await resolveSandboxedPath(serverRoot, dirPath);
  const entries = await readdir(target, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue; // Ignore symlinks to prevent symlink escape
    const full = resolve(target, entry.name);
    const info = await stat(full);
    results.push({
      name: entry.name,
      directory: entry.isDirectory(),
      size: entry.isDirectory() ? 0 : info.size,
      modified: info.mtimeMs,
    });
  }
  return results.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
}

export async function readSandboxedText(serverRoot: string, filePath: string, maxBytes = 2 * 1024 * 1024): Promise<string> {
  const target = await resolveSandboxedPath(serverRoot, filePath);
  const info = await stat(target);
  if (info.size > maxBytes) throw new Error("Datei ist zu groß für den Text-Editor.");
  return readFile(target, "utf8");
}

export async function writeSandboxedText(serverRoot: string, filePath: string, content: string): Promise<void> {
  const target = await resolveSandboxedPath(serverRoot, filePath);
  await writeFile(target, content, "utf8");
}

export async function createSandboxedFolder(serverRoot: string, folderPath: string): Promise<void> {
  const target = await resolveSandboxedPath(serverRoot, folderPath);
  await mkdir(target, { recursive: true });
}

export async function deleteSandboxedEntry(serverRoot: string, targetPath: string): Promise<void> {
  const canonicalRoot = await realpath(serverRoot);
  const target = await resolveSandboxedPath(serverRoot, targetPath);
  if (target === canonicalRoot) throw new Error("Das Server-Hauptverzeichnis darf nicht gelöscht werden.");
  await rm(target, { recursive: true, force: true });
}

