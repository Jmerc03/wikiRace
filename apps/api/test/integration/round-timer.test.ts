import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { expireDueRounds, expireLockedRound } from "../../src/services/round-timer.js";
const app = buildApp({ roundTimers: false }); let origin: string;
before(async () => { origin = await app.listen({ host: "127.0.0.1", port: 0 }); });
after(async () => { await app.close(); await prisma.$disconnect(); });
const key = () => randomBytes(32).toString("base64url");
const auth = (p: any) => ({ authorization: `Bearer ${p.playerToken}` });
async function create(mode = "NORMAL", timeLimitSeconds: number | null = 60, admissionKey = key()) {
  const payload = { mode, displayName: "Timed fixture", timeLimitSeconds };
  const r = await app.inject({ method: "POST", url: "/games", payload, headers: { "idempotency-key": admissionKey } });
  assert.equal(r.statusCode, 201, r.body); return { ...r.json(), admissionKey, payload };
}
async function post(p: any, path: string, body: object = {}, expected = 200) {
  const r = await app.inject({ method: "POST", url: `/games/${p.gameId}${path}`, headers: auth(p), payload: { playerId: p.playerId, ...body } });
  assert.equal(r.statusCode, expected, r.body); return r.json();
}
async function state(p: any) { const r = await app.inject({ url: `/games/${p.gameId}/state?playerId=${p.playerId}`, headers: auth(p) }); assert.equal(r.statusCode, 200); return r.json(); }
const visit = (p: any, n = 0) => post(p, "/events/page-visit", { title: `Timer fixture ${n}`, url: `https://en.wikipedia.org/wiki/Timer_fixture_${n}` });
async function start(p: any) { await post(p, "/ready", { isReady: true }); return post(p, "/start"); }
async function deadline(p: any, milliseconds = -1000) {
  const expiresAt = new Date(Date.now() + milliseconds);
  await prisma.game.update({ where: { id: p.gameId }, data: { startedAt: new Date(expiresAt.getTime() - 60000), expiresAt } });
  return expiresAt;
}
async function fixture(p: any) {
  const squares = await prisma.boardSquare.findMany({ where: { board: { gameId: p.gameId } } });
  for (const square of squares) await prisma.boardSquare.update({ where: { id: square.id }, data: { type: "VISIT_ARTICLE", condition: { title: `Timer fixture ${square.position}` } } });
}

test("duration validation, untimed compatibility, clock headers and waiting/start idempotence", async () => {
  for (const value of [0, -1, 59, 7201, 60.5, "60", true, {}]) {
    const r = await app.inject({ method: "POST", url: "/games", payload: { timeLimitSeconds: value } }); assert.equal(r.statusCode, 400);
  }
  for (const value of [null, 60, 90, 7200]) {
    const p = await create("NORMAL", value); assert.equal(p.timeLimitSeconds, value); assert.equal(p.expiresAt, null);
    const before = await state(p); const started = await start(p); const retried = await post(p, "/start");
    assert.equal(retried.startedAt, started.startedAt); assert.equal(retried.expiresAt, started.expiresAt); assert.equal(retried.revision, started.revision);
    assert.equal(started.revision, before.revision + 2);
    assert.equal(started.expiresAt === null, value === null);
    if (value) assert.equal(Date.parse(started.expiresAt) - Date.parse(started.startedAt), value * 1000);
  }
  const old = (await app.inject({ method: "POST", url: "/games", payload: {} })).json(); assert.equal(old.timeLimitSeconds, null);
  const response = await app.inject({ url: "/ready", headers: { origin: "https://example.test" } });
  assert.ok(Math.abs(Number(response.headers["x-wikirace-time"]) - Date.now()) < 1000);
  assert.match(String(response.headers["access-control-expose-headers"]), /X-WikiRace-Time/i);
});

for (const mode of ["NORMAL", "LOCKOUT"]) test(`${mode}: overdue visits finish once at the deadline without storing an event or inventing a winner`, async () => {
  const p = await create(mode); await start(p); const expiresAt = await deadline(p); const before = await state(p);
  assert.equal(before.status, "ACTIVE", "read-only state does not execute a player mutation");
  const results = await Promise.all(Array.from({ length: 6 }, () => visit(p)));
  for (const result of results) { assert.equal(result.status, "FINISHED"); assert.equal(result.endReason, "TIME_LIMIT"); assert.equal(result.winner, false); assert.equal(result.finishedAt, expiresAt.toISOString()); assert.equal(result.revision, before.revision + 1); }
  assert.equal(await prisma.pageVisitEvent.count({ where: { gameId: p.gameId } }), 0);
  assert.equal(await prisma.squareClaim.count({ where: { gameId: p.gameId } }), 0); assert.equal(await prisma.squareCompletion.count({ where: { gameId: p.gameId } }), 0);
  await expireDueRounds(); assert.deepEqual(await state(p), results[0]);
});

test("a visit queued behind the row lock until after the deadline cannot score", async () => {
  const p = await create(); await start(p); await fixture(p); await deadline(p, 350);
  let acquired!: () => void; let release!: () => void; const ready = new Promise<void>(r => { acquired = r; }); const held = new Promise<void>(r => { release = r; });
  const holding = prisma.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM "Game" WHERE id=${p.gameId} FOR UPDATE`; acquired(); await held; });
  await ready; let settled = false; const scoring = visit(p).finally(() => { settled = true; });
  await delay(100); assert.equal(settled, false); await delay(350); release(); await holding;
  const result = await scoring; assert.equal(result.endReason, "TIME_LIMIT"); assert.equal(result.completedSquareIds.length, 0);
  assert.equal(await prisma.pageVisitEvent.count({ where: { gameId: p.gameId } }), 0);
});

for (const mode of ["NORMAL", "LOCKOUT"]) test(`${mode}: an already won round keeps its outcome when its deadline passes`, async () => {
  const p = await create(mode); await fixture(p); await start(p);
  let won: any; for (let n = 0; n < (mode === "NORMAL" ? 5 : 13); n++) won = await visit(p, n);
  assert.equal(won.endReason, mode === "NORMAL" ? "BINGO" : "MAJORITY"); assert.equal(won.winner, true);
  await prisma.game.update({ where: { id: p.gameId }, data: { expiresAt: new Date(Date.now() - 1) } });
  await expireDueRounds(); const later = await visit(p, 24);
  assert.equal(later.endReason, won.endReason); assert.deepEqual(later.winningOwner, won.winningOwner); assert.equal(later.finishedAt, won.finishedAt); assert.equal(later.revision, won.revision);
});

test("late admission rejects without consuming a key while exact old admission recovers the expired round", async () => {
  const p = await create(); await start(p); await deadline(p);
  const newKey = key(); const response = await app.inject({ method: "POST", url: `/games/${p.gameId}/players`, payload: { displayName: "Late arrival" }, headers: { "idempotency-key": newKey } });
  assert.equal(response.statusCode, 409); assert.equal((await state(p)).endReason, "TIME_LIMIT"); assert.equal(await prisma.player.count({ where: { gameId: p.gameId } }), 1);
  const recovered = await app.inject({ method: "POST", url: "/games", payload: p.payload, headers: { "idempotency-key": p.admissionKey } });
  assert.equal(recovered.statusCode, 201); assert.equal(recovered.json().gameId, p.gameId); assert.equal(recovered.json().endReason, "TIME_LIMIT");
  const next = await create("NORMAL", null, newKey); assert.notEqual(next.gameId, p.gameId);
});

test("host transfer preserves the deadline; rematch copies the duration and starts a fresh clock", async () => {
  const p = await create("LOCKOUT", 300); const guest = (await app.inject({ method: "POST", url: `/games/${p.gameId}/players`, payload: { displayName: "Next host" } })).json();
  await post(p, "/ready", { isReady: true }); await post(guest, "/ready", { isReady: true }); const initial = await post(p, "/start");
  await post(p, `/players/${p.playerId}/leave`); const transferred = await state(guest); assert.equal(transferred.hostPlayerId, guest.playerId); assert.equal(transferred.expiresAt, initial.expiresAt);
  await deadline(guest); const next = await post(guest, "/rematch"); assert.equal(next.timeLimitSeconds, 300); assert.equal(next.expiresAt, null); assert.equal(next.startedAt, null);
  const active = await start(next); assert.equal(Date.parse(active.expiresAt) - Date.parse(active.startedAt), 300000);
  await deadline(next); const recovered = await post(guest, "/rematch"); assert.equal(recovered.playerId, next.playerId); assert.equal(recovered.endReason, "TIME_LIMIT"); assert.equal(recovered.playerToken, next.playerToken);
});

test("idle expiry broadcasts once and startup catches deadlines that passed while the API was stopped", async () => {
  const p = await create(); await start(p); await deadline(p);
  const socket = new WebSocket(origin.replace("http", "ws") + `/ws/${p.gameId}`); await once(socket, "open");
  const messages: any[] = []; socket.on("message", data => messages.push(JSON.parse(String(data))));
  const running = buildApp();
  try {
    const before = await prisma.game.findUniqueOrThrow({ where: { id: p.gameId } }); await running.ready();
    assert.equal((await state(p)).endReason, "TIME_LIMIT");
    const idle = await create(); await start(idle); const expiresAt = await deadline(idle, 300);
    for (let attempt = 0; attempt < 40 && (await state(idle)).status !== "FINISHED"; attempt++) await delay(100);
    assert.equal((await state(idle)).finishedAt, expiresAt.toISOString());
    assert.equal((await state(p)).revision, before.revision + 1);
    assert.equal(messages.filter(m => m.type === "GAME_STATE_UPDATED").length, 1);
  } finally { socket.close(); await running.close(); }
});

test("expiry commits even when the triggering operation is rejected, and leaving still works", async () => {
  const p = await create(); await start(p); await deadline(p);
  await post({ ...p, playerToken: "wrong" }, "/ready", { isReady: true }, 401);
  const ended = await state(p); assert.equal(ended.endReason, "TIME_LIMIT");
  await post(p, "/start", {}, 409); await post(p, `/players/${p.playerId}/leave`);
  const row = await prisma.game.findUniqueOrThrow({ where: { id: p.gameId } }); assert.equal(row.endReason, "TIME_LIMIT"); assert.equal(row.finishedAt?.toISOString(), ended.finishedAt);
});


test("UTC deadlines expire identically under UTC, Chicago and Tokyo database session timezones", async () => {
  for (const zone of ["UTC", "America/Chicago", "Asia/Tokyo"]) {
    const p = await create(); await start(p); const expiresAt = await deadline(p);
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE '${zone}'`);
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id=${p.gameId} FOR UPDATE`;
      assert.equal((await expireLockedRound(tx, p.gameId)).length, 1);
    });
    assert.equal((await state(p)).finishedAt, expiresAt.toISOString());
  }
});
