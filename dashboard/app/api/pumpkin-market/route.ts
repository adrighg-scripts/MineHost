import { isAdmin, json } from "../../../lib/control";

export async function GET(request: Request) {
    if (!await isAdmin(request)) return json({ error: "Sign in to browse the catalog." }, 401);
    try {
        const response = await fetch("https://market.pumpkinmc.org/api/v1/rest/plugins", {
            signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) throw new Error("Marketplace unavailable");
        const items = await response.json() as { id: number; name: string; version: string; category: string; type: string }[];
        const query = (new URL(request.url).searchParams.get("q") || "").trim().toLowerCase();
        return json(items.filter(item => Number.isSafeInteger(item.id) &&
            typeof item.name === "string" && item.name.toLowerCase().includes(query))
            .slice(0, 24).map(({ id, name, version, category, type }) => ({ id, name, version, category, free: type === "free" })));
    } catch {
        return json({ error: "Pumpkin Market is currently unavailable." }, 502);
    }
}
