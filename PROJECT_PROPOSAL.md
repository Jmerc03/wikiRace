# WikiRace Project Proposal

## Project Metadata

- Project: WikiRace — multiplayer Wikipedia bingo
- Accountable owner: Jaxson Mercer. Acting product/project operator: Codex, by the explicit delegation recorded in [the approval ledger](project-management/APPROVAL_LEDGER.md).
- Author/reviewer: Codex in delegated owner and engineering roles; no independent reviewer is implied.
- Created/updated: 2026-09-07
- Boundary: continuation of the existing WikiRace product, with one product lifecycle and no parent product dependency.
- References: [product vision](docs/PRODUCT.md), [rules](docs/GAME_RULES.md).

## Proposal Version

Version 1.2. Prior v1.1 is preserved in Git at `1f501ae7bfc376e023e2c715a279943986e7b2c2` and in the baseline archive. This refinement makes uncertain create/join recovery and shareable server/game invitations explicit under PR-001/005/007. Existing scoring rules and the local deployment boundary remain unchanged. Existing product documents and implementation are preserved as the input baseline.

## Status

Approved. Phase 1A: PROPOSAL_APPROVED. Decision WR-DEC-015 (v1.2); prior decisions WR-DEC-009/001.

## Project Idea

Friends race through Wikipedia to complete a shared board of article objectives, competing independently or for exclusive territory as players and teams.

## Purpose

Turn the existing working prototype into a reliable, complete multiplayer game that can be started, joined, played, resumed, watched, and operated locally.

## Vision

A low-friction social game whose progress is clear to players and stream audiences.

## Product Specification

### In Scope

- PR-001: Create and join named multiplayer games with a valid 25-square board and understandable objectives. Shareable invitations identify the intended server and game; joining remains an explicit player action.
- PR-002: Normal mode preserves independent progress; the first player with a row, column, or diagonal wins. Everyone sees the same final winner.
- PR-003: Lockout preserves exclusive first ownership; individual players or teams win with 13 squares. Ownership cannot be stolen or changed by switching teams after play starts. If all 25 squares are claimed without a majority, the match ends as a draw.
- PR-004: Players can form/join/leave teams before play, use a waiting lobby, start/end a match as host, and leave a game without corrupting its history.
- PR-005: Navigation updates everyone promptly. Reload, reconnect, temporary backend failure, and extension restart preserve recoverable sessions and show useful status. An uncertain create/join request can be retried to recover the same membership without creating duplicate players or lobbies.
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

Initial supported use is an operator-managed local service and English Wikipedia in Chrome. The original cutoff was met. The user extended this task for two hours; the continuation cutoff is 2026-09-08 03:10:09 UTC, based on the observed continuation start. Browser automation may provide actual software evidence; subjective play enjoyment remains unknown.

### Open Product Questions

No blocking decisions. Public hosting destination and subjective play balance are deferred to a later owner decision.

## Delivery Strategy

First establish the baseline and real persistence tests, then protect match integrity, complete player lifecycle and recovery, and finally deliver spectator views and validate the integrated product. A cutoff report states remaining gaps without declaring incomplete work finished.

## Evaluation Summary

- Date/evaluator: 2026-09-07, Codex.
- Result: complete enough for this bounded local-product phase; no conflicting win rules.
- Owner refinement: use existing product intent and roadmap, prioritize reliable play over future social features.
- Version 1.1 refinement: three-or-more-owner Lockout can exhaust the board without 13 claims for any owner. Explicit draw termination removes an otherwise unrecoverable active match; accepted by WR-DEC-009.

- Version 1.2 refinement: admission acknowledgement loss and server/game invitation ambiguity are addressed without expanding public hosting or scoring rules. Evaluated complete and consistent by the delegated Product Owner; accepted by WR-DEC-015.

## Approval Record

- Decision: Approved, WR-DEC-015 (v1.2), 2026-09-08 UTC. Prior approvals WR-DEC-009/001 remain historical.
- Approver: Codex acting under Jaxson Mercer's explicit project-owner delegation in this task, not a claimed new human approval.
- Conditions: scope and evidence boundaries above; preserve existing work; stop at the stated reset cutoff.
- Rationale: the user expressly authorized editing/approving the proposal and plan, creating milestones/EWPs, and executing/testing them to make the product functional.

## Traceability

- Source idea/evidence: existing docs and checkout at `7c164a4`; exact dirty baseline retained in `.jes/local/baseline/`.
- Key decisions: [approval ledger](project-management/APPROVAL_LEDGER.md).
- Systems Architecture handoff: [engineering plan](project-management/ENGINEERING_PLAN.md), [interface/lifecycle specification](docs/GAME_CONTRACT.md).
- Delivered-product decision: v1.1 local use remains historically accepted by WR-DEC-013; proposal v1.2 local use is accepted by WR-DEC-024 through delivery review v1.1, with explicit qualification boundaries and retained negative evidence. See [DELIVERY_ACCEPTANCE.md](project-management/DELIVERY_ACCEPTANCE.md).

## User-authorized feature continuation — 2026-10-22

The owner explicitly selected "Results, scored-article history, and rematches
(recommended)" for implementation before 15:00 America/Chicago. This bounded
addendum extends PR-004/006 with final standings and duration, the original
earning article for each displayed square, and a fresh linked lobby that carries
the group forward through explicit individual opt-in. Old match records and
Normal/Lockout rules must remain intact. No other future product features or
general owner delegation are inferred.

Implementation and verification are tracked in WR-EWP-010 r1 and the engineering
plan's feature continuation. The accepted v1.2 delivery above remains historical;
acceptance of these additional features will be a separate owner decision.

### Additional explicit selection — lobby ready checks

After WR-EWP-010, the owner selected "Lobby ready checks (recommended)" in the
same chat. WR-EWP-011 extends lobby coordination: each member explicitly readies,
the host starts only when all active members are ready, and the group sees saved
readiness across reconnects. New/rematch members start unready; team changes clear
that player's choice, and departures stop blocking start. Scoring and historical
results remain intact. This bounded implementation instruction does not imply
acceptance of the resulting feature or approval of unrelated future features.

### Additional explicit selection — host lobby controls

The owner subsequently selected "Host lobby controls: remove players and lock
joining (recommended)". WR-EWP-012 adds confirmed removal of other waiting players
and host-controlled joining locks during waiting/active play. Existing-session
recovery must remain possible while locked, and removed session history must be
retained. This is membership revocation, not a permanent identity ban. Existing
scoring and prior product-acceptance records remain unchanged.

## Custom board setup continuation — 2026-10-22

The user selected article/objective mix and topic variety in this chat. Execute
the bounded scope in WR-EWP-013 r1: validated 25-square custom setup, shared
configuration visibility and unchanged rematch settings. This selection does
not approve broader product scope or establish owner acceptance.

## Optional timed rounds — 2026-10-22

The user selected optional timed rounds. WR-EWP-014 r1 implements a fixed optional
duration, server-authoritative expiry, visible countdown and fresh rematch clocks.
Existing win rules remain; time expiry records no winner. This instruction does
not imply acceptance or additional product scope.

## Player connection indicators — 2026-10-22

The user selected player connection indicators. WR-EWP-015 r1 adds authenticated
live presence, a brief reconnect grace and offline/unknown labels in player and
spectator views. Presence does not change readiness, scoring or host ownership.
This scoped instruction does not imply product acceptance or broader authorization.

## Ad-free beta preparation — 2026-10-22

The user explicitly prioritized launch preparation over the daily challenge,
selected Render with no existing hosting, and supplied jaxmerc03@gmail.com as
the public support address. WR-EWP-016 r1 records this bounded added scope:
prepare deployment, privacy, abuse/storage bounds, a hosted-only extension and
store submission materials. Historical local-use acceptance stays scoped to
its original evidence. Paid provisioning, public operation, cloud recovery and
Chrome approval remain pending external launch steps.
