import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { homeConfig, initHomeConfig, saveHomeOrigin, composeEnvironment, archiveHash, verifyArchive } from "./lib/home-beta.mjs";

test("home setup can wait for a domain and never rotates secrets on rerun", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wr-home-test-"));
  try {
    const config = await initHomeConfig(directory);
    assert.equal(config.publicOrigin, null);
    assert.throws(() => composeEnvironment(config), /stable public/);
    const original = await readFile(join(directory, "postgres-password"), "utf8");
    assert.match(original, /^[a-f0-9]{64}$/);
    await initHomeConfig(directory, "https://beta.wikirace.net", 4200);
    assert.equal(await readFile(join(directory, "postgres-password"), "utf8"), original);
    const selected = await saveHomeOrigin(directory, "https://beta.wikirace.net/");
    assert.equal(composeEnvironment(selected), "WIKIRACE_PUBLIC_ORIGIN=https://beta.wikirace.net\nWIKIRACE_HOME_PORT=4100\n");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test("home configuration rejects private/placeholder origins and invalid ports", () => {
  for (const publicOrigin of ["http://host.net", "https://127.0.0.1", "https://beta.example.com", "https://host.net/path", "https://u:p@host.net", "https://host.net\nKEY=value"]) {
    assert.throws(() => homeConfig({ version: 1, publicOrigin, port: 4100 }));
  }
  for (const port of [0, 80, 65536, 4100.5, "4100"]) assert.throws(() => homeConfig({ version: 1, port }));
});
test("restore refuses changed archive bytes and unrelated metadata", () => {
  const bytes = Buffer.from("archive fixture");
  const manifest = { format: "wikirace-home-backup-v1", database: "wikirace_beta", createdAt: new Date().toISOString(), sha256: archiveHash(bytes) };
  verifyArchive(bytes, manifest);
  assert.throws(() => verifyArchive(Buffer.from("changed"), manifest));
  assert.throws(() => verifyArchive(bytes, { ...manifest, database: "production" }));
});
