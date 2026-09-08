# Roadmap

The accepted plan and evidence are in [ENGINEERING_PLAN.md](../project-management/ENGINEERING_PLAN.md) and [PROJECT_STATE.md](../project-management/PROJECT_STATE.md).

## Delivered local product

- M1: JES 0.3.0 registration, explicit monorepo ownership, preserved inherited baseline and real database characterization.
- M2: protected player sessions, valid 25-square boards, transactional claims/completions, consistent final winners and separate Normal/Lockout rules.
- M3: waiting lobby, host start/end/transfer, team setup, leave/resume, configurable server, WebSocket recovery and browser restart persistence.
- M4: read-only spectator and transparent stream pages, downloadable extension, managed local startup/recovery, clean install and integrated browser verification.

- M5: real Wikipedia/generated-board wins, 30-minute idle/restart recovery, 45-minute repeated-session cleanup, legacy migration, backup/restore and final local delivered-use acceptance.

## Completed qualification

All five milestones and six packages are Done. [Local delivered use is accepted](../project-management/DELIVERY_ACCEPTANCE.md) under delegated-owner decision WR-DEC-013. Real Wikipedia and runtime/recovery profiles remain distinct from deterministic fixture tests. Source and host-local evidence hashes are recorded in the qualification index.

## Active continuation

M6 improves recoverable lobby entry and explicit server/game invitations under proposal v1.2 and plan v1.3. Historical M1–M5 acceptance remains unchanged; see current EWP records for continuation results.

## Future product decisions

Public lobbies, matchmaking, friends, daily boards, speedruns, tournaments, rankings, statistics and AI boards remain future work. Public hosting, native Windows qualification and multi-process realtime require their own actual evidence and scoped delivery decision.

See [TECH_DEBT.md](TECH_DEBT.md) for retained engineering limits.
