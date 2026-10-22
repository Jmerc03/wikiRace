import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, copyFile, mkdtemp, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { validateBetaOrigin, checkHostedBeta } from "./lib/beta-release.mjs";

const origin = validateBetaOrigin(process.env.WIKIRACE_PUBLIC_ORIGIN);
const hosted = await checkHostedBeta(origin);
await mkdir(resolve("release"), { recursive: true });
const output = await mkdtemp(resolve("release/.beta-candidate-"));
try {
const env = { ...process.env, WIKIRACE_PUBLIC_ORIGIN: origin, WIKIRACE_EXTENSION_TARGET: "beta", WIKIRACE_PACKAGE_DIR: output };
for (const args of [["run", "build:extension"], ["run", "package:extension"]]) {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, { env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error("Beta build/package failed");
}
const manifest = JSON.parse(await readFile("apps/extension/dist-beta/manifest.json", "utf8"));
if (manifest.permissions.includes("tabs") || manifest.optional_host_permissions || manifest.host_permissions.length !== 2 || !manifest.host_permissions.includes(`${origin}/*`)) throw new Error("Beta permissions did not pass review");
await copyFile("apps/extension/public/icon-128.png", `${output}/store-icon-128.png`);
const zip = await readFile(`${output}/wikirace-extension.zip`);
const sha256 = createHash("sha256").update(zip).digest("hex");
if (hosted.version !== manifest.version || hosted.sha256 !== sha256) throw new Error("Local extension differs from the hosted package. Deploy the reviewed source before producing the upload candidate.");
await writeFile(`${output}/release-check.json`, JSON.stringify({ version: manifest.version, origin, checkedAt: new Date().toISOString(), sha256, serverReady: true, privacyAvailable: true, permissionsChecked: true, hostedPackageMatches: true, publicNetworkPlaytest: "pending", chromeReview: "pending" }, null, 2) + "\n");
try { await rename(resolve("release/beta"), resolve(`release/beta-previous-${Date.now()}`)); }
catch (error) { if (error.code !== "ENOENT") throw error; }
await rename(output, resolve("release/beta"));
console.log("Beta upload candidate: release/beta/wikirace-extension.zip. Public-network playtest and store review remain required.");
} finally { await rm(output, { recursive: true, force: true }); }
