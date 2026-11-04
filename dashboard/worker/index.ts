import handler from "vinext/server/fetch-handler";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const response = await handler.fetch(request, env, ctx);
    const secured = new Response(response.body, response);
    secured.headers.set("X-Content-Type-Options", "nosniff");
    secured.headers.set("Referrer-Policy", "no-referrer");
    secured.headers.set("X-Frame-Options", "DENY");
    secured.headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (new URL(request.url).pathname === "/" || new URL(request.url).pathname.startsWith("/api/")) secured.headers.set("Cache-Control", "private, no-store");
    return secured;
  },
};

export default worker;
