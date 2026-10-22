import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBetaOrigin, checkHostedBeta } from "./lib/beta-release.mjs";
const origin = "https://wikirace-demo.onrender.com";
const data = {
  "/ready": { status: "ready" },
  "/deployment": { profile: "beta", publicOrigin: origin, scoredArticlesOnly: true, advertising: false },
  "/privacy": "<p>Operator: WikiRace <a href='mailto:fixture@example.com'>contact</a></p>",
  "/downloads/checksums.json": { profile: "beta", apiOrigin: origin, version: "1.10.0", sha256: "a".repeat(64) },
};
const mock = (overrides = {}) => async (url, options) => {
  assert.equal(options.redirect, "error");
  const value = { ...data, ...overrides }[new URL(url).pathname];
  return new Response(typeof value === "string" ? value : JSON.stringify(value), { status: 200 });
};
test("release origin rejects local, insecure, placeholder and credential-bearing addresses", () => {
  for (const bad of [undefined, "http://host.com", "https://localhost", "https://localhost.", "https://127.0.0.1", "https://10.0.0.1", "https://[::1]", "https://beta.example.com", "https://name.local", "https://host.com/path", "https://u:p@host.com"]) assert.throws(() => validateBetaOrigin(bad));
  assert.equal(validateBetaOrigin(origin), origin);
});
test("release preflight checks readiness, beta privacy/configuration and hosted package identity", async () => {
  assert.equal((await checkHostedBeta(origin, mock())).sha256, "a".repeat(64));
  for (const overrides of [
    { "/ready": { status: "unavailable" } },
    { "/deployment": { ...data["/deployment"], profile: "local" } },
    { "/deployment": { ...data["/deployment"], publicOrigin: "https://elsewhere.onrender.com" } },
    { "/privacy": "Draft policy without a contact" },
    { "/downloads/checksums.json": { ...data["/downloads/checksums.json"], profile: "local" } },
    { "/downloads/checksums.json": { ...data["/downloads/checksums.json"], sha256: "bad" } },
  ]) await assert.rejects(() => checkHostedBeta(origin, mock(overrides)));
  await assert.rejects(() => checkHostedBeta(origin, async () => new Response("down", { status: 503 })));
});
