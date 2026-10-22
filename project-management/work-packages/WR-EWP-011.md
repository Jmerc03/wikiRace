# WR-EWP-011 r1 — Lobby ready checks

Status: Done. Phase 1A: CLOSEOUT. Issued 2026-10-22 after the user's explicit selection of
“Lobby ready checks (recommended)” in this chat. That selection authorizes this
bounded continuation; this identifier was assigned afterward. Historical M1–M6
delegation and product acceptance are not extended or rewritten.

## Outcome and scope

Every active lobby member, including the host, explicitly marks Ready before
the host can start. Readiness is persisted with the authenticated membership
and synchronized through existing WebSocket invalidations. New joins and
rematches start Not Ready. A real team change clears that player's readiness;
joining the same team again is an idempotent no-op. Departed players do not
block start. Host transfer retains each remaining player's readiness. Active
solo joins and mode-specific scoring keep their existing behavior.

Use an additive Player boolean and authenticated, idempotent desired-state
setter, serialized with start/join/leave/team changes under the game row lock.
Show a readiness control, counts and roster labels in the extension; spectators
see read-only readiness. Readiness is an explicit choice, not online presence.
No force-start, kick, timer, daily challenge, scoring change or public hosting.

API owns persistence/lifecycle; Shared owns the public field; Extension owns
the control and presentation. System owns this record and cross-component
verification. Preserve the completed uncommitted WR-EWP-010 delivery and its
immutable evidence. Package as extension 1.5.0.

## Verification and delivery

Run Prisma generation/validation, workspace build/unit checks, database/HTTP/
WebSocket integration and actual Chromium workflows. Cover authorization,
strict boolean validation, gate enforcement, idempotence/revisions, concurrent
start/unready/join, departures/host transfer, team changes, rematches, restart
and response-loss recovery. Update earlier harnesses to explicitly ready their
players before starting. Qualify migration from the previous schema and saved
readiness through backup/restore. Preserve operator data with a backup before
deployment, then verify the running API and delivered assets. Migration commands:
`npm run prisma:migrate:deploy`, `npm run prisma:generate`, `npm run build` using
the selected `DATABASE_URL`; never reset the database.

JES Core was unavailable during the preceding continuation. Local records remain
authoritative; no synthetic Core execution, human approval or acceptance will be
created. Finish and report before 15:00 America/Chicago on 2026-10-22.

## Closeout — 2026-10-22

The ready check, live counts and per-player labels are implemented in extension
1.5.0 and spectator views. Start is gated in the API and UI; joins, departures,
host transfer, actual/same-team changes and rematches follow the defined rules.
No scoring or WebSocket protocol change was needed.

Build, 40 unit, 47 PostgreSQL/HTTP/WebSocket integration and 19 real Chromium
workflows passed with no required skips. Both modes, ready/unready/start races,
identity checks, idempotent retries, live spectator updates, browser restart,
committed-response loss, team reset and transferred host controls are covered.
The first API run counted the CONNECTED greeting as an update; the first browser
run retained one old copy assertion and checked revision before a pending action
finished. These harness failures remain in the original logs. Corrected complete
suites pass; no production failure is being hidden by an assertion change.

Actual prototype and previous-release upgrades passed. The immediate prior
schema retained every existing game/player column and session hash, defaulted
existing members to false, and preserved waiting/active/finished/rematch records.
Actual archive/restore preserved four games, seven authenticated sessions, mixed
lobby readiness, five admissions, two rematch recoveries, teams and 16 visits.
The stalled-connection check still rolls back the start action and permits its
same-identity retry after recovery. Prisma validation and reproducible packaging
across three time zones passed. Compact popup, mobile spectator and recovered
full-board screenshots were visually inspected.

The selected operator database was backed up before migration 11, and original
column digests were unchanged. It contained zero game rows; populated retention
is established by the separate fixtures above. The managed API is running ready
on its original loopback profile at http://127.0.0.1:4000. Actual served bytes match
the package and viewer assets. An HTTP smoke check of the running compiled API
verified the start gate and unready rematch; its temporary games were removed.
All disposable schemas and restore databases were removed. Original user browser
profiles were not changed: reload the unpacked extension to use 1.5.0.

Exact evidence and source inventory are in
[evidence/READY_CHECKS_20261022.json](../evidence/READY_CHECKS_20261022.json).
The source remains uncommitted over `1556487`, including the preserved WR-EWP-010
work. The 109-file source/test inventory has SHA-256
`af8c0aeb26d6cdade942d015db206eb85427566983a7f941babc14593cea518c`.
No new Windows/public-network/OBS/live-Wikipedia/minimum-runtime/long-duration
or subjective play qualification is claimed. Historical acceptance and earlier
Core reporting remain separate; no Core execution, approval or new owner
acceptance was fabricated. Engineering delivery completed before the 15:00
Central cutoff. Product-owner acceptance remains pending.
