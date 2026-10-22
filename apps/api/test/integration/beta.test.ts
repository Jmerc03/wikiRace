import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { WebSocket } from "ws";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { betaConfig } from "../../src/config/beta.js";
import { pruneFinishedGames } from "../../src/services/beta-storage.js";

const beta = betaConfig({ WIKIRACE_DEPLOYMENT: "beta", WIKIRACE_PUBLIC_ORIGIN: "https://beta.example.com", WIKIRACE_SUPPORT_EMAIL: "support@example.com", WIKIRACE_OPERATOR_NAME: "Test <operator>" })!;
const app = buildApp({ beta, retention: false, roundTimers: false });
after(async () => { await app.close(); await prisma.$disconnect(); });
const key = () => randomBytes(32).toString("base64url");
async function create(mode = "NORMAL", target = app, admission = key()) {
  const response = await target.inject({ method: "POST", url: "/games", headers: { "idempotency-key": admission }, payload: { mode } });
  assert.equal(response.statusCode, 201, response.body); return response.json();
}
async function post(p: any, path: string, payload = {}, target = app) {
  return target.inject({ method: "POST", url: `/games/${p.gameId}${path}`, headers: { authorization: `Bearer ${p.playerToken}` }, payload: { playerId: p.playerId, ...payload } });
}

test("beta blocks foreign HTTP origins and handles extension CORS without exposing secrets", async () => {
  const blocked = await app.inject({ url: "/games/board-options", headers: { origin: "https://foreign.example" } });
  assert.equal(blocked.statusCode, 403);
  const origin = `chrome-extension://${"b".repeat(32)}`;
  const allowed = await app.inject({ method: "OPTIONS", url: "/games", headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type,idempotency-key" } });
  assert.equal(allowed.statusCode, 204); assert.equal(allowed.headers["access-control-allow-origin"], origin);
  const privacy = await app.inject("/privacy");
  assert.equal(privacy.statusCode, 200); assert.ok(privacy.body.includes("Test &lt;operator&gt;"));
  assert.ok(privacy.body.includes("30 days")); assert.equal(privacy.headers["cache-control"], "no-store");
});

test("home hosting discloses the selected operator infrastructure and backup retention", async () => {
  const home = buildApp({ beta: { ...beta, hostingProvider: "home-cloudflare" }, retention: false, roundTimers: false });
  try {
    const policy = (await home.inject("/privacy")).body;
    assert.match(policy, /Cloudflare/);
    assert.match(policy, /personally managed/);
    assert.doesNotMatch(policy, /Render/);
    assert.match(policy, /operator removes those copies/);
    assert.equal((await home.inject("/deployment")).json().hostingProvider, "home-cloudflare");
    assert.equal((await app.inject("/deployment")).json().hostingProvider, "render");
  } finally { await home.close(); }
});

test("beta bounds concurrent HTTP work and releases capacity after responses", async () => {
  const bounded = buildApp({ beta, retention: false, roundTimers: false });
  let release!: () => void;
  let entered = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  bounded.get("/slow", async () => { entered++; await gate; return { ok: true }; });
  try {
    const pending = Array.from({ length: 32 }, () => bounded.inject("/slow"));
    for (let i = 0; entered < 32 && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(entered, 32);
    assert.equal((await bounded.inject("/deployment")).statusCode, 503);
    assert.equal((await bounded.inject("/health")).statusCode, 200);
    release(); assert.ok((await Promise.all(pending)).every(r => r.statusCode === 200));
    assert.equal((await bounded.inject("/deployment")).statusCode, 200);
  } finally { release(); await bounded.close(); }
});

test("create throttling counts invalid attempts, returns Retry-After and does not block health", async () => {
  for (let i = 0; i < 20; i++) assert.equal((await app.inject({ method: "POST", url: "/games", remoteAddress: "192.0.2.20", payload: { mode: "invalid" } })).statusCode, 400);
  const limited = await app.inject({ method: "POST", url: "/games", remoteAddress: "192.0.2.20", payload: {} });
  assert.equal(limited.statusCode, 429); assert.ok(Number(limited.headers["retry-after"]) > 0);
  assert.equal((await app.inject({ url: "/health", remoteAddress: "192.0.2.20" })).statusCode, 200);
  assert.equal((await app.inject({ url: "/games/board-options", remoteAddress: "192.0.2.21" })).statusCode, 200);
});

test("disconnected HTTP clients cannot permanently consume beta concurrency slots", async () => {
  const bounded = buildApp({ beta, retention: false, roundTimers: false });
  let release!: () => void;
  let entered = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  bounded.get("/slow-abort", async () => { entered++; await gate; return { ok: true }; });
  const origin = await bounded.listen({ host: "127.0.0.1", port: 0 });
  const requests = Array.from({ length: 32 }, () => {
    const request = httpRequest(`${origin}/slow-abort`);
    request.on("error", () => {}); request.end(); return request;
  });
  try {
    for (let i = 0; entered < 32 && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(entered, 32);
    const closed = requests.map(request => new Promise<void>(resolve => request.once("close", resolve)));
    for (const request of requests) request.destroy();
    await Promise.all(closed); release();
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal((await fetch(`${origin}/deployment`)).status, 200);
  } finally {
    release(); for (const request of requests) request.destroy(); await bounded.close();
  }
});

test("game quota serializes concurrent creations and preserves idempotent recovery and rematch recovery", async () => {
  const limit = await prisma.game.count() + 1;
  const capped = buildApp({ beta: { ...beta, maxGames: limit }, retention: false, roundTimers: false });
  try {
    const keys = [key(), key()];
    const responses = await Promise.all(keys.map(admission => capped.inject({ method: "POST", url: "/games", headers: { "idempotency-key": admission }, payload: { mode: "NORMAL" } })));
    assert.deepEqual(responses.map(r => r.statusCode).sort(), [201, 503]);
    const index = responses.findIndex(r => r.statusCode === 201); const p = responses[index].json();
    assert.equal((await create("NORMAL", capped, keys[index])).playerId, p.playerId);
    assert.equal((await post(p, "/end", {}, capped)).statusCode, 200);
    assert.equal((await post(p, "/rematch", {}, capped)).statusCode, 503);
    assert.equal(await prisma.game.count(), limit);
    const next = await post(p, "/rematch");
    assert.equal(next.statusCode, 200, next.body);
    const recovered = await post(p, "/rematch", {}, capped);
    assert.equal(recovered.statusCode, 200, recovered.body);
    assert.equal(recovered.json().playerId, next.json().playerId);
    assert.equal(await prisma.game.count(), limit + 1);
  } finally { await capped.close(); }
});

test("lifetime membership quota retains departed history and permits exact join recovery", async () => {
  const p = await create();
  const admission = key();
  const join = (token = admission) => app.inject({ method: "POST", url: `/games/${p.gameId}/players`, headers: { "idempotency-key": token }, payload: { displayName: "Returning tester" } });
  const joined = await join();
  assert.equal(joined.statusCode, 200, joined.body);
  await prisma.player.createMany({ data: Array.from({ length: 62 }, (_, i) => ({ gameId: p.gameId, displayName: `Departed ${i}`, leftAt: new Date() })) });
  assert.equal(await prisma.player.count({ where: { gameId: p.gameId, leftAt: null } }), 2);
  const rejected = await join(key());
  assert.equal(rejected.statusCode, 409); assert.match(rejected.body, /lifetime membership/);
  const recovered = await join();
  assert.equal(recovered.statusCode, 200, recovered.body);
  assert.equal(recovered.json().playerId, joined.json().playerId);
  assert.equal(await prisma.player.count({ where: { gameId: p.gameId } }), 64);
});

test("beta stores only earning articles and discards category/link payloads in both modes", async () => {
  for (const mode of ["NORMAL", "LOCKOUT"]) {
    const p = await create(mode);
    const squares = await prisma.boardSquare.findMany({ where: { board: { gameId: p.gameId } } });
    for (const [i, square] of squares.entries()) await prisma.boardSquare.update({ where: { id: square.id }, data: { type: "TITLE_CONTAINS", condition: { text: `Beta match ${i}` } } });
    await post(p, "/ready", { isReady: true }); await post(p, "/start");
    const visit = { url: "https://en.wikipedia.org/wiki/Example", title: "Nothing matches", categories: ["Private fixture"], links: ["/wiki/Other"] };
    assert.equal((await post(p, "/events/page-visit", visit)).statusCode, 200);
    assert.equal(await prisma.pageVisitEvent.count({ where: { gameId: p.gameId } }), 0);
    const scored = await post(p, "/events/page-visit", { ...visit, title: "Beta match 0" });
    assert.equal(scored.statusCode, 200, scored.body); assert.equal(scored.json().completedSquares.length, 1);
    await post(p, "/events/page-visit", { ...visit, title: "Beta match 0" });
    const saved = await prisma.pageVisitEvent.findMany({ where: { gameId: p.gameId } });
    assert.equal(saved.length, 1); assert.deepEqual(saved[0].categories, []); assert.deepEqual(saved[0].links, []);
    assert.equal(saved[0].title, "Beta match 0");
  }
});

test("retention deletes only expired finished games, cascades evidence, and preserves newer rematches", async () => {
  const source = await create(); await post(source, "/end");
  const rematch = await post(source, "/rematch"); assert.equal(rematch.statusCode, 200, rematch.body);
  const active = await create(); const recent = await create(); await post(recent, "/end");
  const before = new Date(Date.now() - 31 * 86400000);
  await prisma.game.update({ where: { id: source.gameId }, data: { finishedAt: before } });
  await prisma.game.update({ where: { id: active.gameId }, data: { createdAt: before } });
  assert.equal(await pruneFinishedGames(beta), 1);
  assert.equal(await prisma.game.findUnique({ where: { id: source.gameId } }), null);
  assert.equal(await prisma.player.count({ where: { gameId: source.gameId } }), 0);
  assert.equal((await prisma.game.findUniqueOrThrow({ where: { id: rematch.json().gameId } })).rematchOfGameId, null);
  assert.ok(await prisma.game.findUnique({ where: { id: active.gameId } }));
  assert.ok(await prisma.game.findUnique({ where: { id: recent.gameId } }));
  assert.equal(await pruneFinishedGames(beta), 0);
});

test("beta WebSocket frame flooding is closed while ordinary observers still connect", async () => {
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  const p = await create();
  const socket = new WebSocket(`${origin.replace("http", "ws")}/ws/${p.gameId}`);
  await once(socket, "open"); const closed = once(socket, "close");
  for (let i = 0; i < 31; i++) socket.send(JSON.stringify({ type: "WATCH_PRESENCE" }));
  assert.equal((await closed)[0], 1008);
  const healthy = new WebSocket(`${origin.replace("http", "ws")}/ws/${p.gameId}`);
  await once(healthy, "open"); const done = once(healthy, "close"); healthy.close(); await done;
});
