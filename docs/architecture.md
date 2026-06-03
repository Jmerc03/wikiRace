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
