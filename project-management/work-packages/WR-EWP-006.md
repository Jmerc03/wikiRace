# WR-EWP-006 r1 — Operator recovery and final qualification

Status: Done. Phase 1A: CLOSEOUT. Owner: Codex. Date: 2026-09-08 UTC (2026-09-07 local).

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

Accepted by Codex as delegated owner, WR-DEC-012, 2026-09-08 UTC. All bounded exit gates passed. Final clean-install implementation checkpoint: `3490cfe0ae6704d8e1fb595dd7c008cbc64eb470`. No product edits followed this checkpoint; final acceptance records are documentation changes.

- Forty-five-minute repeated-session run: `.jes/local/ewp-006/sessions/1788825830160/result.json`, 2700.002 seconds, 180 alternating Normal/Lockout lifecycles with three players each. Correct mode-specific scoring, host transfer and last departure; zero sockets after every cycle and no leftover games. Runner exited successfully and removed its random schema. This is measured local operation with synthetic visits, not an indefinite reliability claim.
- Backup restore: `backup/1788825914463/result.json`, exact authoritative row equality for three games, five players, one team, 75 squares, 16 visits, three completions and 13 claims; five retained sessions authenticated successfully.
- Managed operator cutover/rollback: `operator-restore/1788826885309/result.json`, isolated clone, original data preserved, restored session works, original profile restored, temporary database removed. Attempts with an existing public schema and profile changes while running led to focused fixes and retained rerun evidence.
- Actual default operator browser: `operator-browser/1788827299736/result.json`, fresh extension uses localhost:4000, real Random Wikipedia article, waiting/start behavior, full board, spectator and synchronized leave passed.
- Final clean installation and required full build passed, zero npm audit findings. `clean-unit-final.log`: 29 passed; `clean-integration-final.log`: 24 passed; `clean-browser-final.log`: eight actual Chromium workflows passed. No skipped required cases. Prisma validation passed; all eight migrations applied. `clean-package-final.log`: cross-time-zone reproducibility passed.
- `delivered-health-final.json`: API ready, owner instance matches, served 13,142-byte extension SHA-256 matches disk, zero test schemas/restore databases and zero operator games left from qualification. Native API and PostgreSQL remain running for local use.

Earlier failing attempts remain intact, including the initial socket-close timing assertion. The harness now waits for the server-side close event before assessing cleanup. Long runs and live-site runs cover the source checkpoints described in their own evidence; the final clean-install suite qualifies the final checkpoint above. Four JES observations remain captured Drafts; no broader process changes were approved through capture.

Evidence checksums: [QUALIFICATION_INDEX.json](../evidence/QUALIFICATION_INDEX.json). Final intended-use decision: [DELIVERY_ACCEPTANCE.md](../DELIVERY_ACCEPTANCE.md). Windows, Docker runtime, public deployment, actual OBS capture and off-machine backup storage remain outside the passing claim.
