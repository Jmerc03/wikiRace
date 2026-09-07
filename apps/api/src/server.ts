import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";

const app = buildApp();

async function start() {
  try {
    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try { await app.close(); await prisma.$disconnect(); }
  catch (error) { app.log.error(error); process.exitCode = 1; }
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
