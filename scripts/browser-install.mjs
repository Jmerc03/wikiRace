import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const browsers = fileURLToPath(new URL("../.local/browsers", import.meta.url));
const result = spawnSync(process.execPath, [require.resolve("playwright/cli"), "install", "chromium"], {
  stdio: "inherit", env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? browsers },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
