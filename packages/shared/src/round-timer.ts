import type { GameStateResponse } from "./api.js";

type RoundState = Partial<Pick<GameStateResponse, "status" | "timeLimitSeconds" | "expiresAt" | "endReason">>;

/** Advance from server metadata with a monotonic clock, independent of local wall-clock changes. */
export function createServerClock(monotonic = () => performance.now()) {
  let server = Date.now(); let anchor = monotonic(); let sample = -Infinity;
  return {
    sync(value: number | undefined) {
      if (value === undefined || !Number.isFinite(value) || value <= 0 || value <= sample) return;
      server = value; sample = value; anchor = monotonic();
    },
    now: () => server + Math.max(0, monotonic() - anchor),
  };
}

export function roundLimitLabel(seconds: number | null | undefined) {
  if (!seconds) return "Untimed round";
  return seconds % 60 === 0 ? `${seconds / 60}-minute round` : `${seconds}-second round`;
}

export function roundRemaining(state: RoundState, serverNow: number): number | null {
  if (state.status !== "ACTIVE" || !state.timeLimitSeconds || !state.expiresAt) return null;
  const deadline = Date.parse(state.expiresAt);
  return Number.isFinite(deadline) ? Math.max(0, deadline - serverNow) : null;
}

export function roundTimerText(state: RoundState, serverNow: number) {
  const limit = roundLimitLabel(state.timeLimitSeconds);
  if (!state.timeLimitSeconds) return limit;
  if (state.status === "WAITING") return `${limit} · Starts with the match`;
  if (state.status === "FINISHED") return state.endReason === "TIME_LIMIT" ? "Time’s up · Round finished" : `${limit} · Finished`;
  const remaining = roundRemaining(state, serverNow);
  if (remaining === null) return `${limit} · Waiting for timer`;
  if (!remaining) return "Time’s up · Confirming results with server…";
  const seconds = Math.ceil(remaining / 1000);
  return `Time left · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
