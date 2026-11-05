import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensurePortableJava } from "./java-manager.ts";

export interface ServerConfig {
  serverDir: string;
  dataDir: string;
  mcVersion: string;
  minRamMb: number;
  maxRamMb: number;
  useAikarsFlags: boolean;
  port: number;
}

const AIKARS_FLAGS = [
  "-XX:+UseG1GC",
  "-XX:+ParallelRefProcEnabled",
  "-XX:MaxGCPauseMillis=200",
  "-XX:+UnlockExperimentalVMOptions",
  "-XX:+DisableExplicitGC",
  "-XX:+AlwaysPreTouch",
  "-XX:G1NewSizePercent=30",
  "-XX:G1MaxNewSizePercent=40",
  "-XX:G1HeapRegionSize=8M",
  "-XX:G1ReservePercent=20",
  "-XX:G1HeapWastePercent=5",
  "-XX:G1MixedGCCountTarget=4",
  "-XX:InitiatingHeapOccupancyPercent=15",
  "-XX:G1MixedGCLiveThresholdPercent=90",
  "-XX:G1RSetUpdatingPauseTimePercent=5",
  "-XX:SurvivorRatio=32",
  "-XX:+PerfDisableSharedMem",
  "-XX:MaxTenuringThreshold=1",
  "-Dusing.aikars.flags=https://mcflags.emc.gs",
  "-Daikars.new.flags=true",
];

/**
 * Manages the local Minecraft Java Server child process with real-time stdout/stderr streaming,
 * stdin command execution, and Aikar's G1GC optimization flags.
 */
export class MinecraftProcessManager extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private logs: string[] = [];
  public onlinePlayers = new Set<string>();
  public phase: "stopped" | "starting" | "running" | "stopping" | "error" = "stopped";
  public startedAt = 0;

  public getConsoleSnapshot(): string {
    return this.logs.slice(-400).join("\n");
  }

  public async start(config: ServerConfig): Promise<void> {
    if (this.proc) throw new Error("Server läuft bereits.");
    this.phase = "starting";
    this.emit("phase", this.phase);

    const { javaBin, major } = await ensurePortableJava(config.dataDir, config.mcVersion, msg => {
      this.appendLog(`[MineHost-Runtime] ${msg}`);
    });

    await writeFile(join(config.serverDir, "eula.txt"), "eula=true\n", "utf8");

    const args: string[] = [
      `-Xms${Math.max(512, config.minRamMb)}M`,
      `-Xmx${Math.max(512, config.maxRamMb)}M`,
      ...(config.useAikarsFlags ? AIKARS_FLAGS : []),
      "-jar",
      "server.jar",
      "nogui",
    ];

    this.appendLog(`[MineHost] Starte Minecraft ${config.mcVersion} mit Java ${major} (${config.maxRamMb} MiB RAM)…`);
    const child = spawn(javaBin, args, {
      cwd: config.serverDir,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.proc = child;
    this.startedAt = Date.now();

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (!line) continue;
        this.appendLog(line);
        if (/Done \([0-9.,]+s\)! For help, type "help"/.test(line)) {
          this.phase = "running";
          this.emit("phase", this.phase);
        }
        const joinMatch = line.match(/\]: ([A-Za-z0-9_.]{1,32}) joined the game/);
        if (joinMatch) this.onlinePlayers.add(joinMatch[1]);
        const leaveMatch = line.match(/\]: ([A-Za-z0-9_.]{1,32}) (?:left the game|lost connection)/);
        if (leaveMatch) this.onlinePlayers.delete(leaveMatch[1]);
      }
    });

    child.stderr.on("data", (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (line) this.appendLog(`[STDERR] ${line}`);
      }
    });

    child.on("close", code => {
      this.proc = null;
      this.onlinePlayers.clear();
      this.phase = code === 0 || this.phase === "stopping" ? "stopped" : "error";
      this.appendLog(`[MineHost] Serverprozess beendet (Exit-Code: ${code ?? 0}).`);
      this.emit("phase", this.phase);
    });
  }

  public sendCommand(command: string): void {
    if (!this.proc || this.phase !== "running") {
      throw new Error("Server läuft gerade nicht.");
    }
    const clean = command.replace(/^\/+/, "").trim();
    if (!clean) return;
    this.proc.stdin.write(clean + "\n");
  }

  public async stop(): Promise<void> {
    if (!this.proc) return;
    this.phase = "stopping";
    this.emit("phase", this.phase);
    this.proc.stdin.write("save-all\nstop\n");

    await new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        this.proc?.kill("SIGKILL");
        resolve();
      }, 25000);
      this.proc?.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private appendLog(line: string): void {
    this.logs.push(line);
    if (this.logs.length > 800) this.logs.splice(0, this.logs.length - 800);
    this.emit("log", line);
  }
}

