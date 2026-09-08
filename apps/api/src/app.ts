import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.routes.js";
import { gameRoutes } from "./routes/games.routes.js";
import websocket from "@fastify/websocket";
import { realtimeRoutes } from "./routes/realtime.routes.js";
import { ZodError } from "zod";
import { GameError } from "./game-errors.js";
import { spectatorRoutes } from "./routes/spectator.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : {
      redact: ["req.headers.authorization", "req.headers['idempotency-key']"],
    },
  });

  app.register(websocket, { options: { maxPayload: 4096 } });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "Invalid request", details: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) });
    }
    if (error instanceof GameError) return reply.code(error.statusCode).send({ error: error.message });
    if (error instanceof RangeError) return reply.code(400).send({ error: error.message });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: (error as Error).message });
    request.log.error(error);
    return reply.code(500).send({ error: "The server could not complete this request. Please try again." });
  });

  app.register(cors, {
    origin: true,
  });

  app.register(healthRoutes);
  app.register(gameRoutes, { prefix: "/games" });
  app.register(realtimeRoutes);
  app.register(spectatorRoutes);

  return app;
}
