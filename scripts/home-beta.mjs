import { spawnSync, spawn } from "node:child_process";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { initHomeConfig, loadHomeConfig, saveHomeOrigin, composeEnvironment, archiveHash, verifyArchive } from "./lib/home-beta.mjs";
import { checkHostedBeta } from "./lib/beta-release.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = join(root, ".local/home-beta");
const project = "wikirace-home-beta";
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  origin: { type: "string" }, port: { type: "string" }, "confirm-public": { type: "boolean" },
} });
const [command, archive] = positionals;
const run = (args, capture = false) => {
  const result = spawnSync("docker", args, { cwd: root, encoding: "utf8", stdio: capture ? "pipe" : "inherit", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error("Docker command failed. Check Docker Desktop is running with Linux containers.");
  return result.stdout?.trim() ?? "";
};
const base = ["compose", "--project-name", project, "--env-file", join(directory, "compose.env"), "-f", "compose.beta.yml"];
const compose = (args, capture = false) => run([...base, ...args], capture);
async function prepare() {
  const config = await loadHomeConfig(directory);
  const secret = (await readFile(join(directory, "postgres-password"), "utf8")).trim();
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error("Missing/invalid database secret; do not replace it on an existing database");
  await writeFile(join(directory, "compose.env"), composeEnvironment(config), { mode: 0o600 });
  return config;
}
async function localReady(config) {
  const origin = `http://127.0.0.1:${config.port}`;
  const [ready, metadata] = await Promise.all(["/ready", "/deployment"].map(async path => {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Local beta check failed: ${path}`);
    return response.json();
  }));
  if (ready.status !== "ready" || metadata.profile !== "beta" || metadata.hostingProvider !== "home-cloudflare" || metadata.publicOrigin !== config.publicOrigin) {
    throw new Error("The running server does not match the home-beta configuration");
  }
  return origin;
}
async function streamDocker(args, file, direction) {
  const child = spawn("docker", [...base, ...args], { cwd: root, stdio: ["pipe", "pipe", "inherit"], windowsHide: true });
  const exited = new Promise((res, rej) => { child.once("error", rej); child.once("exit", code => code === 0 ? res() : rej(new Error("Database archive command failed"))); });
  try {
    if (direction === "out") { child.stdin.end(); await Promise.all([pipeline(child.stdout, createWriteStream(file, { flags: "wx", mode: 0o600 })), exited]); }
    else { child.stdout.resume(); await Promise.all([pipeline(createReadStream(file), child.stdin), exited]); }
  } catch (error) { child.kill(); throw error; }
}

try {
  if (command === "init") {
    // Lost host files must not silently create a new password for an existing volume.
    const volumes = run(["volume", "ls", "--filter", `label=com.docker.compose.project=${project}`, "--format", "{{.Name}}"], true);
    if (volumes) await access(join(directory, "postgres-password")).catch(() => { throw new Error("An existing beta database volume has no matching secret file. Recover the original .local/home-beta files first."); });
    const config = await initHomeConfig(directory, values.origin, values.port ? Number(values.port) : 4100);
    console.log(`Home beta initialized. Local port ${config.port}. ${config.publicOrigin ?? "Public hostname not chosen yet."} Secrets remain in .local/home-beta; reruns preserve them.`);
  } else if (command === "configure") {
    const running = run(["ps", "--filter", `label=com.docker.compose.project=${project}`, "--format", "{{.ID}}"], true);
    if (running) throw new Error("Stop the home beta before changing its hostname");
    const config = await saveHomeOrigin(directory, values.origin);
    console.log(`Configured ${config.publicOrigin}. Rebuild with start; older extension packages keep their previous address.`);
  } else if (command === "doctor") {
    console.log(`Docker engine: ${run(["info", "--format", "{{.OSType}} / {{.ServerVersion}}"], true)}`);
    if (run(["info", "--format", "{{.OSType}}"], true) !== "linux") throw new Error("Select Linux containers in Docker Desktop");
    console.log(run(["compose", "version", "--short"], true));
    const config = await loadHomeConfig(directory).catch(error => error.code === "ENOENT" ? null : Promise.reject(error));
    console.log(config ? `Configuration found; hostname ${config.publicOrigin ?? "pending"}; loopback port ${config.port}` : "Run init next; no local configuration exists.");
  } else if (["start", "status", "stop", "backup", "restore-check", "tunnel", "public-check"].includes(command)) {
    const config = await prepare();
    if (command === "start") {
      compose(["up", "-d", "--build", "--wait", "--wait-timeout", "180", "api"]);
      console.log(`Ready locally: ${await localReady(config)}. Public tunnel is a separate explicit step.`);
    } else if (command === "status") {
      compose(["--profile", "public", "ps"]);
      console.log(`Ready locally: ${await localReady(config)}`);
    } else if (command === "stop") {
      compose(["--profile", "public", "stop"]);
      console.log("Home beta stopped. Containers, database volume and backups are preserved.");
    } else if (command === "tunnel") {
      if (!values["confirm-public"]) throw new Error("This publishes the beta through your configured Cloudflare route. Run tunnel --confirm-public only after reviewing docs/HOME_BETA.md.");
      const token = (await readFile(join(directory, "tunnel-token"), "utf8")).trim();
      if (token.length < 50 || /\s/.test(token)) throw new Error("Save the Cloudflare tunnel token in .local/home-beta/tunnel-token first; never paste it in chat");
      await localReady(config);
      compose(["--profile", "public", "up", "-d", "--no-deps", "cloudflared"]);
      console.log("Tunnel started. Run public-check and complete the two-network playtest before inviting testers.");
    } else if (command === "public-check") {
      const packaged = await checkHostedBeta(config.publicOrigin);
      const deployment = await (await fetch(`${config.publicOrigin}/deployment`, { redirect: "error", signal: AbortSignal.timeout(15000) })).json();
      if (deployment.hostingProvider !== "home-cloudflare") throw new Error("The public server has the wrong hosting disclosure");
      console.log(JSON.stringify({ origin: config.publicOrigin, version: packaged.version, sha256: packaged.sha256, checkedAt: new Date().toISOString(), twoNetworkPlaytest: "pending" }, null, 2));
    } else if (command === "backup") {
      await localReady(config);
      const destination = join(directory, "backups"); await mkdir(destination, { recursive: true, mode: 0o700 });
      const path = join(destination, `wikirace-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}.dump`);
      try {
        await streamDocker(["exec", "-T", "postgres", "pg_dump", "-U", "wikirace", "-d", "wikirace_beta", "-Fc"], path, "out");
        const bytes = await readFile(path);
        await writeFile(`${path}.json`, JSON.stringify({ format: "wikirace-home-backup-v1", database: "wikirace_beta", createdAt: new Date().toISOString(), sha256: archiveHash(bytes), publicOrigin: config.publicOrigin }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
        console.log(`Backup saved: ${path}\nRun restore-check on this file. Keep a private copy off this laptop; remove copies older than seven days.`);
      } catch (error) { await rm(path, { force: true }); throw error; }
    } else if (command === "restore-check") {
      if (!archive) throw new Error("Supply the path to a home-beta .dump backup");
      const path = resolve(archive); verifyArchive(await readFile(path), JSON.parse(await readFile(`${path}.json`, "utf8")));
      const database = `wr_restore_${randomBytes(8).toString("hex")}`;
      compose(["exec", "-T", "postgres", "createdb", "-U", "wikirace", database]);
      try {
        await streamDocker(["exec", "-T", "postgres", "pg_restore", "-U", "wikirace", "--no-owner", "--exit-on-error", "-d", database], path, "in");
        const counts = compose(["exec", "-T", "postgres", "psql", "-U", "wikirace", "-d", database, "-At", "-v", "ON_ERROR_STOP=1", "-c", 'SELECT json_build_object(\'games\', (SELECT count(*) FROM "Game"), \'players\', (SELECT count(*) FROM "Player"), \'migrations\', (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL));'], true);
        console.log(`Archive restored into an isolated temporary database: ${counts}. Live database unchanged.`);
      } finally { compose(["exec", "-T", "postgres", "dropdb", "-U", "wikirace", database]); }
    }
  } else {
    console.log("Usage: node scripts/home-beta.mjs init [--origin https://hostname] [--port 4100]\nCommands: doctor, configure --origin https://hostname, start, status, stop, backup, restore-check <dump>, tunnel --confirm-public, public-check");
    if (command) process.exitCode = 1;
  }
} catch (error) {
  // Do not dump Docker process objects or command environments containing credentials.
  console.error(error instanceof Error ? error.message : "Home beta command failed"); process.exitCode = 1;
}
