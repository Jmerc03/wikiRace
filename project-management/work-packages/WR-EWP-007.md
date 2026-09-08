# WR-EWP-007 r1 — Recoverable lobby admission

Status: In Progress. Phase 1A: VERIFICATION. Owner: Codex. Date: 2026-09-08 UTC.

## Objective and authority

A create/join request whose response is lost can recover its original player and lobby through an exact retry, including after browser/service-worker restart. Traces to proposal v1.2 PR-001/005/007 and plan v1.3 M6. Execution explicitly approved by delegated-owner WR-DEC-017 under continuing user authority WR-DEC-014.

## Scope and ownership

WikiRace System owns the contract, migration composition, tests and documentation. API owns transaction/replay behavior; Extension owns private pending intent and explicit retry/abandon UI; Shared owns any changed wire shape. Existing `.jes/OWNERSHIP.md` remains authoritative. No unrelated gameplay, public hosting or ownership changes.

## Requirements and constraints

Persist private high-entropy intent before sending. Bind replay to canonical operation/payload and server; concurrent identical requests create exactly one game/player, and replay never increments revision or reenrolls a departed player. API stores hashes only. Keep existing unkeyed client compatibility. Never emit credentials in public data, invitations or UI state. Pending entry survives restart and blocks conflicting actions until successful recovery, definitive rejection or explicit abandonment. Existing sessions and all scoring/lifecycle rules remain unchanged. Use an additive nullable migration with deployment commands; never reset data.

## Dependencies and validation readiness

Depends on Done WR-EWP-006, approved proposal v1.2 and accepted plan v1.3. Blocks WR-EWP-008 integration and M6 delivered-use review. Affected artifacts: API admissions/auth/readiness/schema/migration/tests; extension background/popup/types/tests; game contract/setup and project records. Work runs sequentially in the shared checkout. Existing isolated PostgreSQL and actual Chromium validators are available; no human or physical evidence is required for this local claim.

## Validation and done

Retain a failing reproduction of committed-response loss. Cover concurrent same-key create/join, changed input or target, malformed keys, departed replay, no duplicate revision/broadcast, private-token exclusion, and recovery after pending browser restart. Actual browser tests must lose a committed HTTP response and recover the exact stored identity. Run full build/unit/integration/browser checks and Prisma validation. Review migration compatibility and actual deploy on the owned profile after isolated evidence passes. Close only with required results, docs and exact source/evidence; capture attributable lessons as Draft observations. No new product acceptance is implied by this package alone.

## Closeout

Pending.
