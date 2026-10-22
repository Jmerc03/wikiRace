import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import type { BetaConfig } from "../config/beta.js";

/** Fixed windows, bounded keys, fail closed when the table fills. No credentials stored. */
export class WindowLimiter {
  private entries = new Map<string, { count: number; until: number }>();
  constructor(private readonly maxKeys = 10000) {}
  take(key: string, limit: number, windowMs: number, now = Date.now()): number {
    let entry = this.entries.get(key);
    if (entry && entry.until <= now) { this.entries.delete(key); entry = undefined; }
    if (!entry) {
      if (this.entries.size >= this.maxKeys) {
        for (const [id, value] of this.entries) if (value.until <= now) this.entries.delete(id);
        if (this.entries.size >= this.maxKeys) return Math.ceil(windowMs / 1000);
      }
      entry = { count: 0, until: now + windowMs }; this.entries.set(key, entry);
    }
    if (entry.count >= limit) return Math.max(1, Math.ceil((entry.until - now) / 1000));
    entry.count++; return 0;
  }
}

export function permittedOrigin(origin: string | undefined, config: BetaConfig) {
  return !origin || origin === config.publicOrigin || /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}

export function registerBetaGuards(app: FastifyInstance, config: BetaConfig) {
  const limiter = new WindowLimiter();
  const pending = new WeakSet<FastifyRequest>();
  let inFlight = 0;
  const release = (request: FastifyRequest) => { if (pending.delete(request)) inFlight--; };
  app.addHook("onResponse", async request => { release(request); });
  app.addHook("onRequestAbort", async request => { release(request); });
  app.addHook("onTimeout", async request => { release(request); });
  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (!permittedOrigin(request.headers.origin, config)) return reply.code(403).send({ error: "This origin is not allowed" });
    // Keep process liveness inexpensive and available during an API rate limit.
    if (path === "/health") return;
    const checks: [string, number, number][] = [["global", 6000, 60000], [`ip:${request.ip}`, 600, 60000]];
    if (request.method === "POST") checks.push([`write:${request.ip}`, 120, 60000]);
    if (request.method === "POST" && (/^\/games\/?$/.test(path) || /\/rematch$/.test(path))) {
      checks.push([`create:${request.ip}`, 20, 3600000], ["create:global", 100, 3600000]);
    }
    for (const [key, limit, windowMs] of checks) {
      const seconds = limiter.take(key, limit, windowMs);
      if (seconds) return reply.code(429).header("Retry-After", String(seconds)).send({ error: `Beta traffic limit reached. Please retry in ${seconds} seconds.` });
    }
    // WebSocket upgrades have a separate live-connection budget and lifetime.
    if (request.method === "GET" && path.startsWith("/ws/") && request.headers.upgrade?.toLowerCase() === "websocket") return;
    if (inFlight >= 32) return reply.code(503).header("Retry-After", "5").send({ error: "The beta server is busy. Please retry shortly." });
    inFlight++; pending.add(request);
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Referrer-Policy", "no-referrer").header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "no-store");
    return payload;
  });
}

export function createSocketBudget(maxTotal = 256, maxPerIp = 64) {
  let total = 0;
  const counts = new Map<string, number>();
  return (socket: WebSocket, ip: string) => {
    const count = counts.get(ip) ?? 0;
    if (total >= maxTotal || count >= maxPerIp) { socket.close(1013, "Beta connection limit reached; retry shortly"); return false; }
    total++; counts.set(ip, count + 1);
    socket.once("close", () => { total--; const left = (counts.get(ip) ?? 1) - 1; if (left) counts.set(ip, left); else counts.delete(ip); });
    return true;
  };
}
