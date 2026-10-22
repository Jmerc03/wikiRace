import { readFile, mkdir, writeFile, readdir, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { zipSync, unzipSync } from "fflate";
import { createHash, randomUUID } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const beta = process.env.WIKIRACE_EXTENSION_TARGET === "beta";
const source = `${root}apps/extension/${beta ? "dist-beta" : "dist"}`;
const files = {};
for (const name of (await readdir(source)).sort()) {
  if (name.endsWith(".map")) continue;
  // ZIP encodes local DOS date fields. Construct fixed local fields so builds
  // in different time zones have the same bytes.
  files[name] = [await readFile(`${source}/${name}`), { mtime: new Date(2026, 0, 1, 0, 0, 0) }];
}
for (const name of ["manifest.json", "popup.html", "popup.js", "background.js", "content.js", "icon-16.png", "icon-32.png", "icon-48.png", "icon-128.png"]) {
  if (!files[name]) throw new Error(`Missing extension build artifact: ${name}`);
}
const bytes = zipSync(files, { level: 9 });
const verified = unzipSync(bytes);
const manifest = JSON.parse(new TextDecoder().decode(verified["manifest.json"]));
if (manifest.manifest_version !== 3) throw new Error("Invalid packaged extension manifest");
const output = process.env.WIKIRACE_PACKAGE_DIR ?? `${root}apps/api/public/downloads`;
await mkdir(output, { recursive: true });
const temporary = `${output}/.wikirace-extension-${randomUUID()}.tmp`;
await writeFile(temporary, bytes);
await rename(temporary, `${output}/wikirace-extension.zip`);
await writeFile(`${output}/checksums.json`, JSON.stringify({ version: manifest.version, profile: beta ? "beta" : "local", apiOrigin: manifest.homepage_url ?? null, sha256: createHash("sha256").update(bytes).digest("hex"), files: Object.keys(verified).sort() }, null, 2) + "\n");
console.log(`Packaged WikiRace ${manifest.version}: ${bytes.length} bytes, ${Object.keys(verified).length} files`);
