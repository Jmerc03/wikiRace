# WR-EWP-009 r1 — Database faults, runtime floor and multi-room operation

Status: In Progress. Phase 1A: EXECUTION. Owner: Codex. Date: 2026-09-08 UTC.

## Objective and authority

Verify bounded failure/recovery when an established PostgreSQL connection becomes unresponsive, the declared Node runtime floor, and sustained multi-room operation. Proposal v1.2 PR-002/003/005/007/008; plan v1.5; delegated execution approved by WR-DEC-020 under the two-hour continuation.

## Scope, ownership and dependencies

Depends on the verified WR-EWP-007 admission contract. Final multi-room/runtime composition depends on WR-EWP-008 completion. System owns qualification, source/evidence and runtime composition; API owns connection limits/error recovery; Extension is an affected recovery consumer if changed. Existing ownership remains unchanged. Affected paths: API database configuration/error handling if defects are proven, isolated qualification scripts/tests and operating/project docs. No Prisma model or scoring change is planned.

## Requirements and constraints

Use an isolated loopback database proxy and test API, never interrupt the operator database. A stalled query must not leave readiness indefinitely pending; process liveness stays available. Supported connection/pool/query deadlines may be supplied through Prisma v6 configuration without disabling operator-specific values. Verify recovery without partial committed game changes or duplicated admissions. Use actual official Node 22.12 in an isolated path and retain binary provenance; no global runtime replacement or false Windows claim.

Run four games with 16 players each and 32 real WebSocket clients per game for 3600 seconds, with real HTTP state reads, separate Normal/Lockout assertions, one controlled API restart, measured resource use and complete cleanup. Bound the workload to this local profile; do not infer indefinite or public-scale reliability. Do not change installed dependencies or loaded product source during the long run. Documentation/independent review can continue.

## Validation and done

Retain pre-fix fault evidence if a defect is found. Require bounded failure and successful restoration, exact membership/state assertions, complete normal unit/integration/browser checks after product fixes, and explicit minimum-runtime outcomes. Smoke-test the load harness before the full measured run. Retain source hashes at start/end and evidence without credentials. Close only after required results, cleanup, docs and observations; final delivered-use adjudication remains a separate owner decision. Cutoff: 2026-09-08 03:10:09 UTC.

## Closeout

Pending.
