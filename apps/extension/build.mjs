import { build } from "esbuild";
import { rm, mkdir, copyFile } from "node:fs/promises";
await rm(new URL("./dist", import.meta.url), { recursive: true, force: true });
await mkdir(new URL("./dist", import.meta.url), { recursive: true });
await build({ entryPoints: ["src/background.ts", "src/popup.ts", "src/content.ts"],
  outdir: "dist", bundle: true, format: "iife", target: "chrome116", sourcemap: true });
await copyFile("public/manifest.json", "dist/manifest.json");
await copyFile("src/popup.html", "dist/popup.html");
