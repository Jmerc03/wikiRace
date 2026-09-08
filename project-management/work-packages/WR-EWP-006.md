# WR-EWP-006 r1 — Operator recovery and final qualification

Status: In Progress. Phase 1A: EXECUTION. Owner: Codex. Date: 2026-09-08 UTC (2026-09-07 local).

## Objective and authority

Complete PR-007 recovery evidence and PR-008 delivery adjudication for proposal v1.1 and plan v1.2. Depends on Done WR-EWP-004; runs alongside the remaining WR-EWP-005 endurance check. Execution approved by WR-DEC-010 under the explicit project owner/operator delegation.

## Bounded work and ownership

- Document and execute PostgreSQL backup/restore using supported native tools. Restore only into a newly created, uniquely named verification database. Preserve source data, private session-hash handling and original records. Never replace/reset the operator database.
- Verify restored board, roster/team membership, visits/claims/completions, host/winner/revision fields and authentication using a retained test session token. Compare authoritative stored rows before/after restoration.
- Exercise repeated game creation/join/scoring/departure and WebSocket cleanup at modest cadence against isolated test data. Record measured duration, cycle count and observed failures; do not infer indefinite or public-scale reliability.
- Apply already verified checked-in migrations to the owned local profile, leave the local API ready, retain package/source/evidence hashes, finalize JES coordination and the intended-use acceptance record.

Codex owns local software implementation, testing and delegated acceptance. Documentation/scripts are focused operator support, not scheduled backup infrastructure. No public publication, native Windows or physical/OBS capture claim is added.

## Validation and done

Actual PostgreSQL archive restoration and row/state/auth checks must pass. Long-running qualification has an explicit bounded duration and cleanup. Applicable full build/unit/integration/browser checks must pass after any product changes, and Prisma validation/migration deploy must match checked-in SQL. Final acceptance names exact sources, evidence profiles and remaining limits. Stop at 2026-09-08 01:00 UTC.

## Closeout

Pending.
