import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const app = buildApp({ presenceGraceMs: 120 });
let origin: string;
type Session = { gameId: string; playerId: string; playerToken: string; [key: string]: any };
type Client = { socket: WebSocket; messages: any[] };
before(async () => { origin = await app.listen({ port: 0, host: "127.0.0.1" }); });
after(async () => { await app.close(); await prisma.$disconnect(); });
async function create(mode = "NORMAL"): Promise<Session> { return (await app.inject({ method: "POST", url: "/games", payload: { mode } })).json(); }
async function join(p: Session): Promise<Session> { return (await app.inject({ method: "POST", url: `/games/${p.gameId}/players`, payload: {} })).json(); }
async function post(p: Session, path: string, payload = {}) {
  const response = await app.inject({ method: "POST", url: `/games/${p.gameId}${path}`, headers: { authorization: `Bearer ${p.playerToken}` }, payload: { playerId: p.playerId, ...payload } });
  assert.equal(response.statusCode, 200, response.body); return response.json();
}
async function connect(gameId: string, autoPong = true): Promise<Client> {
  const socket = new WebSocket(`${origin.replace("http", "ws")}/ws/${gameId}`, { autoPong });
  const messages: any[] = []; socket.on("message", data => messages.push(JSON.parse(String(data))));
  await once(socket, "open"); return { socket, messages };
}
async function until(check: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await delay(10);
  assert.ok(check(), "Expected socket observation did not arrive");
}
const latest = (client: Client) => client.messages.findLast(m => m.type === "PRESENCE_UPDATED");
const status = (client: Client, p: Session) => latest(client)?.players.find((row: any) => row.playerId === p.playerId)?.status ?? "offline";
async function watch(client: Client) { client.socket.send(JSON.stringify({ type: "WATCH_PRESENCE" })); await until(() => Boolean(latest(client))); }
function authenticate(client: Client, p: Session) { client.socket.send(JSON.stringify({ type: "AUTHENTICATE_PRESENCE", playerId: p.playerId, playerToken: p.playerToken })); }
async function close(client: Client) { if (client.socket.readyState === WebSocket.CLOSED) return; const done = once(client.socket, "close"); client.socket.close(); await done; }
async function rows(p: Session) {
  return { game: await prisma.game.findUnique({ where: { id: p.gameId } }), players: await prisma.player.findMany({ where: { gameId: p.gameId }, orderBy: { id: "asc" } }) };
}

test("only authenticated members establish presence; observers and IDs cannot impersonate players", async () => {
  const host = await create(); const guest = await join(host); const foreign = await create(); const before = await rows(host);
  const viewer = await connect(host.gameId); await watch(viewer);
  try {
    assert.deepEqual(latest(viewer).players, []);
    for (const wrong of [{ ...host, playerToken: guest.playerToken }, foreign, { ...host, playerToken: "invalid" }]) {
      const client = await connect(host.gameId); const ended = once(client.socket, "close"); authenticate(client, wrong);
      const [code] = await ended; assert.equal(code, 1008); assert.equal(status(viewer, host), "offline");
    }
    const client = await connect(host.gameId);
    try {
      authenticate(client, host); await until(() => status(viewer, host) === "online");
      assert.deepEqual(await rows(host), before);
      const serialized = JSON.stringify(viewer.messages);
      for (const secret of [host.playerToken, guest.playerToken, "sessionTokenHash", "playerToken"]) assert.ok(!serialized.includes(secret));
      assert.ok(viewer.messages.every(m => m.type !== "GAME_STATE_UPDATED"));
    } finally { await close(client); }
  } finally { await close(viewer); }
});

test("duplicate sockets count once; reconnect cancels grace and final disconnection becomes offline", async () => {
  const host = await create(); const viewer = await connect(host.gameId); await watch(viewer);
  const one = await connect(host.gameId); const two = await connect(host.gameId); let three: Client | undefined;
  try {
    authenticate(one, host); authenticate(two, host); await until(() => status(two, host) === "online");
    assert.equal(latest(viewer).players.length, 1);
    await close(one); await delay(160); assert.equal(status(viewer, host), "online");
    await close(two); await until(() => status(viewer, host) === "reconnecting");
    three = await connect(host.gameId); authenticate(three, host); await until(() => status(viewer, host) === "online");
    await delay(160); assert.equal(status(viewer, host), "online");
    await close(three); await until(() => status(viewer, host) === "reconnecting");
    await until(() => status(viewer, host) === "offline");
    assert.equal((await rows(host)).game?.revision, 0);
  } finally { await close(one); await close(two); if (three) await close(three); await close(viewer); }
});

test("presence never gates ready/start, changes teams or advances either mode's revision", async () => {
  for (const mode of ["NORMAL", "LOCKOUT"]) {
    const host = await create(mode); const guest = await join(host);
    await post(host, "/ready", { isReady: true }); await post(guest, "/ready", { isReady: true });
    const before = await rows(host); const client = await connect(host.gameId); authenticate(client, guest);
    await until(() => status(client, guest) === "online"); await close(client); await delay(160);
    assert.deepEqual(await rows(host), before);
    const active = await post(host, "/start"); assert.equal(active.status, "ACTIVE");
    assert.ok(active.players.every((p: any) => p.isReady)); assert.equal(active.revision, before.game!.revision + 1);
  }
});

test("committed removal/leave immediately revoke every socket and prevent old-credential reauthentication", async () => {
  for (const action of ["remove", "leave"]) {
    const host = await create(); const guest = await join(host); const observer = await connect(host.gameId); await watch(observer);
    const one = await connect(host.gameId); const two = await connect(host.gameId);
    try {
      authenticate(one, guest); authenticate(two, guest); await until(() => status(two, guest) === "online");
      const closes = [once(one.socket, "close"), once(two.socket, "close")];
      if (action === "remove") await post(host, `/players/${guest.playerId}/remove`);
      else await post(guest, `/players/${guest.playerId}/leave`);
      await Promise.all(closes); await until(() => status(observer, guest) === "offline");
      const retry = await connect(host.gameId); const rejected = once(retry.socket, "close"); authenticate(retry, guest); assert.equal((await rejected)[0], 1008);
      assert.equal((await rows(host)).players.find(p => p.id === guest.playerId)?.leftAt instanceof Date, true);
    } finally { await close(one); await close(two); await close(observer); }
  }
});

test("authentication racing with removal cannot restore revoked presence", async () => {
  for (let attempt = 0; attempt < 12; attempt++) {
    const host = await create(); const guest = await join(host); const observer = await connect(host.gameId); await watch(observer);
    const client = await connect(host.gameId); const closed = once(client.socket, "close");
    try {
      authenticate(client, guest); await post(host, `/players/${guest.playerId}/remove`); await closed;
      await until(() => status(observer, guest) === "offline");
      assert.equal((await rows(host)).game?.revision, 2);
    } finally { await close(client); await close(observer); }
  }
});

test("rematch identities and rooms remain isolated from previous-round presence", async () => {
  const host = await create(); await post(host, "/end"); const next = await post(host, "/rematch") as Session;
  const oldClient = await connect(host.gameId); const newClient = await connect(next.gameId);
  try {
    authenticate(oldClient, host); await until(() => status(oldClient, host) === "online"); await watch(newClient);
    assert.equal(latest(newClient).players.length, 0);
    authenticate(newClient, next); await until(() => status(newClient, next) === "online");
    assert.deepEqual(latest(oldClient).players.map((p: any) => p.playerId), [host.playerId]);
    assert.deepEqual(latest(newClient).players.map((p: any) => p.playerId), [next.playerId]);
  } finally { await close(oldClient); await close(newClient); }
});

test("heartbeat terminates a silent authenticated socket without needing HTTP traffic", { timeout: 50000 }, async () => {
  const host = await create(); const observer = await connect(host.gameId); await watch(observer);
  const silent = await connect(host.gameId, false); const started = Date.now();
  try {
    authenticate(silent, host); await until(() => status(observer, host) === "online");
    await until(() => silent.socket.readyState === WebSocket.CLOSED, 45000);
    await until(() => status(observer, host) === "offline");
    assert.ok(Date.now() - started >= 39000, "Exercise the real 20-second heartbeat interval");
    assert.ok(observer.messages.some(m => m.type === "HEARTBEAT"));
    assert.equal((await rows(host)).game?.revision, 0);
  } finally { await close(silent); await close(observer); }
});
