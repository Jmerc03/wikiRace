# Architecture

## Overview

WikiRace is a multiplayer Chrome extension game built around Wikipedia navigation and bingo-style objectives.

Players browse Wikipedia pages. The extension detects page visits and sends them to the backend for evaluation.

The backend determines whether a page satisfies a square and updates game state.

Updates are distributed through WebSockets.

---

## Monorepo Structure

### apps/api

Fastify backend.

Responsibilities:

- Game creation
- Player management
- Team management
- Page visit processing
- Claim ownership
- Win detection
- WebSocket broadcasting

Important files:

- src/routes/games.routes.ts
- src/routes/realtime.routes.ts
- src/realtime/game-connections.ts
- prisma/schema.prisma

---

### apps/extension

Chrome extension.

Responsibilities:

- Popup UI
- Background service worker
- Wikipedia page detection
- API communication
- WebSocket synchronization

Important files:

- src/background.ts
- src/popup.ts
- src/popup.html

---

### packages/game-engine

Core game logic.

Responsibilities:

- Board generation
- Tile evaluation
- Completion logic
- Win detection

Important files:

- src/board-generator.ts
- src/game-engine.ts
- src/win-checker.ts

---

### packages/shared

Shared types used across projects.

---

## Data Flow

Wikipedia Page Visit

Content Script
↓
background.ts
↓
POST /games/:id/events/page-visit
↓
games.routes.ts
↓
Prisma Database
↓
WebSocket Broadcast
↓
Connected Clients
↓
Popup UI Refresh

---

## Current Multiplayer Architecture

State authority:

Backend API

Synchronization:

WebSockets

Persistence:

PostgreSQL via Prisma

Connection model:

One WebSocket room per game

---

## Ownership Model

Normal Mode:

Player owns completions.

Lockout Mode:

Player without team:

- Ownership belongs to player.

Player with team:

- Ownership belongs to team.

Ownership is derived from:

SquareClaim.player.teamId

No separate TeamClaim table currently exists.

## JES 0.3.0 ownership and current interface

The existing checkout is one JES Repository and one WikiRace System, with API,
Extension, Game Engine, and Shared Contracts Subsystems. `.jes/repository.json`
and `.jes/OWNERSHIP.md` declare explicit v2 ownership. Plans and bounded package
records live in `project-management`; see `PROJECT_STATE.md` there for current
evidence. JES operational records are accessed through its local API.

The accepted cross-component behavior is in [GAME_CONTRACT.md](GAME_CONTRACT.md).
Game creation grants one opaque player token; only its SHA-256 hash is stored.
Authenticated player state and mutations require the matching bearer token.
Public reads serialize explicit summaries and never database player rows.

Game mutations lock the game row in PostgreSQL and atomically write visits,
completions/claims, status, revision, and the final winner. Post-commit WebSocket
messages invalidate client state. Each player fetches their own Normal progress
through a consistent read transaction. Lockout retains exclusive ownership and
13-square majority wins. Team changes are restricted to the waiting lobby, so
the existing ownership derivation remains stable. Departed players are retained
to preserve claims and winner attribution.

The extension has one typed session/state owner, a serialized mutation queue,
generation/revision checks for late async responses, bounded HTTP requests,
WebSocket reconnect and heartbeat support, and a recovery alarm. One-time player
tokens stay in extension local storage and authenticated requests, not popup
state. The extension and API share response types and article-URL eligibility.
Esbuild bundles script entry points; the build uses portable Node file APIs.

The service still uses one API process for realtime rooms. A multi-process
deployment needs shared pub/sub and is outside the current local qualification.

## Spectator and operator runtime

The API serves a small static operator page, spectator UI, transparent browser
source layout, and packaged extension. Public spectator reads use the same
explicit state serializer in a repeatable-read transaction, select only a player
in that game, and never enroll or score. Viewer JavaScript renders user content
as text and refetches on WebSocket invalidation with bounded polling recovery.

`/health` is process liveness and instance ownership; `/ready` checks database
connectivity and required migrated columns. `scripts/local.mjs` owns a dedicated
local profile, verifies process/database identity before stopping anything, and
preserves data across restarts. `scripts/test-integration.mjs` creates and removes
only its own random schema. The distributable extension archive is generated
from built assets with fixed entry timestamps and excludes source maps.

## Recoverable lobby entry

Current clients persist a private random admission key before create/join. The API serializes that key in PostgreSQL before any game lock and binds it to the normalized request using nullable Player admission metadata. Exact retries recover the same membership and current state without new revision/broadcasts. Pending intent is separate from installed player state and survives browser restart. See GAME_CONTRACT.md v1.2 for protocol, compatibility and explicit abandonment behavior.

The API normalizes its PostgreSQL URL with bounded connect/pool/query defaults before creating Prisma. Explicit operator values are preserved. An isolated established-connection stall test verifies liveness, bounded readiness failure, transaction rollback and restoration; see WR-EWP-009 for the measured profile.

## Results and linked rounds

Explicit state summaries include final standings inputs and the original scored
article for each earned square. Normal evidence follows the authenticated or
spectator-selected player; Lockout evidence follows exclusive claims. Shared
pure presentation helpers keep extension and spectator results consistent.

A unique Game.rematchOfGameId links rounds. The host opens one fresh board with
the same generation settings and copied teams; each member opts in separately.
Source then destination row locks serialize creation and recovery. Derived private
credentials permit exact recovery without exposing source credentials in state.

## Persisted lobby readiness

`Player.isReady` records each member's explicit choice. The ready setter, host
start gate, team-reset and roster transitions share the existing game-row lock;
only effective changes increment revision and broadcast. This adds no new socket
protocol, presence service or separate authority. The extension and spectator
render public summaries; the server checks active membership at start even if a
client is stale. New and rematch players default unready, while reconnects retain
their saved choice. See GAME_CONTRACT.md v1.4 and WR-EWP-011.

## Joining locks and membership removal

Host access controls extend the same game-row serialization. Ordinary and rematch
admissions check `Game.isJoinLocked` only after recovering any existing identity.
Host removal marks the retained player row as departed with a removal flag; token
validation precedes the specific revocation explanation. No ban store or socket
membership authority is introduced. Next-round lock changes notify the prior room.
An invalid extension session disconnects and ignores late state responses until
it is explicitly replaced. See GAME_CONTRACT.md v1.5 and WR-EWP-012.

## Catalog-derived custom setup

The engine builds one distinct eligible article catalog per difficulty and uses
it for both capacity reporting and board selection. The public board-options
route reports capacities without database access. Shared pure configuration
validation/summary helpers serve extension and spectator presentation. The popup
loads capabilities from the selected API through its existing background owner,
ignores superseded responses, and keeps setup failures separate from session
revocation. Existing Game.boardConfig JSON, keyed admission and rematch copying
provide persistence; no new tables or state authority are introduced.

## Server-owned round deadlines

Nullable duration/deadline fields extend Game; a status/deadline index supports
expiry scans. The existing row-lock mutation wrapper commits due expiry before
re-entering the requested operation, keeping expiry independent of validation
rollback. Admission and rematch recovery also check their locked destination.
The background sweep performs a bounded atomic UPDATE with SKIP LOCKED and sends
post-commit invalidations. One in-flight sweep per API instance avoids overlap;
startup and normal shutdown are tied to Fastify lifecycle hooks.

Raw comparisons convert the Date parameter to UTC timestamp-without-time-zone,
matching Prisma's stored DateTime representation regardless of database timezone.
Server time travels in an HTTP header, keeping state snapshots/revisions stable
and avoiding artificial mutations for clock ticks. Shared clock/text helpers use
monotonic elapsed time in extension and spectator; local countdowns cannot end a
round. Read paths stay read-only, and scoring stays serialized by the API.

## Authenticated ephemeral presence

Each Fastify instance owns a separate in-memory presence tracker passed to game
and realtime routes. A private socket frame authenticates existing membership
under the game-row lock; committed leave/removal revokes bound sockets. The
tracker aggregates sockets by player, tracks a ten-second disconnect grace and
publishes snapshots only to opted-in viewers. Disposal clears its timers and maps.
No database rows, revisions or readiness flags record connection state.

Shared parsing/presentation helpers serve the extension and spectator. Presence
travels separately from authoritative game snapshots, with socket/session/game
identity guards and unknown state on observation loss. Server native heartbeats
and client application-message watchdogs bound stale labels during normal awake
operation. Existing HTTP state and legacy WebSocket notifications remain intact.

## Ad-free hosted beta profile

`WIKIRACE_DEPLOYMENT=beta` enables fail-closed public origin/contact configuration,
bounded process-local request and socket admission, and a five-connection database
pool default. A database advisory lock serializes the 200-game storage cap across
fresh games and rematches. Existing credential recovery is evaluated before the
storage cap. The existing game-row lock bounds each game's lifetime memberships.

Scoring still evaluates the full eligible article payload under the game lock.
The beta persists only visits earning a new square, keeping title/URL/time and
discarding categories and outgoing links. Startup/hourly cleanup deletes finished
games older than 30 days through existing cascades; no Prisma schema change is
needed. Local profile persistence remains unchanged.

The beta extension embeds one HTTPS origin and removes optional server access and
the broad tabs permission. `/deployment`, `/privacy`, and download checksums let
the release command verify the hosted profile and exact package identity before
emitting an upload candidate. Render is configured for one API process and a new
private PostgreSQL database. Rolling deployment overlap is still a realtime
limitation; hosted operation and provider recovery require separate evidence.
See [BETA_LAUNCH.md](BETA_LAUNCH.md).
