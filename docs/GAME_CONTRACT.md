# Game contract v1.2

Owner: WikiRace Systems Architecture. Initial acceptance WR-DEC-002; v1.1 refinement WR-DEC-009, 2026-09-07. v1.2 admission contract accepted by WR-DEC-016/017. Original rules implemented and verified through WR-EWP-005; see package closeouts for exact evidence and limits.

## State and authority

The API/database owns game state. Games progress WAITING -> ACTIVE -> FINISHED. The creator is host. Players choose teams in WAITING. Host start/end and player leave are explicit operations. Host departure transfers control to the earliest remaining active player; the last departure ends the game. Departed player records and claims remain historical. Finished games are immutable except membership departure; no new joins or scoring.

## Identity and validation

Create/join returns an opaque player token, stored privately by the extension. Older unkeyed clients receive a server-generated token once. Current clients supply a private random admission key and can recover that same token and membership on exact retries. Mutating player operations require `Authorization: Bearer <token>` matching the player and game. Stored hashes never enter public responses. Unknown/foreign/left players cannot mutate. Read-only spectator data contains public roster and progress, never credentials. Invalid inputs return 400; absent resources 404; failed credentials 401/403; lifecycle conflicts 409.

## Rules

Boards are exactly 5x5, with 25 distinct objectives and contiguous positions. Normal completions are tracked independently for each player; its persisted winner is the first serialized bingo. Lockout first claims belong to a fixed player/team, with 13 required to win. Team membership freezes when the match starts. All players and spectators agree on the persisted final winner. One navigation may satisfy multiple objectives. Only English Wikipedia article URLs qualify; namespace and special pages are rejected/ignored. Client-supplied page contents are trust-based, not anti-cheat proof.

## Consistency and realtime

Each mutation locks the game row and commits event, completions/claims, and game status atomically. A failed transaction leaves no partial event/claim. Broadcasts occur after commit. Realtime messages invalidate state; each player refetches their own view so another player's Normal progress is never copied. Reconnect always refetches. Heartbeats keep idle connections detectable. Temporary service failure preserves local identity and last known state, with visible connection status.

## Recovery and configuration

Extension restart restores the game/player/token and configured API origin. Async responses are applied only to the session that requested them. Deliberate leave clears only session data, not backend preferences. Backend URLs are explicit HTTP(S) origins with permissions requested for remote hosts; WebSocket URLs derive from them. The default local service is `http://localhost:4000`.

## Spectators and operation

Spectator routes are read-only and never create players. Normal mode displays per-player scores and selectable progress; Lockout displays ownership. A stream view hides controls and uses a transparent background for an OBS browser source. The same API process serves the pages. Public internet deployment and multi-process realtime are outside the initial qualification.

## v1.1 edge-case refinement (WR-DEC-009)

A Lockout board with all 25 squares claimed and no majority finishes with `endReason: BOARD_EXHAUSTED`, `winner: false`, and no winning owner or line. Later visits cannot mutate it. This is a draw, not a plurality win. Normal bingo and the 13-square Lockout threshold are unchanged. Legacy finished games without stored outcomes use `LEGACY_UNKNOWN` and do not invent a host-end decision.

## v1.2 recoverable admission (WR-EWP-007)

`POST /games` and `POST /games/:gameId/players` accept optional `Idempotency-Key`: 43 base64url characters representing the client's cryptographically random 32-byte private token. This is a credential, not a shareable game ID. The API stores only its SHA-256 hash and a SHA-256 fingerprint of the normalized operation, game ID and validated request body. No replay key/token/hash appears in public state or WebSocket messages.

A database transaction takes a key advisory lock before a game row lock. Identical retries return the same player/token/board and current authoritative state, even if the match finished since admission; they do not increment revision or broadcast. Changing the normalized request or target returns 409. A departed membership returns 409 and cannot be reenrolled by replay. New distinct admissions retain the 32-player limit and normal lobby revision/broadcast behavior. Unkeyed older clients remain accepted, with their original one-shot response behavior.

The extension persists the key, exact request and origin before contact. A transport/timeout/unreadable/5xx failure retains that pending intent. Retry uses the same request after browser/worker restart; conflicting entry/server changes are blocked. Definitive 400/401/403/404/409 rejection clears the pending intent. Explicitly forgetting it may abandon a committed membership and is confirmed in the UI. Success saves the complete identity and clears pending intent together. `/ready` advertises `recoverable-admission-v1`; a server lacking that capability receives no admission POST from the current extension.

Apply the nullable `20260908011800_recoverable_admission` migration with `npm run prisma:migrate:deploy` and the selected `DATABASE_URL`, then restart the API and reload the extension. Existing records and session hashes remain unchanged.
