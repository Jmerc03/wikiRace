# WR-EWP-002 r1 — Match integrity

Status: In Progress. Phase 1A: EXECUTION. Owner: Codex. Date: 2026-09-07.

## Objective and traceability

Make persisted gameplay deterministic and protected under invalid, repeated, foreign-player, and concurrent requests. Implements PR-001/002/003/005/007 under [proposal v1.0](../../PROJECT_PROPOSAL.md), [plan M2](../ENGINEERING_PLAN.md), and the identity/rules/consistency portions of [Game Contract v1.0](../../docs/GAME_CONTRACT.md).

## Requirements and scope

- Boards always contain 25 distinct squares; invalid count configuration returns a clear 400.
- Validate input limits and Wikipedia article URLs; invalid or foreign players cannot create events or change team membership.
- Create/join grants an opaque token; protect state and mutations with that token; never serialize stored hashes.
- Lock a game inside one transaction for player/team/event mutations. Atomic event, completion/claim, and winner writes; broadcasts only after commit. A real failure rolls back all writes.
- Persist the first Normal winner and team/player Lockout winner. Finished games cannot score. Separate mode evaluation remains explicit.
- Retain lobby/host/leave persistence fields for M3, without claiming its UI/lifecycle complete.

Affected: API routes/services/Prisma/tests, shared contracts as needed, engine board validation/tests, extension minimal token compatibility, setup. Existing records preserved with additive SQL migration. Run `npm run prisma:generate`, `npm run prisma:validate`, and `npm run prisma:migrate:deploy` against the explicitly selected local database; production databases are not reset.

## Dependencies and ownership

Depends on Done WR-EWP-001; blocks M3/M4. Codex operates local database and tests. No physical work. Shared/engine producer changes require API and extension builds. No new topology or normative JES/POS/EO changes.

## Validation and done

`npm run build`, `npm test`, `npm run test:integration`, `npm run prisma:validate`. Integration cases: foreign/unknown identity, bad payloads, separate progress, global winner, team ownership freeze, simultaneous duplicate claims and simultaneous winning visits, post-finish writes, actual post-commit WebSocket update, transaction rollback. New security behavior gets regression tests, not just happy-path checks. Record precise logs and migration command/results.

## Execution approval

WR-DEC-004 approves exact r1 under the user's explicit delegation. Scope reviewed and accepted by Codex as delegated owner on 2026-09-07. Any further product scope uses the proposal path.

## Closeout

Pending. Package technical completion does not assert extension browser qualification or delivered-product acceptance.
