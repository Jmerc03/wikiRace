import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { matchStandings } from "@bingo/shared";

const app = buildApp();
let origin: string;
type Session = { gameId: string; playerId: string; playerToken: string; [key: string]: any };
const auth = (p: Session) => ({ authorization: `Bearer ${p.playerToken}` });
before(async () => { origin = await app.listen({ port: 0, host: "127.0.0.1" }); });
after(async () => { await app.close(); await prisma.$disconnect(); });
async function post(p: Session, path: string, body: object = {}, expected = 200) {
  const response = await app.inject({ method: "POST", url: `/games/${p.gameId}${path}`, headers: auth(p), payload: { playerId: p.playerId, ...body } });
  assert.equal(response.statusCode, expected, response.body);
  return response.json();
}
async function create(mode = "NORMAL"): Promise<Session> {
  const response = await app.inject({ method: "POST", url: "/games", payload: { mode, displayName: "Host" } });
  assert.equal(response.statusCode, 201, response.body);
  const p = response.json();
  for (const square of p.board.squares) await prisma.boardSquare.update({ where: { id: square.id }, data: {
    type: "VISIT_ARTICLE", label: `Visit Fixture ${square.position}`, condition: { title: `Fixture ${square.position}` },
  } });
  return p;
}
async function join(p: Session, displayName = "Guest"): Promise<Session> {
  const response = await app.inject({ method: "POST", url: `/games/${p.gameId}/players`, payload: { displayName } });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}
async function state(p: Session) {
  const response = await app.inject({ url: `/games/${p.gameId}/state?playerId=${p.playerId}`, headers: auth(p) });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}
async function visit(p: Session, position: number) {
  return post(p, "/events/page-visit", { title: `Fixture ${position}`, url: `https://en.wikipedia.org/wiki/Fixture_${position}`, categories: ["Private unused category"], links: ["/wiki/Unused"] });
}

async function ready(...players: Session[]) {
  for (const player of players) await post(player, "/ready", { isReady: true });
}

function noSecrets(value: unknown) {
  const json = JSON.stringify(value);
  for (const forbidden of ["sessionTokenHash", "admissionRequestHash", "pageVisitEventId", "rematchSourcePlayerId", "rematchSourceTeamId", "Private unused category", "/wiki/Unused"])
    assert.ok(!json.includes(forbidden), `Public state must not include ${forbidden}`);
}

test("Normal article evidence is per-player, limited to scoring visits and stable on duplicate visits", async () => {
  const host = await create(); const guest = await join(host);
  await ready(host, guest); await post(host, "/start");
  await visit(host, 0); const earned = (await state(host)).squareEvidence;
  await visit(host, 0);
  await post(host, "/events/page-visit", { title: "Unmatched navigation", url: "https://en.wikipedia.org/wiki/Unmatched" });
  assert.deepEqual((await state(host)).squareEvidence, earned);
  assert.equal(earned.length, 1); assert.equal(earned[0].title, "Fixture 0"); assert.equal(earned[0].playerId, host.playerId);
  assert.equal(earned[0].url, "https://en.wikipedia.org/wiki/Fixture_0"); assert.ok(Date.parse(earned[0].earnedAt));
  assert.deepEqual((await state(guest)).squareEvidence, []);
  assert.deepEqual((await app.inject({ url: `/games/${host.gameId}` })).json().squareEvidence, []);
  const spectator = (await app.inject({ url: `/games/${host.gameId}/spectator?playerId=${host.playerId}` })).json();
  assert.deepEqual(spectator.squareEvidence, earned); noSecrets(spectator); noSecrets(await state(host));
  assert.equal((await app.inject({ url: `/games/${host.gameId}/state?playerId=${host.playerId}`, headers: auth(guest) })).statusCode, 401);
  await visit(guest, 0);
  assert.equal((await state(guest)).squareEvidence[0].playerId, guest.playerId);
});

test("one earning article supplies evidence for multiple squares and legacy unsafe links are suppressed", async () => {
  const host = await create();
  for (const square of host.board.squares.filter((s: any) => s.position < 2)) await prisma.boardSquare.update({ where: { id: square.id }, data: { condition: { title: "Fixture 0" } } });
  await ready(host); await post(host, "/start"); await visit(host, 0);
  const before = await state(host); assert.equal(before.squareEvidence.length, 2);
  assert.equal(new Set(before.squareEvidence.map((e: any) => e.url)).size, 1);
  const event = await prisma.pageVisitEvent.findFirstOrThrow({ where: { gameId: host.gameId } });
  await prisma.pageVisitEvent.update({ where: { id: event.id }, data: { url: "javascript:alert(1)", title: "<img src=x onerror=alert(1)>" } });
  const legacy = await state(host);
  assert.ok(legacy.squareEvidence.every((e: any) => e.url === null));
  assert.equal(legacy.squareEvidence[0].title, "<img src=x onerror=alert(1)>", "Titles remain literal text for clients");
});

test("Lockout evidence retains the first earning player when teammates or opponents revisit", async () => {
  const host = await create("LOCKOUT"); const guest = await join(host);
  const team = await post(host, "/teams", { name: "Explorers" });
  await post(host, `/teams/${team.id}/join`); await post(guest, `/teams/${team.id}/join`);
  await ready(host, guest); await post(host, "/start"); await visit(host, 0);
  const first = (await state(host)).squareEvidence;
  await visit(guest, 0); await visit(guest, 1);
  const current = await state(guest);
  assert.deepEqual(current.squareEvidence.find((e: any) => e.squareId === first[0].squareId), first[0]);
  assert.equal(current.squareEvidence.length, 2);
  assert.equal(matchStandings(current)[0].score, 2);
  noSecrets((await app.inject({ url: `/games/${host.gameId}/spectator` })).json());
});

test("rematches require a finished source, its host to create, and a valid original membership", async () => {
  const host = await create(); const guest = await join(host);
  await post(host, "/rematch", {}, 409);
  await ready(host, guest); await post(host, "/start"); await post(host, "/rematch", {}, 409);
  await post(host, "/end"); await post(guest, "/rematch", {}, 403);
  assert.equal((await app.inject({ method: "POST", url: `/games/${host.gameId}/rematch`, payload: { playerId: host.playerId } })).statusCode, 401);
  const foreign = await create();
  await post({ ...foreign, gameId: host.gameId }, "/rematch", {}, 401);
  await post(guest, `/players/${guest.playerId}/leave`);
  await post(guest, "/rematch", {}, 401);
  assert.equal(await prisma.game.count({ where: { rematchOfGameId: host.gameId } }), 0);
});

test("concurrent rematch retries produce one lobby and membership, preserve results and notify both rooms", async () => {
  const host = await create(); const guest = await join(host);
  await ready(host, guest); await post(host, "/start"); for (let position = 0; position < 5; position++) await visit(host, position);
  const original = await state(host);
  const oldBoard = await prisma.board.findUniqueOrThrow({ where: { gameId: host.gameId }, include: { squares: true } });
  const oldVisits = await prisma.pageVisitEvent.findMany({ where: { gameId: host.gameId } });
  const socket = new WebSocket(`${origin.replace("http", "ws")}/ws/${host.gameId}`);
  await once(socket, "open");
  try {
    const notification = once(socket, "message");
    const replies = await Promise.all(Array.from({ length: 12 }, () => post(host, "/rematch")));
    const next = replies[0] as Session;
    await notification;
    assert.ok(replies.every(p => p.gameId === next.gameId && p.playerId === next.playerId && p.playerToken === next.playerToken));
    assert.notEqual(next.playerToken, host.playerToken); assert.notEqual(next.gameId, host.gameId);
    assert.equal(next.previousGameId, host.gameId); assert.equal(next.status, "WAITING");
    assert.equal(next.board.squares.length, 25); assert.equal(next.completedSquareIds.length, 0); assert.equal(next.squareEvidence.length, 0);
    assert.ok(next.board.squares.every((s: any) => !oldBoard.squares.some(old => old.id === s.id)));
    assert.deepEqual(next.boardConfig, original.boardConfig);
    assert.equal(await prisma.game.count({ where: { rematchOfGameId: host.gameId } }), 1);
    assert.equal(await prisma.player.count({ where: { gameId: next.gameId } }), 1);
    assert.equal((await state(host)).revision, original.revision + 1);
    const nextSocket = new WebSocket(`${origin.replace("http", "ws")}/ws/${next.gameId}`); await once(nextSocket, "open");
    try {
      const joinedNotification = once(nextSocket, "message");
      const joins = await Promise.all(Array.from({ length: 8 }, () => post(guest, "/rematch")));
      await joinedNotification;
      assert.ok(joins.every(p => p.playerId === joins[0].playerId && p.playerToken === joins[0].playerToken));
      assert.equal(await prisma.player.count({ where: { gameId: next.gameId } }), 2);
      assert.equal((await state(next)).revision, 1);
      await ready(next, joins[0] as Session);
      const statusNotification = once(socket, "message"); await post(next, "/start"); await statusNotification;
      assert.equal((await state(host)).rematchStatus, "ACTIVE");
    } finally { nextSocket.close(); await once(nextSocket, "close"); }
    const retained = await state(host);
    for (const field of ["winningOwner", "winningLine", "finishedAt", "startedAt", "endReason", "squareEvidence", "completedSquareIds"]) assert.deepEqual(retained[field], original[field]);
    assert.deepEqual(await prisma.board.findUniqueOrThrow({ where: { gameId: host.gameId }, include: { squares: true } }), oldBoard);
    assert.deepEqual(await prisma.pageVisitEvent.findMany({ where: { gameId: host.gameId } }), oldVisits);
    assert.equal((await app.inject({ url: `/games/${next.gameId}/state?playerId=${next.playerId}`, headers: auth(host) })).statusCode, 401);
    const publicState = (await app.inject({ url: `/games/${next.gameId}/spectator` })).json(); noSecrets(publicState);
    assert.ok(!JSON.stringify(publicState).includes(next.playerToken));
  } finally { socket.close(); await once(socket, "close"); }
});

test("rematches carry player and team identity while preserving independent Normal scoring", async () => {
  for (const mode of ["NORMAL", "LOCKOUT"]) {
    const host = await create(mode); const guest = await join(host, "Teammate");
    const team = await post(host, "/teams", { name: "Original team" });
    await post(host, `/teams/${team.id}/join`); await post(guest, `/teams/${team.id}/join`);
    const original = await state(host); await post(host, "/end");
    const next = await post(host, "/rematch") as Session; const nextGuest = await post(guest, "/rematch") as Session;
    assert.equal(nextGuest.teams.length, 1); assert.notEqual(nextGuest.teams[0].id, team.id);
    assert.equal(nextGuest.teams[0].name, team.name); assert.equal(nextGuest.teams[0].color, team.color);
    assert.equal(nextGuest.teams[0].players.length, 2);
    assert.equal(next.playerName, host.playerName); assert.equal(nextGuest.playerName, "Teammate");
    assert.equal(next.players.find((p: any) => p.id === next.playerId).color, original.players.find((p: any) => p.id === host.playerId).color);
    for (const square of next.board.squares) await prisma.boardSquare.update({ where: { id: square.id }, data: { type: "VISIT_ARTICLE", condition: { title: square.position === 0 ? "Fixture 99" : `Unvisited ${square.position}` } } });
    await ready(next, nextGuest); await post(next, "/start"); await visit(next, 99);
    const teammate = await state(nextGuest);
    assert.equal(teammate.completedSquareIds.length, mode === "NORMAL" ? 0 : 1);
    assert.equal(teammate.squareEvidence.length, mode === "NORMAL" ? 0 : 1);
  }
});

test("rematch recovery survives start and finish, rejects new late members and never reenrolls departed members", async () => {
  const host = await create(); const guest = await join(host); const late = await join(host, "Late");
  await post(host, "/end"); const next = await post(host, "/rematch") as Session; const nextGuest = await post(guest, "/rematch") as Session;
  await ready(next, nextGuest); await post(next, "/start");
  const replay = await post(host, "/rematch"); assert.equal(replay.playerId, next.playerId); assert.equal(replay.playerToken, next.playerToken);
  await post(late, "/rematch", {}, 409);
  await post(next, "/end"); assert.equal((await post(host, "/rematch")).status, "FINISHED");
  await post(nextGuest, `/players/${nextGuest.playerId}/leave`); await post(guest, "/rematch", {}, 409);
  assert.equal(await prisma.player.count({ where: { gameId: next.gameId } }), 2);
  const third = await post(next, "/rematch") as Session;
  assert.equal(third.previousGameId, next.gameId); assert.notEqual(third.playerToken, next.playerToken);
  assert.equal((await state(host)).rematchGameId, next.gameId, "Old links continue pointing to their original next round");
});

test("retry does not reset a player's new-lobby team choice and current host transfer controls rematch creation", async () => {
  const host = await create("LOCKOUT"); const guest = await join(host);
  const team = await post(host, "/teams", { name: "Old team" }); await post(guest, `/teams/${team.id}/join`);
  await post(host, "/end"); await post(host, `/players/${host.playerId}/leave`);
  const next = await post(guest, "/rematch") as Session;
  assert.equal(next.hostPlayerId, next.playerId);
  await post(next, "/teams/leave");
  const replay = await post(guest, "/rematch");
  assert.equal(replay.players.find((p: any) => p.id === next.playerId).teamId, null);
  assert.equal(replay.teams.length, 1);
});

test("rematch joins share the normal lobby capacity limit without reserving duplicate places", async () => {
  const host = await create(); const guest = await join(host);
  await post(host, "/end"); const next = await post(host, "/rematch") as Session;
  await prisma.player.createMany({ data: Array.from({ length: 31 }, (_, i) => ({ gameId: next.gameId, displayName: `Seat ${i}` })) });
  await post(guest, "/rematch", {}, 409);
  assert.equal((await post(host, "/rematch")).playerId, next.playerId, "An existing member recovers even when full");
  assert.equal(await prisma.player.count({ where: { gameId: next.gameId } }), 32);
});
