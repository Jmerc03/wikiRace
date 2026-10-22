import Fastify, { LogController } from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.routes.js";
import { gameRoutes } from "./routes/games.routes.js";
import websocket from "@fastify/websocket";
import { realtimeRoutes } from "./routes/realtime.routes.js";
import { ZodError } from "zod";
import { GameError } from "./game-errors.js";
import { spectatorRoutes } from "./routes/spectator.routes.js";
import { registerRoundTimer } from "./services/round-timer.js";
import { createPlayerPresence } from "./realtime/player-presence.js";
import { betaConfig, type BetaConfig } from "./config/beta.js";
import { permittedOrigin, registerBetaGuards } from "./services/beta-guards.js";
import { registerBetaRetention } from "./services/beta-storage.js";
import { privacyRoutes } from "./routes/privacy.routes.js";

export function buildApp(options: { roundTimers?: boolean; presenceGraceMs?: number; beta?: BetaConfig; retention?: boolean } = {}) {
  const beta = options.beta ?? betaConfig();
  const app = Fastify({
    trustProxy: beta?.trustProxyHops ? (_address: string, hop: number) => hop < beta.trustProxyHops : false,
    bodyLimit: 1048576,
    requestTimeout: 15000,
    logController: new LogController({ disableRequestLogging: Boolean(beta) }),
    logger: process.env.NODE_ENV === "test" ? false : {
      redact: ["req.headers.authorization", "req.headers['idempotency-key']"],
    },
  });
  if (beta) registerBetaGuards(app, beta);

  app.register(websocket, { options: { maxPayload: 4096 } });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "Invalid request", details: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) });
    }
    if (error instanceof GameError) return reply.code(error.statusCode).send({ error: error.message });
    if (error instanceof RangeError) return reply.code(400).send({ error: error.message });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: (error as Error).message });
    if (beta) request.log.error({ errorName: (error as Error).name }, "Request failed");
    else request.log.error(error);
    return reply.code(500).send({ error: "The server could not complete this request. Please try again." });
  });

  app.register(cors, {
    origin: beta ? (origin, callback) => callback(null, permittedOrigin(origin, beta)) : true,
    exposedHeaders: ["X-WikiRace-Time"],
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-WikiRace-Time", String(Date.now()));
    return payload;
  });
  if (options.roundTimers !== false) registerRoundTimer(app);
  if (beta && options.retention !== false) registerBetaRetention(app, beta);

  app.register(healthRoutes);
  const presence = createPlayerPresence(options.presenceGraceMs);
  app.addHook("onClose", async () => { presence.dispose(); });
  app.register(gameRoutes, { prefix: "/games", presence, beta });
  app.register(realtimeRoutes, { presence, beta });
  app.register(spectatorRoutes);
  app.register(privacyRoutes, { beta });

  return app;
}
