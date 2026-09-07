# WR-EWP-001 r1 — JES adoption and executable baseline

Status: Done. Phase 1A: CLOSEOUT. Owner: Codex. Date: 2026-09-07.

## Objective and context

Establish an attributable JES 0.3.0 baseline and a repeatable real-database characterization path before changing match semantics. Implements PR-007/008 and the validation foundation for PR-001/002/003/005 in [proposal v1.0](../../PROJECT_PROPOSAL.md). [Plan v1.0](../ENGINEERING_PLAN.md), M1, owns architecture and dependency choices.

## Scope and constraints

Affected repository: WikiRace. Artifacts: `.jes`, project-management, build/test scripts, API/engine tests, setup. Preserve all preexisting edits and data. Do not reset a database. Use dedicated test schema/database. Normal and Lockout rules stay separate.

## Dependencies and responsibility

Depends on WR-DEC-001/002; blocks WR-EWP-002. Must precede semantic changes. Codex performs all software work and records missing browser evidence; no physical tasks. JES API registration may remain honestly pending if its operational prerequisites cannot be met, without blocking independently authorized repository tests.

## Requirements and definition of done

- Retain exact tracked diff and untracked inputs from the starting checkout.
- Record JES version, ownership, and repository/project context without fabricated approvals/executions.
- Make standard build/unit tests runnable; exercise create/join, Normal progress, Lockout/team claims, finished state, and WebSocket behavior against isolated PostgreSQL.
- Capture actual outcomes and identified defects before M2 fixes.

## Validation and documentation

`npm run build`, `npm test`, a database-backed integration suite. Retain baseline evidence and document database startup/test isolation. Evidence includes failures where they characterize a known gap; a failed required gate prevents Done.

## Execution approval

Approved: WR-DEC-003, exact package WR-EWP-001 r1; Codex acting under Jaxson's explicit owner/operator delegation, 2026-09-07. Conditions: scope above and no invented test claims.

## Closeout

Completed: standard build and all 23 unit tests pass; six new isolated PostgreSQL/API/WebSocket tests pass. Retained logs: `.jes/local/baseline/{build,unit-tests,integration}.log`. Original tracked diff and untracked source preserved there. JES 0.3.0 registration read back successfully for Project, Repository, System and four Subsystems; exact requests/receipts retained in `.jes/local/registration`. The owner map and v2 manifest are checked in under `.jes`.

Changed: test invocation avoids the tsx CLI's unnecessary sandbox IPC; isolated-schema integration runner and six behavioral tests; proposal/plan/ledger/state and setup; JES owner map/registration helper. Observation: normal build success had hidden absent database validation and unsafe mutation edges. Those are assigned to WR-EWP-002, without claiming them fixed here. No product acceptance decision is due for this foundation package.
