# WR-EWP-009 r1 — Database faults, runtime floor and multi-room operation

Status: In Progress. Phase 1A: VERIFICATION. Owner: Codex. Date: 2026-09-08 UTC.

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

## Verification review, 02:14 UTC

The database fault correction and full Node 24 checks passed. The isolated official Node 22.12 clean install/build, 36 unit, 30 integration and 11 actual Chromium checks passed; both unmodified generated-board real Wikipedia modes also passed. The one-hour multi-room run is active against frozen product source `f03c4f4502021e7c251292efab241d33ad90e80f`.

Within the approved PR-005/007 durable-state recovery scope, extend the existing disposable backup fixture to populate the new admission request hashes and replay all five original create/join requests after restoration. Retain exact-row, authenticated-session and source-preservation assertions. This is a validation refinement, with no product-source, runtime dependency, schema or scoring change. Codex, delegated operator/reviewer, 2026-09-08 UTC.

## Completed verification before the sustained-run gate

- Established database stall: corrected fixture reproduces readiness exceeding eight seconds; runtime fix returns readiness 503 in 5008 ms and a failed host action in 5007 ms, preserves status/revision, and allows same-player recovery. `.jes/local/ewp-009/database-fault-before-02.log` and `database-fault/1788832686745/result.json`. The earlier proxy-setup failure remains separately retained.
- Standard Node 24.15: full build, 36 unit, 30 integration and 11 Chromium checks pass without required skips; `.jes/local/ewp-009/*-02.log`.
- Official minimum Node 22.12: verified archive, isolated fresh checkout/install, Prisma generation, build, 36/30/11 checks and validation pass, with zero installation audit findings. Two real-Wikipedia generated-board wins pass. ZIP and served shared invitation JavaScript are identical to Node 24. Provenance, logs and copied raw results: `.jes/local/ewp-009/node22-*`.
- Restore refinement: exact rows, five authenticated sessions, five original admission recoveries, mismatched-request rejection and unchanged replay rows pass on both runtimes. Standard result `.jes/local/ewp-006/backup/1788833661616/result.json`; minimum-runtime result `.jes/local/ewp-009/node22-artifacts/ewp-006/backup/1788834035689/result.json`. Isolated schemas and restore databases were removed.
- Current extension worker: alarm recovery after forced stop passes in 60.177 seconds, with original identity/origin/live connection; `.jes/local/ewp-005/worker/1788833755275/result.json`.
- Read-only review found no broken relative links among 46 checked links in 29 Markdown files and no mismatch among the first 56 completed evidence hashes. The expanded M6 inventory retains later completed artifacts separately from active logs.
- WR-OBS-2026-006 is captured/read back as a state-neutral JES Draft; no governance approval is implied by observation capture.

The 3600-second four-room run and supplemental 2700-second current-extension closed-popup session remain active. Their actual completion, exact results, unchanged source and cleanup are required for the final bounded closeout; no elapsed duration is assumed from an intended timer.
