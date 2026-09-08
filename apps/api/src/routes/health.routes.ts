import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "wikipedia-bingo-api",
      instanceId: process.env.WIKIRACE_INSTANCE_ID ?? null,
    };
  });
  app.get("/ready", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT g."revision", p."sessionTokenHash", p."admissionRequestHash" FROM "Game" g CROSS JOIN "Player" p LIMIT 0`;
      return { status: "ready", service: "wikipedia-bingo-api", database: "connected", capabilities: ["recoverable-admission-v1"] };
    } catch {
      return reply.code(503).send({ status: "unavailable", service: "wikipedia-bingo-api", database: "unavailable" });
    }
  });
}
