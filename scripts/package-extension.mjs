import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { zipSync, unzipSync } from "fflate";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = `${root}apps/extension/dist`;
const files = {};
for (const name of (await readdir(source)).sort()) {
  if (name.endsWith(".map")) continue;
  files[name] = [await readFile(`${source}/${name}`), { mtime: new Date("2026-01-01T00:00:00Z") }];
}
for (const name of ["manifest.json", "popup.html", "popup.js", "background.js", "content.js"]) {
  if (!files[name]) throw new Error(`Missing extension build artifact: ${name}`);
}
const bytes = zipSync(files, { level: 9 });
const verified = unzipSync(bytes);
const manifest = JSON.parse(new TextDecoder().decode(verified["manifest.json"]));
if (manifest.manifest_version !== 3) throw new Error("Invalid packaged extension manifest");
const output = `${root}apps/api/public/downloads`;
await mkdir(output, { recursive: true });
await writeFile(`${output}/wikirace-extension.zip`, bytes);
await writeFile(`${output}/checksums.json`, JSON.stringify({ version: manifest.version, sha256: createHash("sha256").update(bytes).digest("hex"), files: Object.keys(verified).sort() }, null, 2) + "\n");
console.log(`Packaged WikiRace ${manifest.version}: ${bytes.length} bytes, ${Object.keys(verified).length} files`);
