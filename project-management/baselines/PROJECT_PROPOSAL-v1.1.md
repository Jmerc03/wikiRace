<!-- Historical baseline at 1f501ae7bfc376e023e2c715a279943986e7b2c2. Relative links relocated for reading; source text otherwise preserved. -->
# WikiRace Project Proposal

## Project Metadata

- Project: WikiRace — multiplayer Wikipedia bingo
- Accountable owner: Jaxson Mercer. Acting product/project operator: Codex, by the explicit delegation recorded in [the approval ledger](../APPROVAL_LEDGER.md).
- Author/reviewer: Codex in delegated owner and engineering roles; no independent reviewer is implied.
- Created/updated: 2026-09-07
- Boundary: continuation of the existing WikiRace product, with one product lifecycle and no parent product dependency.
- References: [product vision](../../docs/PRODUCT.md), [rules](../../docs/GAME_RULES.md).

## Proposal Version

Version 1.1. Version 1.0 was approved by WR-DEC-001. This refinement explicitly ends an exhausted Lockout board as a draw when no owner reaches 13; all other scope remains unchanged. Existing product documents and implementation are preserved as the input baseline.

## Status

Approved. Phase 1A: PROPOSAL_APPROVED. Decision WR-DEC-009 (v1.1); original v1.0 decision WR-DEC-001.

## Project Idea

Friends race through Wikipedia to complete a shared board of article objectives, competing independently or for exclusive territory as players and teams.

## Purpose

Turn the existing working prototype into a reliable, complete multiplayer game that can be started, joined, played, resumed, watched, and operated locally.

## Vision

A low-friction social game whose progress is clear to players and stream audiences.

## Product Specification

### In Scope

- PR-001: Create and join named multiplayer games with a valid 25-square board and understandable objectives.
- PR-002: Normal mode preserves independent progress; the first player with a row, column, or diagonal wins. Everyone sees the same final winner.
- PR-003: Lockout preserves exclusive first ownership; individual players or teams win with 13 squares. Ownership cannot be stolen or changed by switching teams after play starts. If all 25 squares are claimed without a majority, the match ends as a draw.
- PR-004: Players can form/join/leave teams before play, use a waiting lobby, start/end a match as host, and leave a game without corrupting its history.
- PR-005: Navigation updates everyone promptly. Reload, reconnect, temporary backend failure, and extension restart preserve recoverable sessions and show useful status.
- PR-006: A read-only spectator view and a stream-friendly browser view show the board, roster, scores, match state, and winner.
- PR-007: An operator can install, start, validate, configure a backend address, and recover the local product using documented commands.
- PR-008: Project plans, bounded execution, and evidence use JES 0.3.0 with traceable decisions and honest qualification limits.

### Out of Scope

Public matchmaking, accounts/social graphs, rankings, daily challenges, tournaments, AI boards, billing, cloud infrastructure provisioning, and anti-cheat attestation are future product work. Public internet production and Windows qualification require their own actual evidence.

### Constraints

Preserve the existing Chrome extension product, multiplayer synchronization, and distinct Normal/Lockout rules. Preserve existing records and source work. Do not claim live browser, cross-machine, or public service proof from unit tests.

### Stable Product Concepts

Game, waiting lobby, active match, finished match, host, player session, team, board, objective, completion, exclusive claim, winner, and spectator.

### Optional Implementation Guidance

Retain the existing monorepo and its working components where practical. Engineering owns protocols, persistence, and testing design.

### Architecture Discoveries

Current implementation: Fastify, Prisma/PostgreSQL, a Chrome extension, and a shared game engine. Known gaps at intake: unprotected player identity, non-transactional writes, incomplete lobby lifecycle, missing real database tests, hard-coded localhost. These are engineering follow-ups, not new product discovery.

### Operator-Dependent Workflows

Install/start the service and extension; create a lobby; share its game ID; choose teams; start and play; identify the winner; leave or create another match. Spectators join read-only. Operators see failures and recover without losing player identity or silently creating a new match.

### Assumptions

Initial supported use is an operator-managed local service and English Wikipedia in Chrome. The reset cutoff is 2026-09-08 01:00 UTC (6 p.m. Pacific daylight time, 8 p.m. Chicago) unless the user corrects it. Browser automation may provide actual software evidence; subjective play enjoyment remains unknown.

### Open Product Questions

No blocking decisions. Public hosting destination and subjective play balance are deferred to a later owner decision.

## Delivery Strategy

First establish the baseline and real persistence tests, then protect match integrity, complete player lifecycle and recovery, and finally deliver spectator views and validate the integrated product. A cutoff report states remaining gaps without declaring incomplete work finished.

## Evaluation Summary

- Date/evaluator: 2026-09-07, Codex.
- Result: complete enough for this bounded local-product phase; no conflicting win rules.
- Owner refinement: use existing product intent and roadmap, prioritize reliable play over future social features.
- Version 1.1 refinement: three-or-more-owner Lockout can exhaust the board without 13 claims for any owner. Explicit draw termination removes an otherwise unrecoverable active match; accepted by WR-DEC-009.

## Approval Record

- Decision: Approved, WR-DEC-009 (v1.1), 2026-09-07. Original approval WR-DEC-001 (v1.0).
- Approver: Codex acting under Jaxson Mercer's explicit project-owner delegation in this task, not a claimed new human approval.
- Conditions: scope and evidence boundaries above; preserve existing work; stop at the stated reset cutoff.
- Rationale: the user expressly authorized editing/approving the proposal and plan, creating milestones/EWPs, and executing/testing them to make the product functional.

## Traceability

- Source idea/evidence: existing docs and checkout at `7c164a4`; exact dirty baseline retained in `.jes/local/baseline/`.
- Key decisions: [approval ledger](../APPROVAL_LEDGER.md).
- Systems Architecture handoff: [engineering plan](../ENGINEERING_PLAN.md), [interface/lifecycle specification](../../docs/GAME_CONTRACT.md).
- Delivered-product decision: accepted for the declared local intended use by WR-DEC-013; see [DELIVERY_ACCEPTANCE.md](../DELIVERY_ACCEPTANCE.md).
