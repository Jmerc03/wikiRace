# Game contract v1.0

Owner: WikiRace Systems Architecture. Accepted for implementation by Codex under WR-DEC-002, 2026-09-07. Claim state: planned until linked package evidence passes.

## State and authority

The API/database owns game state. Games progress WAITING -> ACTIVE -> FINISHED. The creator is host. Players choose teams in WAITING. Host start/end and player leave are explicit operations. Host departure transfers control to the earliest remaining active player; the last departure ends the game. Departed player records and claims remain historical. Finished games are immutable except membership departure; no new joins or scoring.

## Identity and validation

Create/join returns a random opaque player token once, stored locally by the extension. Mutating player operations require `Authorization: Bearer <token>` matching the player and game. Stored hashes never enter public responses. Unknown/foreign/left players cannot mutate. Read-only spectator data contains public roster and progress, never credentials. Invalid inputs return 400; absent resources 404; failed credentials 401/403; lifecycle conflicts 409.

## Rules

Boards are exactly 5x5, with 25 distinct objectives and contiguous positions. Normal completions are private to each player's progress; its persisted winner is the first serialized bingo. Lockout first claims belong to a fixed player/team, with 13 required to win. Team membership freezes when the match starts. All players and spectators agree on the persisted final winner. One navigation may satisfy multiple objectives. Only English Wikipedia article URLs qualify; namespace and special pages are rejected/ignored. Client-supplied page contents are trust-based, not anti-cheat proof.

## Consistency and realtime

Each mutation locks the game row and commits event, completions/claims, and game status atomically. A failed transaction leaves no partial event/claim. Broadcasts occur after commit. Realtime messages invalidate state; each player refetches their own view so another player's Normal progress is never copied. Reconnect always refetches. Heartbeats keep idle connections detectable. Temporary service failure preserves local identity and last known state, with visible connection status.

## Recovery and configuration

Extension restart restores the game/player/token and configured API origin. Async responses are applied only to the session that requested them. Deliberate leave clears only session data, not backend preferences. Backend URLs are explicit HTTP(S) origins with permissions requested for remote hosts; WebSocket URLs derive from them. The default local service is `http://localhost:4000`.

## Spectators and operation

Spectator routes are read-only and never create players. Normal mode displays per-player scores and selectable progress; Lockout displays ownership. A stream view hides controls and uses a transparent background for an OBS browser source. The same API process serves the pages. Public internet deployment and multi-process realtime are outside the initial qualification.
