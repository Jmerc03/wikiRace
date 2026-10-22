# Game contract v1.9

Owner: WikiRace Systems Architecture. Initial acceptance WR-DEC-002; v1.1 refinement WR-DEC-009, 2026-09-07. v1.2 admission contract accepted by WR-DEC-016/017. Original rules implemented and verified through WR-EWP-005; see package closeouts for exact evidence and limits.

## State and authority

The API/database owns game state. Games progress WAITING -> ACTIVE -> FINISHED. The creator is host. Players choose teams in WAITING. Host start/end and player leave are explicit operations. Host departure transfers control to the earliest remaining active player; the last departure ends the game. Departed player records and claims remain historical. Finished scoring and outcomes are immutable; membership departure and linking a new rematch remain allowed. Finished games accept no new joins or scoring.

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

`POST /games` and `POST /games/:gameId/players` accept optional `Idempotency-Key`: 43 base64url characters representing the client's cryptographically random 32-byte private token. This is a credential, not a shareable game ID. The API stores only its SHA-256 hash and a SHA-256 fingerprint of the normalized operation, game ID and validated request body. No replay key/token/hash appears in public state or server WebSocket broadcasts. The private presence authentication frame introduced in v1.8 is described below.

A database transaction takes a key advisory lock before a game row lock. Identical retries return the same player/token/board and current authoritative state, even if the match finished since admission; they do not increment revision or broadcast. Changing the normalized request or target returns 409. A departed membership returns 409 and cannot be reenrolled by replay. New distinct admissions retain the 32-player limit and normal lobby revision/broadcast behavior. Unkeyed older clients remain accepted, with their original one-shot response behavior.

The extension persists the key, exact request and origin before contact. A transport/timeout/unreadable/5xx failure retains that pending intent. Retry uses the same request after browser/worker restart; conflicting entry/server changes are blocked. Definitive 400/401/403/404/409 rejection clears the pending intent. Explicitly forgetting it may abandon a committed membership and is confirmed in the UI. Success saves the complete identity and clears pending intent together. `/ready` advertises `recoverable-admission-v1`; a server lacking that capability receives no admission POST from the current extension.

Apply the nullable `20260908011800_recoverable_admission` migration with `npm run prisma:migrate:deploy` and the selected `DATABASE_URL`, then restart the API and reload the extension. Existing records and session hashes remain unchanged.

## Invitation and connection selection (WR-EWP-008)

Shared invitation parsing accepts a game UUID or `http(s)://host[:port]/join/<gameId>`. Spectator links may carry one valid public `playerId` selection; joining ignores that selection. Credentials, fragments, unrelated paths and query data are rejected. Generated invitations contain only origin and game ID. Pasting has no side effects; an explicit Join action requests origin permission, then the background owner checks permission again and selects the origin only with no existing/pending session. Web invitation/spectator reads never enroll.

The managed API defaults to loopback. An explicit persisted `WIKIRACE_API_HOST=0.0.0.0` selects trusted-network binding while PostgreSQL remains loopback-only. Changing this setting requires stopping the owned API. Private-interface candidate addresses are observations, not remote reachability claims.

## Results, scoring evidence and rematches (WR-EWP-010)

The user selected this feature continuation on 2026-10-22. Results present the stored outcome and elapsed `finishedAt - startedAt` time. Normal standings place the stored bingo winner first, then sort other players by completed-square count. Lockout aggregates claims by their fixed team/player owner, including departed members. Equal non-winning scores share a place; ranking never invents a winner for a draw or host-ended match. Missing historical timing stays unavailable.

`squareEvidence` contains at most one earning article per displayed completed square: square ID, player ID/name, title, validated English-Wikipedia URL (null for an unsafe historical URL), and earning timestamp. Normal evidence belongs only to the authenticated/explicitly followed player; a public unselected game read has none. Lockout exposes the first claimant's evidence. Multiple squares can reference one article. Unmatched navigation, raw categories/links, internal event IDs and credential hashes are not returned. This is evidence from the existing trusted-client model, not independent article verification.

`POST /games/:gameId/rematch` with the original `{ playerId }` and bearer token enters the source match's next lobby. The source must be finished and the original membership must not have left. Only its current host may create that next lobby; every remaining member can subsequently opt in while it is waiting. A unique nullable `Game.rematchOfGameId` enforces one successor. New boards use the same configuration with fresh square identities and no progress. Teams are copied with names/colors, and each explicitly returning player carries their name/color and original team. Player/team provenance is internal and nullable for historical rows. New players may still use normal invitations; normal active-match solo admission remains unchanged.

The transaction locks the source game before the destination, serializing creation, opt-in, capacity checks and host actions. A unique destination-game/source-player pair prevents duplicate memberships. A new per-round 256-bit token is derived by HMAC-SHA256 using the authenticated original token and a versioned destination-game/source-player context. Only its hash is stored. Replaying with the original credentials returns the same identity and current state, including after the next match starts/finishes, without revision increments. A departed destination membership cannot be reenrolled by replay. Tokens never appear in public state or websocket notifications.

The extension stores a pending-rematch marker with the original session before contacting the API. Failure preserves that session across worker/browser restart; Retry Rematch resolves the same membership. Conflicting mutations are blocked until recovery or the explicit Stay in Previous Match action, which does not undo a committed server admission. Success atomically stores the new credentials and clears the marker before switching websocket rooms. Popup mutations include their expected game ID; the queue rejects old-round actions after a session switch. `/ready` advertises `rematch-v1`; incompatible servers receive no rematch POST.

State exposes public `previousGameId`, `rematchGameId`, and `rematchStatus` links. Source-room invalidation announces a newly created successor. Destination changes invalidate its room, and status changes also invalidate the predecessor so waiting players see whether opt-in is still possible. Finished boards, visits, scores, timing and winners are preserved; only the predecessor's revision/link metadata changes when a successor is created. Spectators can follow round links without enrollment; players can open Previous Results.

Apply the additive `20261022154000_match_rematches` migration with the selected `DATABASE_URL` and `npm run prisma:migrate:deploy`; regenerate Prisma with `npm run prisma:generate`, rebuild, restart the API, and reload extension 1.4.0. Existing rows and credential hashes remain unchanged.

## Lobby readiness (WR-EWP-011)

The user selected lobby ready checks on 2026-10-22. Public player summaries expose
`isReady`, backed by `Player.isReady` (non-null boolean, default false). Authenticated
`POST /games/:gameId/ready` accepts `{ playerId, isReady: boolean }` and returns the
current player state. Missing/non-boolean values return 400; invalid, foreign or
departed memberships return 401. This is a desired-state setter, never a toggle.
Only WAITING permits changes; ACTIVE/FINISHED return 409. Exact repeats in WAITING
return current state without revision increments or broadcasts.

Host Start Match checks all active (`leftAt: null`) members, including the host,
inside the same game-row lock as readiness, joins, departures and team changes.
Any unready member returns 409 without changing status, time or revision. Already
ACTIVE host start retries remain idempotent even after a late solo join. The
existing late-join policy and Normal/Lockout scoring rules are unchanged.

A new member or rematch member defaults false. Actual team join/change/leave
clears only that player's readiness; a same-team join is a no-op. Team creation
alone does not clear readiness. Departed players are excluded from the gate;
host transfer keeps surviving players' choices. Rematch recovery retains the
new-round value instead of overwriting it from the source. Readiness is persisted
intent, not connection presence. No force-start or automatic timeout is provided.

Every effective change increments revision and invalidates the room after commit.
The extension shows a personal control, live count and roster labels, and disables
Start until everyone is ready; the API remains authoritative for stale/concurrent
clients. Spectators display read-only readiness. Refresh/restart recovers a
committed change after response loss; replaying its desired state is idempotent.
Existing expected-game-ID checks also protect readiness actions across rematches.

Deploy `20261022162000_lobby_ready_checks` with `npm run prisma:migrate:deploy`,
then `npm run prisma:generate` and `npm run build` using the selected `DATABASE_URL`.
Restart the API and reload extension 1.5.0. `/ready` requires the new column and
advertises `lobby-ready-v1`. Existing waiting players become Not Ready; old active
and finished rounds, their sessions and results remain intact. Older extensions
must be reloaded/upgraded to ready in waiting lobbies on the new server.

## Host access controls (WR-EWP-012)

The user selected host removal and joining locks on 2026-10-22. Public state adds
`isJoinLocked`, `rematchJoinLocked`, and player `removedByHost`. Database booleans
Game.isJoinLocked and Player.removedByHost default false. Older rounds remain open
and historical departures are not relabeled as removals.

Authenticated `POST /games/:gameId/join-lock` accepts `{ playerId, isJoinLocked:
boolean }`. Only the current host may set it in WAITING or ACTIVE. Invalid values
return 400, non-hosts 403, and FINISHED 409. Same-value retries do not increment
revision or broadcast. New normal admissions reject a locked game with 409 before
creating a row or binding an entry key. Existing exact keyed admission recovery
runs first and remains allowed. Rematch opt-in checks the destination lock after
checking for an existing recoverable membership. New games/rematches default open;
start and host transfer preserve the current lock.

Authenticated `POST /games/:gameId/players/:targetPlayerId/remove` accepts the
host's `{ playerId }`. Only the current host may remove a different member in
WAITING. Self, missing/foreign targets and non-WAITING games return 409; non-hosts
return 403. A live target is atomically marked `leftAt`, `removedByHost: true`,
`isReady: false`; all historical records and team attribution remain. A repeat
against a departed target in WAITING is a no-op. Removal is not an account/IP ban;
new credentials can join an open game. Self-departure retains the normal leave and
host-transfer flow. No host removal during play is supported.

Authorization checks the token before returning the specific removed-membership
401 explanation. Removed members cannot mutate or fetch private state. Their
original keyed admission and prior-round rematch recovery reject with 409 instead
of reenrolling. Idempotent leave may clear their local extension session without
changing removal metadata. Public spectator reads remain available.

All operations share the game-row lock with start, ready, join, team and leave.
Each effective change increments revision and invalidates clients after commit.
A next-round lock change also invalidates its predecessor; previous-round clients
show a recovery option and lock explanation without blocking already-admitted
recovery. These link metadata updates do not change historical scores/results.

Extension host controls use desired-state messages and existing expected-game-ID
checks. Removal has a named confirmation. Invalid sessions close their WebSocket;
late state responses cannot restore revoked state. Explicit forgetting/new entry
retains the existing session-generation protection. Spectators and invitation
pages expose access state without enrolling; an invitation alone grants no access.

Apply `20261022163500_host_lobby_controls` using the selected DATABASE_URL with
`npm run prisma:migrate:deploy`; run `npm run prisma:generate`, `npm run build`,
restart the API and reload extension 1.6.0. `/ready` requires both columns and
advertises `host-lobby-v1`. No credential, score or team rule is replaced.

## Custom board setup (WR-EWP-013)

`GET /games/board-options` is a public read-only capability endpoint. It returns
`articleCapacities` for EASY/MIXED/HARD: 25 integer entries, indexed by per-topic
cap minus one, each capped at 25. Capacity is computed from the same distinct,
difficulty-eligible article catalog used for generation. It creates no membership
and returns no credentials. The current catalog supports 11 named articles at
cap 1, 22 at cap 2, and all 25 at cap 3 or above for each difficulty.

The existing create payload accepts 0–25 named articles and the complementary
number of flexible objectives, totaling exactly 25. Per-topic cap remains 1–25
at the API; the extension offers 1, 2, 3, 5 and 25. Defaults remain Mixed, 15
named, 10 flexible, cap 3. Invalid or impossible configurations return 400 before
persisting any game/player/board or consuming the admission key. No partial board
or silent adjustment is allowed. Difficulty filters named articles (Easy levels
1–3, Hard levels 3–4, Mixed all); flexible templates retain their existing mix.
Topic limits apply only to named articles, and both controls have no effect when
all 25 objectives are flexible.

The extension fetches options for its selected server and rejects late options
from a previous server. Loading/invalid/unavailable options disable creation,
with explicit retry, while joining an existing lobby remains available. Exact
pending create requests and their visible settings survive restart; retry never
substitutes the current draft. Board configuration is fixed when created, public
in lobby/spectator/invitation summaries, and copied into each fresh rematch.
Legacy null configurations are labeled unavailable rather than invented.

No schema change or additional migration is required from 1.6.0. `/ready`
advertises `custom-board-v1`; build/restart the server and reload extension 1.7.0.

## Optional timed rounds (WR-EWP-014)

Create optionally accepts `timeLimitSeconds`: null or an integer from 60 through
7,200. Omission means untimed and stays omitted in the normalized admission
fingerprint, preserving pre-upgrade pending-create recovery. The extension offers
untimed or 1/5/10/15/30/60 minutes and requires `timed-rounds-v1` capability before
sending a timed create. The fixed duration and nullable `expiresAt` are public
state. A fresh/rematch lobby has no deadline; the first successful start stores
startedAt and startedAt + duration together. Retries and host transfer never
extend it. Rematches copy the duration but receive a fresh clock only on start.

Each mutation checks expiry after obtaining its game-row lock. Eligibility is
linearized there: an authenticated operation admitted before the deadline can
complete atomically. At/after the deadline, expiry commits independently before
retrying the requested operation against FINISHED state, preventing later
validation errors from rolling back the time transition. Late visits return
finished state without new events or scores; new admissions are rejected while
exact committed-entry recovery remains available. Existing winner/finished
states are never overwritten by expiry.

A server-owned one-second sweep also finishes idle rounds, up to 100 per batch,
using row locks and SKIP LOCKED. It catches overdue rounds on startup, retries
transient database failures and shuts down with the app. Both paths record
TIME_LIMIT, finishedAt equal to the deadline, and one revision increment; they
broadcast only after commit, including any previous-round room. The stored UTC
DateTime comparison explicitly converts bound timestamptz values to UTC so a
non-UTC database session cannot move the deadline. Readers/spectators remain
read-only and can briefly observe ACTIVE while expiry is being confirmed.

Expiry does not award the highest score a win: Normal still needs bingo and
Lockout still needs 13 squares. Final scores remain available with “Time’s up —
no winner.” A normal win, host end or empty-room end committed earlier keeps its
outcome. Client timestamps never establish eligibility.

`X-WikiRace-Time` supplies server epoch milliseconds, exposed through CORS.
Clients combine it with monotonic elapsed time to estimate the countdown without
trusting the local wall clock. The deadline and server state decide the result;
network latency is not a precision-clock guarantee. At zero, clients request
confirmation; offline clients label the result unconfirmed and retain identity.
Readiness and waiting time do not consume the clock.

Apply `20261022171500_timed_rounds` with the selected DATABASE_URL and
`npm run prisma:migrate:deploy`, then `npm run prisma:generate`,
`npm run prisma:validate`, `npm run build`, and restart the API. Existing rows
remain untimed; original columns and credential hashes are preserved. Reload
extension 1.8.0 to show countdowns. No pause, overtime or active-clock editing.

## v1.8 player connection indicators

Presence is ephemeral observation owned by the existing single API process. It
never changes persisted game rows, revisions, readiness, scoring, start gates,
host ownership or outcomes. No schema migration. `/ready` and the socket's initial
`CONNECTED` frame advertise `player-presence-v1`. Current clients wait for the
socket capability before sending the private one-time
`AUTHENTICATE_PRESENCE {playerId, playerToken}` frame. Tokens stay out of URLs,
access logs, popup state and server broadcasts. The server validates token and
active membership while holding the game's row lock; one attempt per socket.
Invalid authentication closes with 1008 without echoing credentials. Removal and
leave revoke all bound sockets immediately after their database commit.

Public spectators send `WATCH_PRESENCE`; they never establish player presence.
Authenticated members also subscribe. Opted-in sockets receive full
`PRESENCE_UPDATED {gameId, players:[{playerId,status}]}` snapshots with status
`online` or `reconnecting`; absent players are offline. Unknown fields are stripped
and mismatched game IDs rejected by clients. Legacy sockets still receive their
original state invalidations and heartbeat without unsolicited presence frames.
Presence snapshots refresh on changes and the twenty-second server heartbeat.

One or more authenticated sockets mean Online. Closing the last socket starts a
ten-second Reconnecting grace; reconnect cancels it. Closing one of several
sockets does not change presence. Removal/leave bypass grace. A failed native pong
is detected by the existing twenty-second heartbeat within two intervals, then
grace runs. Client application-message watchdogs clear stale observation after
45 seconds (checked every five seconds in the extension and 250 ms in the viewer),
then reconnect. These are awake-runtime bounds, not OS-sleep guarantees.

When the observation channel is unavailable, clients show Connection unknown,
not a stale Online or an assertion that everyone went offline. Old servers without
presence support remain playable with unknown status. Old extensions that do not
authenticate presence may appear offline to new clients; reload 1.9.0 on all
players. Online means connected, not attention, browsing activity or Ready.
Membership labels Left/Removed override presence, and team scorecards aggregate
current members. Spectators never add to connected player counts. No historical
last-seen data, automatic kicks, readiness resets or host transfer on disconnect.

API restart clears the ephemeral tracker and clients authenticate their saved
memberships again. New rematch membership uses its own game/player credentials;
old-round snapshots cannot replace current presence. Multi-process presence would
require shared infrastructure and remains outside this local service contract.

## v1.9 hosted beta profile

The beta evaluates the same authenticated article payload and game rules, but
persists a PageVisit only when it earns at least one new completion/claim. It
retains title, URL, player and timestamp; categories/links are stored as empty
arrays. An unscored or repeated visit returns unchanged state and no completed
tile IDs without incrementing revision. Local profile behavior is unchanged.

New games/rematches share a database-serialized cap of 200 saved games. New
memberships share the game-row lock and a 64-lifetime-member cap in addition to
the existing 32-active-member cap. Exact admission recovery precedes these caps.
Request limits can still return 429 before recovery; clients retry the same
pending intent. Quota rejection never creates partial memberships or boards.

Only FINISHED games older than 30 days are eligible for hourly deletion. Cascades
remove their data, and a newer rematch survives with a null predecessor link.
WAITING/ACTIVE games remain until ended. The beta must use a new separate DB.
These storage limits qualify earlier historical-results preservation statements
for the hosted beta; rematch creation itself never clears previous results.

HTTP/socket limits and the exact hosted-only extension permissions are documented
in BETA_LAUNCH.md. CORS is not an authentication boundary. Public spectator data
is available to anyone with the game ID. `/deployment`, `/privacy` and package
checksums expose only public deployment information and never private credentials.
