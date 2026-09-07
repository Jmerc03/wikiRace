# Technical Debt

This document tracks stabilization work that should be addressed before major
new features. Changes must preserve the game rules in `GAME_RULES.md`, including
Normal mode progress, Lockout ownership, team-aware wins, and multiplayer
synchronization.

## Priority 1: Stabilization Candidates

### Limited Automated Tests

Initial automated coverage protects bingo-line detection, Lockout owner grouping,
and response-shaping helpers. Database-backed route behavior remains largely
unprotected.

Next coverage should focus on:

- Page-visit route behavior
- Completion and claim persistence
- Game-finished status updates and WebSocket broadcasts

Classification: Stabilization candidate

### Duplicated Game-State Response Shaping

Pure helpers now map players, teams, claims, and winning-line results. Larger
mode-specific response objects remain in `apps/api/src/routes/games.routes.ts`
until route-level characterization tests exist.

Classification: Stabilization candidate

### Non-Transactional Page-Visit Writes

Page visits, completions or claims, and game status updates are separate writes.
A failure between writes can leave partially updated state. This needs focused
integration coverage before transaction boundaries are changed.

Classification: Deferred architectural work

### Trusted Player IDs

The API treats a client-provided player ID as identity. There is no
authentication or ownership token protecting player actions.

Classification: Deferred architectural work

### Board-Size Configuration Risk

Board configuration accepts vital-article and generic tile counts independently,
but the board size remains fixed at 5. Invalid count combinations can produce a
board whose square count does not match its declared dimensions.

Classification: Deferred architectural work

## Priority 2: Architecture and Deployment

### In-Memory WebSocket Rooms

WebSocket connections are stored in one API process. Multiple API instances
would not share broadcasts without a pub/sub layer such as Redis.

Classification: Deferred architectural work

### Hard-Coded Localhost API Endpoints

The extension directly uses `http://localhost:4000` and `ws://localhost:4000`.
Deployments need a configurable API and WebSocket origin.

Classification: Deferred architectural work

### Missing Shared Response Types

The API and extension independently describe game-state response shapes. Shared
types would reduce contract drift, but should follow response characterization
tests rather than lead them.

Classification: Stabilization candidate

### Extension Build Portability

The extension build uses Unix shell commands to clean and copy files. It works
for the current development environment but is not portable to every platform.

Classification: Documentation-only

### Empty Kubernetes Manifests

Files under `infra/k8s` are placeholders and do not define a deployable system.

Classification: Documentation-only
