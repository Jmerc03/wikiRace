import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const password = (await readFile("/run/secrets/postgres_password", "utf8")).trim();
if (!/^[a-f0-9]{64}$/.test(password)) throw new Error("Missing or invalid beta database secret");
const env = { ...process.env, DATABASE_URL: `postgresql://wikirace:${password}@postgres:5432/wikirace_beta` };
let child;
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child?.kill(signal));
const run = (command, args) => new Promise((resolve, reject) => {
  child = spawn(command, args, { env, stdio: "inherit" });
  child.once("error", reject);
  child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
});
const migrated = await run("node", ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "apps/api/prisma/schema.prisma"]);
if (migrated !== 0) process.exit(migrated);
process.exit(await run("node", ["apps/api/dist/server.js"]));
