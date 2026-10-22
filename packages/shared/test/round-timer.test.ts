import { test } from "node:test";
import assert from "node:assert/strict";
import { createServerClock, roundRemaining, roundTimerText, roundLimitLabel } from "../src/round-timer.js";
import { matchOutcome } from "../src/results.js";
test("countdown uses monotonic elapsed time, ignores repeated/stale samples and corrects a skewed initial wall clock", () => {
  let monotonic = 100;
  const clock = createServerClock(() => monotonic); clock.sync(10000);
  monotonic = 1350; assert.equal(clock.now(), 11250);
  clock.sync(10000); clock.sync(9000); clock.sync(NaN); clock.sync(undefined); assert.equal(clock.now(), 11250);
  clock.sync(12000); monotonic += 500; assert.equal(clock.now(), 12500);
});
test("timed states distinguish waiting, countdown, unconfirmed zero and server-confirmed results", () => {
  const state = { status: "ACTIVE" as const, timeLimitSeconds: 60, expiresAt: "2026-10-22T18:00:00Z" };
  const deadline = Date.parse(state.expiresAt);
  assert.equal(roundRemaining(state, deadline - 1), 1); assert.equal(roundTimerText(state, deadline - 1), "Time left · 0:01");
  assert.equal(roundTimerText(state, deadline - 60000), "Time left · 1:00");
  assert.equal(roundRemaining(state, deadline), 0); assert.match(roundTimerText(state, deadline + 10000), /Confirming results/);
  assert.match(roundTimerText({ ...state, status: "FINISHED", endReason: "TIME_LIMIT" }, deadline), /Round finished/);
  assert.match(roundTimerText({ ...state, status: "WAITING", expiresAt: null }, deadline), /Starts with the match/);
  assert.equal(roundRemaining({ ...state, expiresAt: "invalid" }, deadline), null);
  assert.equal(roundLimitLabel(null), "Untimed round"); assert.equal(roundLimitLabel(90), "90-second round");
});
test("time limit results never declare the score leader a winner", () => {
  assert.equal(matchOutcome({ mode: "NORMAL", winningOwner: null, endReason: "TIME_LIMIT" }), "Time’s up — no winner");
  assert.equal(matchOutcome({ mode: "LOCKOUT", winningOwner: null, endReason: "TIME_LIMIT" }), "Time’s up — no winner");
});
