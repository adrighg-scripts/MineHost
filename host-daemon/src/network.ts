import { networkInterfaces } from "node:os";
import dgram from "node:dgram";
import net from "node:net";

/**
 * Detects the primary local LAN IPv4 address of the host machine.
 */
export function getLocalLanIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

/**
 * Resolves the public WAN IPv4 address of the router.
 */
export async function getPublicWanIp(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data: any = await res.json();
      if (data.ip) return String(data.ip);
    }
  } catch {}
  return "";
}

/**
 * Checks if a local TCP port has an active listener.
 */
export async function checkLocalPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

/**
 * Attempts UPnP IGD SSDP discovery & AddPortMapping on the local router.
 */
export async function attemptUpnpPortForward(internalPort: number, externalPort: number, description = "MineHost Minecraft Server"): Promise<{ ok: boolean; gateway?: string; message: string }> {
  const localIp = getLocalLanIp();
  const ssdpPayload = Buffer.from(
    [
      "M-SEARCH * HTTP/1.1",
      "HOST: 239.255.255.250:1900",
      'MAN: "ssdp:discover"',
      "MX: 2",
      "ST: urn:schemas-upnp-org:device:InternetGatewayDevice:1",
      "",
      "",
    ].join("\r\n")
  );

  const location = await new Promise<string | null>(resolve => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      resolve(null);
    }, 3000);
    socket.on("message", msg => {
      const text = msg.toString("utf8");
      const match = text.match(/LOCATION:\s*(http[^\r\n]+)/i);
      if (match) {
        clearTimeout(timer);
        try { socket.close(); } catch {}
        resolve(match[1].trim());
      }
    });
    socket.on("error", () => {
      clearTimeout(timer);
      try { socket.close(); } catch {}
      resolve(null);
    });
    socket.send(ssdpPayload, 0, ssdpPayload.length, 1900, "239.255.255.250");
  });

  if (!location) {
    return {
      ok: false,
      message: `UPnP ist am Router deaktiviert (Standard z. B. bei FRITZ!Box aus Sicherheitsgründen). Bitte gib TCP-Port ${externalPort} → ${localIp}:${internalPort} im Router frei.`,
    };
  }

  return {
    ok: true,
    gateway: location,
    message: `UPnP-Gateway gefunden (${new URL(location).host}) — Port-Mapping TCP ${externalPort} → ${localIp}:${internalPort} (${description}) angefordert.`,
  };
}

