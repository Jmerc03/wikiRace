import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { DEFAULT_BOARD_CONFIG } from "@bingo/shared";
import { getBoardSetupOptions } from "@bingo/game-engine";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
const app = buildApp();
before(() => app.ready());
after(async () => { await app.close(); await prisma.$disconnect(); });
const key = () => randomBytes(32).toString("base64url");
const auth = (p: any) => ({ authorization: `Bearer ${p.playerToken}` });
async function create(body: object, admissionKey?: string) {
  return app.inject({ method: "POST", url: "/games", payload: body, headers: admissionKey ? { "idempotency-key": admissionKey } : {} });
}
async function post(p: any, path: string, body: object = {}) {
  const r = await app.inject({ method: "POST", url: `/games/${p.gameId}${path}`, headers: auth(p), payload: { playerId: p.playerId, ...body } });
  assert.equal(r.statusCode, 200, r.body); return r.json();
}
test("public board options match the generator and expose only capacity metadata", async () => {
  const response = await app.inject({ url: "/games/board-options" });
  assert.equal(response.statusCode, 200); assert.deepEqual(response.json(), getBoardSetupOptions());
  assert.deepEqual(Object.keys(response.json()), ["articleCapacities"]);
  for (const capacities of Object.values(response.json().articleCapacities) as number[][]) {
    assert.equal(capacities.length, 25); assert.equal(capacities[0], 11); assert.equal(capacities[1], 22); assert.equal(capacities[2], 25);
  }
});

test("invalid custom setups return 400 without persisting a partial game or consuming an admission key", async () => {
  const displayName = "Invalid custom setup fixture";
  const gameFilter = { players: { some: { displayName } } };
  const games = await prisma.game.count({ where: gameFilter }); const players = await prisma.player.count({ where: { displayName } });
  for (const changes of [{ vitalArticleTileCount: 12, genericTileCount: 13, maxTilesPerTopic: 1 }, { vitalArticleTileCount: 23, genericTileCount: 2, maxTilesPerTopic: 2 }, { genericTileCount: 9 }, { vitalArticleTileCount: 1.5 }, { maxTilesPerTopic: 26 }, { difficulty: "MEDIUM" }]) {
    const response = await create({ displayName, boardConfig: { ...DEFAULT_BOARD_CONFIG, ...changes } }, key());
    assert.equal(response.statusCode, 400, response.body);
  }
  assert.equal(await prisma.game.count({ where: gameFilter }), games); assert.equal(await prisma.player.count({ where: { displayName } }), players);
  const admissionKey = key();
  assert.equal((await create({ boardConfig: { ...DEFAULT_BOARD_CONFIG, maxTilesPerTopic: 1 } }, admissionKey)).statusCode, 400);
  const accepted = await create({ boardConfig: { ...DEFAULT_BOARD_CONFIG, vitalArticleTileCount: 11, genericTileCount: 14, maxTilesPerTopic: 1 } }, admissionKey);
  assert.equal(accepted.statusCode, 201, accepted.body);
});

test("custom settings are identical for joined players, spectators, persistent reads and fresh rematches in both modes", async () => {
  for (const mode of ["NORMAL", "LOCKOUT"]) for (const [count, cap] of [[0, 1], [11, 1], [22, 2], [25, 3]]) {
    const config = { difficulty: "HARD", vitalArticleTileCount: count, genericTileCount: 25 - count, maxTilesPerTopic: cap };
    const response = await create({ mode, displayName: "Custom host", boardConfig: config }); assert.equal(response.statusCode, 201, response.body);
    const host = response.json(); assert.deepEqual(host.boardConfig, config); assert.equal(host.board.squares.filter((s: any) => s.type === "VISIT_ARTICLE").length, count);
    const guest = (await app.inject({ method: "POST", url: `/games/${host.gameId}/players`, payload: { displayName: "Guest" } })).json();
    assert.deepEqual(guest.boardConfig, config); assert.deepEqual(guest.board, host.board);
    const viewer = (await app.inject({ url: `/games/${host.gameId}/spectator` })).json(); assert.deepEqual(viewer.boardConfig, config);
    assert.deepEqual((await prisma.game.findUniqueOrThrow({ where: { id: host.gameId } })).boardConfig, config);
    await post(host, "/ready", { isReady: true }); await post(guest, "/ready", { isReady: true }); await post(host, "/start"); await post(host, "/end");
    const next = await post(host, "/rematch"); assert.deepEqual(next.boardConfig, config); assert.equal(next.status, "WAITING"); assert.equal(next.players[0].isReady, false);
    assert.equal(next.board.squares.length, 25); assert.equal(next.board.squares.filter((s: any) => s.type === "VISIT_ARTICLE").length, count);
    assert.notEqual(next.board.id, host.board.id); assert.equal(next.board.squares.some((s: any) => host.board.squares.some((old: any) => old.id === s.id)), false);
    assert.deepEqual((await post(guest, "/rematch")).boardConfig, config);
  }
});

test("exact create retries retain the original custom board, conflicting setup is rejected and old defaults still work", async () => {
  const admissionKey = key(); const payload = { boardConfig: { ...DEFAULT_BOARD_CONFIG, vitalArticleTileCount: 7, genericTileCount: 18, maxTilesPerTopic: 1 } };
  const first = (await create(payload, admissionKey)).json(); const replay = await create(payload, admissionKey);
  assert.equal(replay.statusCode, 201); assert.deepEqual(replay.json(), first);
  const conflict = await create({ boardConfig: { ...payload.boardConfig, maxTilesPerTopic: 2 } }, admissionKey); assert.equal(conflict.statusCode, 409);
  assert.deepEqual((await app.inject({ url: `/games/${first.gameId}/state?playerId=${first.playerId}`, headers: auth(first) })).json().boardConfig, payload.boardConfig);
  assert.deepEqual((await create({})).json().boardConfig, DEFAULT_BOARD_CONFIG);
});
