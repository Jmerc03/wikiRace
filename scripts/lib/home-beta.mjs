import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { validateBetaOrigin } from "./beta-release.mjs";

export function homeConfig(value) {
  if (value.version !== 1) throw new Error("Unsupported home-beta configuration");
  if (!Number.isInteger(value.port) || value.port < 1024 || value.port > 65535) throw new Error("Port must be 1024–65535");
  return { version: 1, port: value.port, publicOrigin: value.publicOrigin ? validateBetaOrigin(value.publicOrigin) : null };
}
export async function loadHomeConfig(directory) {
  return homeConfig(JSON.parse(await readFile(join(directory, "config.json"), "utf8")));
}
export async function initHomeConfig(directory, origin, port = 4100) {
  const config = homeConfig({ version: 1, publicOrigin: origin ?? null, port });
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try { return await loadHomeConfig(directory); } catch (error) { if (error.code !== "ENOENT") throw error; }
  // Never replace a credential on rerun, including an interrupted initialization.
  try { await writeFile(join(directory, "postgres-password"), randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  const secret = (await readFile(join(directory, "postgres-password"), "utf8")).trim();
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error("Existing database secret is invalid; preserve it and investigate");
  try { await writeFile(join(directory, "tunnel-token"), "", { flag: "wx", mode: 0o600 }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  await writeFile(join(directory, "config.json"), JSON.stringify(config, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return config;
}
export async function saveHomeOrigin(directory, origin) {
  const config = { ...await loadHomeConfig(directory), publicOrigin: validateBetaOrigin(origin) };
  await writeFile(join(directory, "config.next.json"), JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  await rename(join(directory, "config.next.json"), join(directory, "config.json"));
  return config;
}
export function composeEnvironment(config) {
  if (!config.publicOrigin) throw new Error("Choose a stable public HTTPS hostname, then run configure --origin https://your-hostname");
  return `WIKIRACE_PUBLIC_ORIGIN=${validateBetaOrigin(config.publicOrigin)}\nWIKIRACE_HOME_PORT=${config.port}\n`;
}
export function archiveHash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
export function verifyArchive(bytes, manifest) {
  if (manifest.format !== "wikirace-home-backup-v1" || manifest.database !== "wikirace_beta" ||
      !Number.isFinite(Date.parse(manifest.createdAt)) || manifest.sha256 !== archiveHash(bytes)) {
    throw new Error("Backup metadata or checksum is invalid; nothing was restored");
  }
}
