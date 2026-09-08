# WikiRace engineering plan v1.2

Owner: Codex, delegated Systems Architect/project operator. Updated: 2026-09-07.
Proposal: [v1.1](../PROJECT_PROPOSAL.md), WR-DEC-009. Planning authority and acceptance: WR-DEC-002; v1.1 refinement accepted by WR-DEC-009; v1.2 recovery qualification accepted by WR-DEC-010. Review: Accepted. JES 0.3.0, POS v0.3.0-dev, EO v0.3-dev.

## Engineering objective and outputs

Make the existing local Chrome multiplayer product complete and recoverable, with a repeatable test path covering actual PostgreSQL and WebSocket behavior. Preserve the stack and existing working changes. Produce a versioned owner map, bounded EWPs, a lifecycle/interface contract, source changes, setup instructions, and evidence-backed closeout.

## Repository topology and artifact ownership

One System `JES-SYSTEM-WIKIRACE`, one Repository `JES-REPO-WIKIRACE`, existing checkout root. Canonical planning root: `project-management`; EWP registry: `project-management/work-packages`, namespace `WR-EWP`.

| Owner | Source | Responsibility and consumers |
| --- | --- | --- |
| WikiRace System | root, docs, project-management, scripts, infra | Product integration, requirements, contracts, validation, release composition |
| API Subsystem | apps/api | API, persistence, concurrency, realtime, spectator service |
| Extension Subsystem | apps/extension | Player UI, Wikipedia extraction, identity storage, reconnect |
| Game Engine Subsystem | packages/game-engine | Board and rule evaluation; API consumer |
| Shared Contracts Subsystem | packages/shared | Shared wire types; API and extension consumers |

No independent child products or repositories are introduced. Shared changes require producer and affected consumer checks. All source safety checks apply to the whole checkout.

## Architecture and engineering decisions

Current: PostgreSQL is the persistent authority; WebSocket rooms live in one API process. Selected: serialize game mutations with database row locks inside transactions, publish only after commit, and let clients refetch their own state. Add opaque per-player bearer sessions; never expose stored token hashes in roster/state. Use waiting/active/finished lifecycle and preserve departed players for ownership history. Keep mode-specific completion/winner logic separate. Complete the existing extension incrementally; serve spectator assets from the same API to avoid a second runtime.

Consequential cross-component behavior is specified in [GAME_CONTRACT.md](../docs/GAME_CONTRACT.md). These changes are planned until verified by their packages. Authentication protects player operations but client-supplied Wikipedia content is not cheat-proof.

## Milestones

| Milestone | Required output and exit gate | Packages | State |
| --- | --- | --- | --- |
| M1 Foundation | JES ownership/records and preserved baseline; real database characterization passes | WR-EWP-001 | Done |
| M2 Match integrity | Valid boards, validation errors, isolated identity, atomic claims/wins, stable winner | WR-EWP-002 | Done |
| M3 Complete player experience | Lobby/host/team lifecycle, leave/resume, configurable backend, resilient extension | WR-EWP-003 | Done |
| M4 Watch and operate | Spectator/stream pages, documented clean startup, integrated browser/API evidence, delivered-use review | WR-EWP-004 | Done |
| M5 Extended qualification | Real Wikipedia, idle/restart, upgrade/draw edges, backup/restore, repeated-session cleanup and final local delivered-use decision | WR-EWP-005, WR-EWP-006 | Done |

## Validation readiness and dependencies

| Claim/profile | Coverage and route | Owner | Prerequisite and evidence limit |
| --- | --- | --- | --- |
| Local software conformance | build, game-engine tests, isolated PostgreSQL route tests, real WebSocket clients | Codex | PostgreSQL absent initially; provision dedicated local instance without touching existing databases |
| Browser player/spectator behavior | actual browser automation or explicit manual procedure | Codex | inspect available browser capability; API tests alone do not prove extension loading |
| Service recovery | reconnect/restart, preserved credentials, durable DB, clear errors | Codex | fault injection against dedicated local services |
| Windows/public production | not in this delivery claim | future operator | requires native host/deployment evidence; no implied pass |

Validation commands: `npm run build`, `npm test`, targeted integration/browser suites, and `npm run prisma:validate` after schema changes. Every schema change includes checked-in SQL and migration commands. Record commands/results and source hashes. No publication or external messaging is necessary for the local milestone.

## Responsibility split and risks

Codex owns planning decisions, implementation, local software operation/testing, documentation, and evidence under the user's delegation. No physical work is required. Subjective play quality and unavailable native/browser claims remain identified follow-ups. Existing dirty files are preserved before mutation; the baseline is not misattributed to this session. Single-process realtime limits horizontal deployment; retain and document that boundary.

## First package and review

WR-EWP-001 establishes the baseline and persistence tests before transactional or interface refactoring. No blocking product decisions. Plan reviewed for scope, ownership, dependencies, validation feasibility, and preserved Normal/Lockout separation. Accepted by Codex as delegated owner, 2026-09-07.

## v1.1 qualification refinement

WR-EWP-005 implements an explicit draw when all 25 Lockout squares are claimed without a 13-square owner. Persist `BOARD_EXHAUSTED` with no winner and expose the same result to player/spectator clients. No Normal rule or majority threshold changes. Migration recovery retires unusable prototype sessions while preserving history and allows one new authenticated host to resume unfinished games.
