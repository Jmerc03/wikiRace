import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { WebSocket } from "ws";
import { betaConfig } from "../src/config/beta.js";
import { WindowLimiter, permittedOrigin, createSocketBudget } from "../src/services/beta-guards.js";

const settings = { WIKIRACE_DEPLOYMENT: "beta", WIKIRACE_PUBLIC_ORIGIN: "https://game.example.com", WIKIRACE_SUPPORT_EMAIL: "support@example.com", WIKIRACE_OPERATOR_NAME: "Example operator" };
test("beta configuration fails closed on missing contacts, unsafe origins and proxy values", () => {
  assert.equal(betaConfig({}), undefined);
  assert.equal(betaConfig(settings)?.maxGames, 200);
  assert.equal(betaConfig(settings)?.hostingProvider, "render");
  assert.equal(betaConfig({ ...settings, WIKIRACE_HOSTING_PROVIDER: "home-cloudflare" })?.hostingProvider, "home-cloudflare");
  assert.throws(() => betaConfig({ ...settings, WIKIRACE_HOSTING_PROVIDER: "unknown" }));
  for (const overrides of [ { WIKIRACE_PUBLIC_ORIGIN: "http://game.example.com" }, { WIKIRACE_PUBLIC_ORIGIN: "https://game.example.com/path" },
    { WIKIRACE_SUPPORT_EMAIL: "" }, { WIKIRACE_OPERATOR_NAME: "" }, { WIKIRACE_TRUST_PROXY_HOPS: "true" }, { WIKIRACE_DEPLOYMENT: "typo" }]) {
    assert.throws(() => betaConfig({ ...settings, ...overrides }));
  }
  assert.equal(betaConfig({ ...settings, WIKIRACE_PUBLIC_ORIGIN: undefined, RENDER_EXTERNAL_URL: "https://game.onrender.com" })?.publicOrigin, "https://game.onrender.com");
});
test("rate limits isolate clients, reset at expiry and bound distinct-key memory", () => {
  const limit = new WindowLimiter(2);
  assert.equal(limit.take("a", 1, 1000, 0), 0);
  assert.equal(limit.take("a", 1, 1000, 500), 1);
  assert.equal(limit.take("b", 1, 1000, 500), 0);
  assert.equal(limit.take("c", 1, 1000, 500), 1);
  assert.equal(limit.take("c", 1, 1000, 1000), 0);
  assert.equal(limit.take("b", 1, 1000, 1000), 1);
});
test("only same-site, extension and originless clients pass the beta origin check", () => {
  const config = betaConfig(settings)!;
  for (const origin of [undefined, config.publicOrigin, `chrome-extension://${"a".repeat(32)}`]) assert.ok(permittedOrigin(origin, config));
  for (const origin of ["null", "https://attacker.example", `${config.publicOrigin}.attacker.example`, "chrome-extension://fake"]) assert.equal(permittedOrigin(origin, config), false);
});
test("socket budget accounts for close once and separates per-IP and total caps", () => {
  const reserve = createSocketBudget(2, 1);
  const make = () => Object.assign(new EventEmitter(), { close: () => {} }) as unknown as WebSocket;
  const a = make(); const b = make();
  assert.ok(reserve(a, "a")); assert.equal(reserve(make(), "a"), false);
  assert.ok(reserve(b, "b")); assert.equal(reserve(make(), "c"), false);
  a.emit("close"); a.emit("close");
  assert.ok(reserve(make(), "c")); assert.equal(reserve(make(), "d"), false);
});
