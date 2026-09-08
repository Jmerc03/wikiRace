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

## Future product decisions

Public lobbies, matchmaking, friends, daily boards, speedruns, tournaments, rankings, statistics and AI boards remain future work. Public hosting, native Windows qualification and multi-process realtime require their own actual evidence and scoped delivery decision.

See [TECH_DEBT.md](TECH_DEBT.md) for retained engineering limits.
