import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const app = buildApp();
let origin: string;
type Session = { gameId: string; playerId: string; playerToken: string; [key: string]: any };
const auth = (p: Session) => ({ authorization: `Bearer ${p.playerToken}` });
before(async () => { origin = await app.listen({ port: 0, host: "127.0.0.1" }); });
after(async () => { await app.close(); await prisma.$disconnect(); });
async function create(mode = "NORMAL"): Promise<Session> {
  const response = await app.inject({ method: "POST", url: "/games", payload: { mode, displayName: "Host" } });
  assert.equal(response.statusCode, 201, response.body); return response.json();
}
async function join(p: Session): Promise<Session> {
  const response = await app.inject({ method: "POST", url: `/games/${p.gameId}/players`, payload: { displayName: "Guest" } });
  assert.equal(response.statusCode, 200, response.body); return response.json();
}
function send(p: Session, path: string, body: object = {}) {
  return app.inject({ method: "POST", url: `/games/${p.gameId}${path}`, headers: auth(p), payload: { playerId: p.playerId, ...body } });
}
async function post(p: Session, path: string, body: object = {}, expected = 200) {
  const response = await send(p, path, body);
  assert.equal(response.statusCode, expected, response.body); return response.json();
}
async function state(p: Session) {
  const response = await app.inject({ url: `/games/${p.gameId}/state?playerId=${p.playerId}`, headers: auth(p) });
  assert.equal(response.statusCode, 200, response.body); return response.json();
}
const ownReady = (s: any, id = s.playerId) => s.players.find((p: any) => p.id === id).isReady;
const ready = (p: Session, isReady = true) => post(p, "/ready", { isReady });

test("both modes require every current player including the host to explicitly ready", async () => {
  for (const mode of ["NORMAL", "LOCKOUT"]) {
    const host = await create(mode); const guest = await join(host);
    assert.equal(ownReady(host), false); assert.equal(ownReady(guest), false);
    const waiting = await state(host);
    await post(host, "/start", {}, 409);
    assert.deepEqual(await state(host), waiting, "A refused start must not change revision, time or progress");
    await ready(guest); await post(host, "/start", {}, 409);
    await ready(host); await post(guest, "/start", {}, 403);
    const active = await post(host, "/start");
    assert.equal(active.status, "ACTIVE"); assert.ok(active.startedAt); assert.equal(active.completedSquareIds.length, 0);
    const late = await join(host); assert.equal(ownReady(late), false);
    const before = await state(host); assert.deepEqual(await post(host, "/start"), before);
    for (const p of [host, guest, late]) await post(p, "/ready", { isReady: true }, 409);
    await post(host, "/end"); await post(host, "/ready", { isReady: false }, 409);
  }
});

test("ready setters validate booleans and cannot impersonate another, foreign or departed player", async () => {
  const host = await create(); const guest = await join(host); const foreign = await create();
  const before = await state(host);
  for (const isReady of [undefined, null, 0, 1, "false", "true", {}, []]) await post(host, "/ready", { isReady }, 400);
  for (const [playerId, headers] of [[host.playerId, {}], [guest.playerId, auth(host)], [host.playerId, auth(foreign)], [foreign.playerId, auth(foreign)]] as const) {
    const response = await app.inject({ method: "POST", url: `/games/${host.gameId}/ready`, headers, payload: { playerId, isReady: true } });
    assert.equal(response.statusCode, 401, response.body);
  }
  assert.deepEqual(await state(host), before);
  const current = await ready(host);
  for (const key of ["playerToken", "sessionTokenHash", "admissionRequestHash"]) assert.ok(!JSON.stringify(current).includes(key));
  await post(guest, `/players/${guest.playerId}/leave`); await post(guest, "/ready", { isReady: true }, 401);
});

test("desired readiness is idempotent under retries and broadcasts only committed changes", async () => {
  const host = await create(); const socket = new WebSocket(`${origin.replace("http", "ws")}/ws/${host.gameId}`);
  const messages: any[] = []; socket.on("message", data => { const message = JSON.parse(String(data)); if (message.type === "GAME_STATE_UPDATED") messages.push(message); });
  await once(socket, "open");
  try {
    assert.equal((await ready(host, false)).revision, 0);
    const notice = once(socket, "message", { signal: AbortSignal.timeout(3000) });
    const replies = await Promise.all(Array.from({ length: 12 }, () => ready(host))); await notice;
    assert.ok(replies.every(s => ownReady(s) && s.revision === 1));
    const publicly = (await app.inject({ url: `/games/${host.gameId}/spectator` })).json();
    assert.equal(ownReady(publicly, host.playerId), true);
    const lastNotice = once(socket, "message", { signal: AbortSignal.timeout(3000) });
    const unready = await ready(host, false); await lastNotice;
    assert.equal(unready.revision, 2); assert.equal(ownReady(unready), false);
    assert.equal((await ready(host, false)).revision, 2);
    assert.equal(messages.length, 2); assert.ok(messages.every(m => m.type === "GAME_STATE_UPDATED" && m.data === undefined));
  } finally { const closed = once(socket, "close"); socket.close(); await closed; }
});

test("joins close the start gate, departures release it and host transfer preserves remaining readiness", async () => {
  const host = await create(); await ready(host);
  const guest = await join(host); await post(host, "/start", {}, 409);
  await ready(guest); const late = await join(host); await post(host, "/start", {}, 409);
  await post(late, `/players/${late.playerId}/leave`); await post(host, `/players/${host.playerId}/leave`);
  const current = await state(guest);
  assert.equal(current.hostPlayerId, guest.playerId); assert.equal(ownReady(current), true); assert.equal(current.playerCount, 1);
  assert.equal((await post(guest, "/start")).status, "ACTIVE");
});

test("team changes clear only the moving player's readiness and same-team retries preserve it", async () => {
  const host = await create("LOCKOUT"); const guest = await join(host);
  const team = await post(host, "/teams", { name: "Ready team" }); await ready(host); await ready(guest);
  const moved = await post(guest, `/teams/${team.id}/join`);
  assert.equal(ownReady(moved), false); assert.equal(ownReady(moved, host.playerId), true);
  await post(host, "/start", {}, 409); const prepared = await ready(guest);
  assert.deepEqual(await post(guest, `/teams/${team.id}/join`), prepared);
  const left = await post(guest, "/teams/leave"); assert.equal(ownReady(left), false);
  await ready(guest); const before = await state(host);
  await post(host, "/teams", { name: "Another team" });
  assert.equal(ownReady(await state(host)), true); assert.equal((await state(host)).revision, before.revision + 1);
  assert.equal((await post(host, "/start")).status, "ACTIVE");
});

test("rematches start unready, preserve readiness on recovery and require new-round credentials", async () => {
  for (const mode of ["NORMAL", "LOCKOUT"]) {
    const host = await create(mode); const guest = await join(host);
    await ready(host); await ready(guest); await post(host, "/start"); await post(host, "/end");
    const next = await post(host, "/rematch") as Session; const nextGuest = await post(guest, "/rematch") as Session;
    assert.ok(nextGuest.players.every((p: any) => !p.isReady));
    await post(next, "/start", {}, 409); await ready(next); await ready(nextGuest);
    const before = await state(next);
    assert.equal(ownReady(await post(host, "/rematch")), true); assert.deepEqual(await state(next), before);
    await post({ ...host, gameId: next.gameId, playerId: next.playerId }, "/ready", { isReady: false }, 401);
    assert.equal((await post(next, "/start")).status, "ACTIVE");
    assert.ok((await state(host)).players.every((p: any) => p.isReady), "Previous-round records stay unchanged");
  }
});

test("concurrent unready and start have one serialized outcome", async () => {
  for (let iteration = 0; iteration < 12; iteration++) {
    const host = await create(iteration % 2 ? "NORMAL" : "LOCKOUT"); const guest = await join(host);
    await ready(host); await ready(guest);
    const actions = [() => send(host, "/start"), () => send(guest, "/ready", { isReady: false })];
    if (iteration % 2) actions.reverse();
    const replies = await Promise.all(actions.map(fn => fn()));
    assert.deepEqual(replies.map(r => r.statusCode).sort(), [200, 409]);
    const current = await state(host);
    if (current.status === "ACTIVE") assert.equal(ownReady(current, guest.playerId), true);
    else { assert.equal(current.status, "WAITING"); assert.equal(current.startedAt, null); assert.equal(ownReady(current, guest.playerId), false); }
    assert.equal(current.revision, 4, "Join, two ready changes and exactly one successful raced mutation");
  }
});

test("a concurrent join either blocks start or enters the already-active match", async () => {
  for (let iteration = 0; iteration < 8; iteration++) {
    const host = await create(); await ready(host);
    const actions = [() => send(host, "/start"), () => app.inject({ method: "POST", url: `/games/${host.gameId}/players`, payload: { displayName: "Racing join" } })];
    if (iteration % 2) actions.reverse();
    const replies = await Promise.all(actions.map(fn => fn()));
    const joined = replies.find(r => r.statusCode === 200 && r.json().playerToken)!;
    assert.ok(joined); const current = await state(host);
    assert.equal(current.status, joined.json().status);
    assert.ok(replies.every(r => r.statusCode === 200 || r.statusCode === 409));
    assert.equal(current.playerCount, 2); assert.equal(ownReady(joined.json()), false);
    if (current.status === "WAITING") assert.equal(replies.filter(r => r.statusCode === 409).length, 1);
  }
});
