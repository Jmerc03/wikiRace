import { test } from "node:test";
import assert from "node:assert/strict";
import { matchStandings, matchDuration, formatDuration, matchOutcome } from "../src/results.js";
import type { GameStateResponse, SquareClaim } from "../src/api.js";

const players = [
  { id: "a", displayName: "Bingo", color: null, teamId: null, score: 5 },
  { id: "b", displayName: "More squares", color: null, teamId: null, score: 12 },
  { id: "c", displayName: "Same score", color: null, teamId: null, score: 12 },
].map(player => ({ ...player, isReady: false, removedByHost: false }));
const winner = { ownerKey: "player:a", type: "PLAYER" as const, id: "a", name: "Bingo", color: null };
test("Normal standings honor the stored bingo winner ahead of higher scores and retain ties", () => {
  const result = matchStandings({ mode: "NORMAL", players, teams: [], squareClaims: [], winningOwner: winner });
  assert.deepEqual(result.map(p => [p.id, p.rank, p.isWinner]), [["a", 1, true], ["b", 2, false], ["c", 2, false]]);
  assert.equal(matchOutcome({ mode: "NORMAL", winningOwner: winner, endReason: "BINGO" }), "Bingo won by bingo");
});
test("Lockout aggregates team claims including departed members and excludes empty unused teams", () => {
  const result = matchStandings({ mode: "LOCKOUT", players: [{ ...players[0], teamId: "t", leftAt: "2026-10-22" }, players[1]],
    teams: [{ id: "t", name: "Team", color: "green", players: [] }, { id: "empty", name: "Empty", color: "red", players: [] }],
    squareClaims: [{ playerId: "a", teamId: "t" }, { playerId: "a", teamId: "t" }, { playerId: "b", teamId: null }] as SquareClaim[], winningOwner: null });
  assert.deepEqual(result.map(p => [p.id, p.score, p.isWinner]), [["t", 2, false], ["b", 1, false]]);
});
test("duration is elapsed play time and rejects absent, reversed and invalid timestamps", () => {
  assert.equal(formatDuration(matchDuration({ startedAt: "2026-10-22T15:00:00Z", finishedAt: "2026-10-22T16:02:03Z" })), "1h 2m 03s");
  for (const state of [{ startedAt: null, finishedAt: null }, { startedAt: "bad", finishedAt: "2026-10-22" }, { startedAt: "2026-10-23", finishedAt: "2026-10-22" }]) assert.equal(matchDuration(state), null);
  assert.equal(formatDuration(null), "Unavailable");
  assert.equal(formatDuration(900), "0m 00s");
});
test("draw, abandoned and historical outcomes do not invent a winner", () => {
  const state = { mode: "LOCKOUT", winningOwner: null } as GameStateResponse;
  assert.match(matchOutcome({ ...state, endReason: "BOARD_EXHAUSTED" }), /^Draw/);
  assert.match(matchOutcome({ ...state, endReason: "EMPTY" }), /everyone left/);
  assert.match(matchOutcome({ ...state, endReason: "LEGACY_UNKNOWN" }), /unavailable/);
  assert.match(matchOutcome({ ...state, endReason: "HOST_ENDED" }), /without a winner/);
});
