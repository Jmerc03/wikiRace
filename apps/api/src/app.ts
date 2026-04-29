import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.routes.js";
import { gameRoutes } from "./routes/games.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: true,
  });

  app.register(healthRoutes);
  app.register(gameRoutes, { prefix: "/games" });

  return app;
}
