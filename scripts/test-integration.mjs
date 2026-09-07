import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const requireApi = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { PrismaClient } = requireApi("@prisma/client");
const databaseUrl = process.env.WIKIRACE_TEST_DATABASE_URL ?? "postgresql://wikirace@127.0.0.1:55432/wikirace";
const schema = `wr_test_${Date.now()}_${randomBytes(4).toString("hex")}`;
const url = new URL(databaseUrl);
url.searchParams.set("schema", schema);
const browser = process.argv.includes("--browser");
const env = { ...process.env, DATABASE_URL: url.href, NODE_ENV: "test",
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? `${root}.local/browsers` };
const admin = new PrismaClient({ datasourceUrl: databaseUrl });
let created = false;

function run(args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Integration command failed (${result.status})`);
}

try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  console.log(`Isolated integration schema: ${schema}`);
  run([requireApi.resolve("prisma/build/index.js"), "migrate", "deploy"], `${root}apps/api`);
  run(["--import", "tsx", "--test", browser ? "apps/api/test/browser/*.test.ts" : "apps/api/test/integration/*.test.ts"]);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (created) {
    await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    console.log(`Removed integration schema: ${schema}`);
  }
  await admin.$disconnect();
}
