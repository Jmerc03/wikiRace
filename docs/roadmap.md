# Roadmap

The accepted plan and evidence are in [ENGINEERING_PLAN.md](../project-management/ENGINEERING_PLAN.md) and [PROJECT_STATE.md](../project-management/PROJECT_STATE.md).

## Delivered local product

- M1: JES 0.3.0 registration, explicit monorepo ownership, preserved inherited baseline and real database characterization.
- M2: protected player sessions, valid 25-square boards, transactional claims/completions, consistent final winners and separate Normal/Lockout rules.
- M3: waiting lobby, host start/end/transfer, team setup, leave/resume, configurable server, WebSocket recovery and browser restart persistence.
- M4: read-only spectator and transparent stream pages, downloadable extension, managed local startup/recovery, clean install and integrated browser verification.

## Current qualification

Real Wikipedia extraction and extended realtime/recovery qualification are tracked separately from deterministic fixture tests. Follow bounded package status in `project-management/work-packages`.

## Future product decisions

Public lobbies, matchmaking, friends, daily boards, speedruns, tournaments, rankings, statistics and AI boards remain future work. Public hosting, native Windows qualification and multi-process realtime require their own actual evidence and scoped delivery decision.

See [TECH_DEBT.md](TECH_DEBT.md) for retained engineering limits.
