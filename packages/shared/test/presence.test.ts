import { test } from "node:test";
import assert from "node:assert/strict";
import { readPresence, playerPresence } from "../src/presence.js";

test("presence snapshots reject foreign/malformed data and copy only public fields", () => {
  const value = { type: "PRESENCE_UPDATED", gameId: "game", players: [{ playerId: "one", status: "online", playerToken: "secret" }], secret: "hidden" };
  const snapshot = readPresence(value, "game");
  assert.deepEqual(snapshot, { type: "PRESENCE_UPDATED", gameId: "game", players: [{ playerId: "one", status: "online" }] });
  assert.equal(readPresence(value, "old-game"), null);
  for (const players of [null, [null], [{ playerId: "one", status: "offline" }], [...value.players, ...value.players], Array(257).fill(value.players[0])]) assert.equal(readPresence({ ...value, players }, "game"), null);
});
test("presence distinguishes absent observation, observed offline, reconnecting and revoked membership", () => {
  const player = { id: "one", leftAt: null, removedByHost: false };
  assert.equal(playerPresence(player, null).label, "Connection unknown");
  const snapshot = readPresence({ type: "PRESENCE_UPDATED", gameId: "game", players: [] }, "game")!;
  assert.equal(playerPresence(player, snapshot).label, "Offline");
  snapshot.players.push({ playerId: player.id, status: "reconnecting" });
  assert.equal(playerPresence(player, snapshot).label, "Reconnecting");
  snapshot.players[0].status = "online";
  assert.equal(playerPresence(player, snapshot).label, "Online");
  assert.equal(playerPresence({ ...player, leftAt: "now" }, snapshot).label, "Left");
  assert.equal(playerPresence({ ...player, leftAt: "now", removedByHost: true }, snapshot).label, "Removed");
});
