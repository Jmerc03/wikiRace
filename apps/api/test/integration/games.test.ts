import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const app = buildApp();
let origin: string;
before(async () => { origin = await app.listen({ port: 0, host: "127.0.0.1" }); });
after(async () => { await app.close(); await prisma.$disconnect(); });

async function createGame(mode = "NORMAL") {
  const response = await app.inject({ method: "POST", url: "/games", payload: { mode, displayName: "Host" } });
  assert.equal(response.statusCode, 201, response.body);
  const game = response.json();
  for (const square of game.board.squares) {
    await prisma.boardSquare.update({ where: { id: square.id }, data: { type: "VISIT_ARTICLE", condition: { title: `Fixture ${square.position}` } } });
  }
  return { gameId: game.id, playerId: game.players[0].id, game };
}
async function join(gameId: string, displayName = "Guest") {
  const response = await app.inject({ method: "POST", url: `/games/${gameId}/players`, payload: { displayName } });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}
async function visit(gameId: string, playerId: string, position: number) {
  const response = await app.inject({ method: "POST", url: `/games/${gameId}/events/page-visit`, payload: {
    playerId, title: `Fixture ${position}`, url: `https://en.wikipedia.org/wiki/Fixture_${position}`, categories: [], links: [],
  } });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}
async function state(gameId: string, playerId: string) {
  const response = await app.inject({ url: `/games/${gameId}/state?playerId=${playerId}` });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}

test("create/join persists a valid board, names, and distinct player identities", async () => {
  const host = await createGame();
  const guest = await join(host.gameId, "Racer");
  assert.equal(host.game.board.squares.length, 25);
  assert.deepEqual(host.game.board.squares.map((s: any) => s.position).sort((a: number,b: number) => a-b), Array.from({length:25}, (_,i)=>i));
  assert.notEqual(host.playerId, guest.playerId);
  assert.equal(guest.playerName, "Racer");
  assert.equal((await state(host.gameId, host.playerId)).playerCount, 2);
});

test("Normal progress persists independently and duplicate visits do not duplicate completions", async () => {
  const host = await createGame(); const guest = await join(host.gameId);
  await visit(host.gameId, host.playerId, 0); await visit(host.gameId, host.playerId, 0);
  assert.equal((await state(host.gameId, host.playerId)).completedSquareIds.length, 1);
  assert.equal((await state(host.gameId, guest.playerId)).completedSquareIds.length, 0);
  await visit(host.gameId, guest.playerId, 0);
  assert.equal(await prisma.squareCompletion.count({ where: { gameId: host.gameId } }), 2);
});

test("Normal bingo finishes the game and subsequent visits cannot write", async () => {
  const host = await createGame();
  for (let i=0; i<5; i++) await visit(host.gameId, host.playerId, i);
  const won = await state(host.gameId, host.playerId);
  assert.equal(won.status, "FINISHED"); assert.equal(won.winner, true);
  assert.deepEqual(won.winningLine, [0,1,2,3,4]);
  const count = await prisma.pageVisitEvent.count({ where: { gameId: host.gameId } });
  await visit(host.gameId, host.playerId, 7);
  assert.equal(await prisma.pageVisitEvent.count({ where: { gameId: host.gameId } }), count);
});

test("Lockout first claims persist and a bingo does not finish a game", async () => {
  const host = await createGame("LOCKOUT"); const guest = await join(host.gameId);
  for (let i=0; i<5; i++) await visit(host.gameId, host.playerId, i);
  await visit(host.gameId, guest.playerId, 0);
  const current = await state(host.gameId, guest.playerId);
  assert.equal(current.winner, false); assert.equal(current.status, "ACTIVE");
  assert.equal(current.squareClaims.length, 5);
  assert.equal(current.squareClaims[0].playerId, host.playerId);
});

test("Lockout teammates combine 13 claims into one persisted team winner", async () => {
  const host = await createGame("LOCKOUT"); const guest = await join(host.gameId);
  const teamResponse = await app.inject({ method: "POST", url: `/games/${host.gameId}/teams`, payload: { name: "Blue" } });
  assert.equal(teamResponse.statusCode, 200); const team = teamResponse.json();
  for (const playerId of [host.playerId,guest.playerId]) {
    const joined = await app.inject({ method: "POST", url: `/games/${host.gameId}/teams/${team.id}/join`, payload: { playerId } });
    assert.equal(joined.statusCode, 200);
  }
  for (let i=0; i<13; i++) await visit(host.gameId, i%2 ? guest.playerId : host.playerId, i);
  for (const playerId of [host.playerId,guest.playerId]) {
    const result = await state(host.gameId, playerId);
    assert.equal(result.status, "FINISHED"); assert.equal(result.winningOwner.id, team.id);
    assert.equal(result.winningLine, null);
  }
});

test("real WebSocket clients receive the committed page-visit update", async () => {
  const host = await createGame();
  const ws = new WebSocket(`${origin.replace("http:","ws:")}/ws/${host.gameId}`);
  const messages: any[] = [];
  ws.on("message", data => messages.push(JSON.parse(data.toString())));
  await once(ws,"open");
  try {
    const update = new Promise<any>((resolve,reject) => {
      const timer = setTimeout(()=>reject(new Error("WebSocket update timeout")),3000);
      ws.on("message", data => { const message=JSON.parse(data.toString()); if (message.type==="GAME_STATE_UPDATED") { clearTimeout(timer); resolve(message); } });
    });
    await visit(host.gameId, host.playerId, 0);
    const message = await update;
    assert.equal(message.type, "GAME_STATE_UPDATED");
    assert.equal((await state(host.gameId, host.playerId)).completedSquareIds.length, 1);
  } finally { const closed=once(ws,"close"); ws.close(); await closed; }
});
