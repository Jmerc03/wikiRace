# Roadmap

The accepted plan and evidence are in [ENGINEERING_PLAN.md](../project-management/ENGINEERING_PLAN.md) and [PROJECT_STATE.md](../project-management/PROJECT_STATE.md).

## Delivered local product

- M1: JES 0.3.0 registration, explicit monorepo ownership, preserved inherited baseline and real database characterization.
- M2: protected player sessions, valid 25-square boards, transactional claims/completions, consistent final winners and separate Normal/Lockout rules.
- M3: waiting lobby, host start/end/transfer, team setup, leave/resume, configurable server, WebSocket recovery and browser restart persistence.
- M4: read-only spectator and transparent stream pages, downloadable extension, managed local startup/recovery, clean install and integrated browser verification.

- M5: real Wikipedia/generated-board wins, 30-minute idle/restart recovery, 45-minute repeated-session cleanup, legacy migration, backup/restore and final local delivered-use acceptance.

- M6: recoverable admission, explicit invitations, trusted-network binding with same-host interface evidence, bounded database failure, supported-runtime verification and sustained multi-room/browser recovery.

## Completed qualification

All six milestones and nine packages are Done. [Local delivery against proposal v1.2 is accepted](../project-management/DELIVERY_ACCEPTANCE.md) by delegated-owner WR-DEC-024. The one-hour 64-player/128-WebSocket profile and strict 30-minute current-browser repeat passed. The supplemental 45-minute browser attempt failed its uninterrupted-connection criterion during a correlated display transition; that failure and successful automatic recovery remain distinct evidence under WR-DEC-023. No general uninterrupted power-transition claim is made.

Real Wikipedia, deterministic fixtures, minimum Node, restoration and sustained operation retain separate evidence profiles and exact checkpoints. The [initial local delivery](../project-management/baselines/DELIVERY_ACCEPTANCE-v1.0.md) remains historical; M6 records do not rewrite its evidence.

## Feature continuation — completed 2026-10-22

WR-EWP-010 delivers the user-selected next batch in extension 1.4.0:

- Final results, duration and standings that preserve Normal bingo and Lockout majority rules.
- Scored-article history and per-square article details in the extension and spectator.
- Fresh linked rematch lobbies with explicit player opt-in, name/color/team carryover, old-results links and restart-safe recovery.

Build, 40 unit, 39 database/API and 16 Chromium checks passed, along with old-schema migration, populated backup/restore and package verification. The local API is updated and ready. See [WR-EWP-010](../project-management/work-packages/WR-EWP-010.md) for evidence and [feature delivery review](../project-management/FEATURE_DELIVERY_REVIEW.md) for the separate pending owner decision. M1–M6 acceptance above remains historical.

## Lobby ready checks — completed 2026-10-22

The subsequent user selection is delivered by WR-EWP-011 in extension 1.5.0.
Players explicitly mark Ready; the host starts only when all active members are
ready. Live roster/spectator labels, persisted choices, team-change reset and
unready rematches are verified. Build, 40 unit, 47 integration and 19 Chromium
checks pass, as do previous-schema/prototype upgrades, archive/restore and
bounded database failure. The local service is updated with migration 11.
See [WR-EWP-011](../project-management/work-packages/WR-EWP-011.md) and its
[evidence index](../project-management/evidence/READY_CHECKS_20261022.json).

## Host lobby controls — completed 2026-10-22

WR-EWP-012 delivers the next explicit selection in extension 1.6.0: confirmed
waiting-player removal, joining lock/reopen during waiting or active play,
clear revocation/recovery behavior and access labels in all views. Locks preserve
existing-session recovery and new rematches start open. Full build, 40 unit,
55 integration, 24 Chromium workflows, three migration cases and populated
archive/restore pass. The local API is ready with twelve migrations.
See [WR-EWP-012](../project-management/work-packages/WR-EWP-012.md) and
[host-control evidence](../project-management/evidence/HOST_CONTROLS_20261022.json).

## Custom board setup — completed 2026-10-22

WR-EWP-013 delivers named-article/flexible-objective mix, catalog-derived topic
capacity validation and shared configuration summaries in extension 1.7.0.
Defaults stay unchanged; custom settings survive recovery and fresh rematches.
Build, 43 unit tests covering all 1,950 combinations, 59 integration cases,
30 actual Chromium workflows, populated archive/restore and packaging pass.
The local API is ready with twelve existing migrations; no new migration is needed.
See [WR-EWP-013](../project-management/work-packages/WR-EWP-013.md) and
[custom-board evidence](../project-management/evidence/CUSTOM_BOARD_20261022.json).

## Optional timed rounds — completed 2026-10-22

WR-EWP-014 delivers optional 1, 5, 10, 15, 30 and 60-minute rounds in extension
1.8.0. Untimed remains default. Server deadlines drive shared countdowns, close
scoring at expiry and survive restart. Time expiry records no winner; rematches
retain the duration and start a fresh clock. Existing victory rules remain.
Build, Prisma validation, 46 unit tests, 70 integration cases, 35 Chromium
workflows, four migration cases, populated archive/restore, database-failure
recovery and reproducible packaging pass. The local API is ready with thirteen
migrations. See [WR-EWP-014](../project-management/work-packages/WR-EWP-014.md) and
[timed-round evidence](../project-management/evidence/TIMED_ROUNDS_20261022.json).

## Player connection indicators — completed 2026-10-22

WR-EWP-015 delivers authenticated Online/Reconnecting/Offline roster labels in
extension 1.9.0, with unknown status when observation is unavailable. Duplicate
sockets count once; leave/removal revokes presence. Spectators see individual
connections and stream scorecards show team counts. Readiness, scoring and host
ownership remain independent. Build, 48 unit tests, 77 integration cases and
40 Chromium workflows pass, including actual disconnect-grace/freshness timing,
worker recovery, database-failure recovery and reproducible packaging. The local
API is ready; no new migration. See [WR-EWP-015](../project-management/work-packages/WR-EWP-015.md)
and [presence evidence](../project-management/evidence/PRESENCE_20261022.json).

## Future product decisions

WR-EWP-016 prepares extension 1.10.0 for an ad-free Render beta. It adds a
one-instance/private-database blueprint, traffic and storage bounds, minimal
scored-article retention, public privacy contact, restricted hosted packaging,
store materials and release preflight. Local verification passes: 55 unit,
86 integration and 41 Chromium workflows, worker/database-failure recovery,
clean beta build and reproducible packages. Hosted CI is prepared; its first
run, Render deployment, two-network play, managed recovery and Chrome approval
remain pending. See [launch guide](BETA_LAUNCH.md) and
[beta delivery review](../project-management/BETA_DELIVERY_REVIEW.md).
The daily challenge is explicitly deferred in favor of launch preparation.

Public lobbies, matchmaking, friends, daily boards, speedruns, tournaments, rankings, statistics and AI boards remain future work. Public hosting, native Windows qualification and multi-process realtime require their own actual evidence and scoped delivery decision.

See [TECH_DEBT.md](TECH_DEBT.md) for retained engineering limits.
