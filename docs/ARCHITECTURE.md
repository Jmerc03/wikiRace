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
