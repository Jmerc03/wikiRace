import { build } from "esbuild";
import { rm, mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
const beta = process.env.WIKIRACE_EXTENSION_TARGET === "beta";
const outdir = beta ? "dist-beta" : "dist";
let apiOrigin = "http://localhost:4000";
if (beta) {
  const url = new URL(process.env.WIKIRACE_PUBLIC_ORIGIN ?? process.env.RENDER_EXTERNAL_URL ?? "");
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Beta extension requires a public HTTPS origin");
  apiOrigin = url.origin;
}
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await build({ entryPoints: ["src/background.ts", "src/popup.ts", "src/content.ts"],
  outdir, bundle: true, format: "iife", target: "chrome116", sourcemap: !beta,
  define: { __WIKIRACE_API_ORIGIN__: JSON.stringify(apiOrigin), __WIKIRACE_BETA__: JSON.stringify(beta) } });
const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
if (beta) {
  manifest.name += " BETA";
  manifest.host_permissions = ["https://en.wikipedia.org/*", `${apiOrigin}/*`];
  delete manifest.optional_host_permissions;
  manifest.homepage_url = apiOrigin;
}
await writeFile(`${outdir}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
for (const size of [16, 32, 48, 128]) await copyFile(`public/icon-${size}.png`, `${outdir}/icon-${size}.png`);
let popup = await readFile("src/popup.html", "utf8");
if (beta) popup = popup.replace('<details id="server-settings">', '<details id="server-settings" hidden>');
await writeFile(`${outdir}/popup.html`, popup);
