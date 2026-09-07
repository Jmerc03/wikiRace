# WR-EWP-004 r1 — Watch, operate and validate the local product

Status: In Progress. Phase 1A: EXECUTION. Owner: Codex. Date: 2026-09-07.

## Objective and traceability

Deliver a complete operator-managed local product with read-only spectator and OBS browser views, repeatable startup, distributable extension, and integrated evidence. Implements PR-006/007/008 and delivery validation of PR-001 through PR-005 under proposal v1.0, plan M4, and [Game Contract v1.0](../../docs/GAME_CONTRACT.md).

## Requirements and affected artifacts

- Spectator API and browser page show ordered board, roster, player/team scores, selected Normal progress, Lockout ownership, state and final winner. They cannot create players or score. Live updates, reconnect, missing-game errors and safe rendering of user names are required.
- A stream view hides controls and provides a transparent background, with a copyable OBS browser-source URL.
- Landing/operator view provides install/join/watch instructions, server readiness and extension download. Package the built extension reproducibly and verify its manifest/content.
- Local setup/start/stop preserves data, uses explicit origins, checks database readiness, and supports the current Mac environment. Document Docker/Windows paths without claiming unrun native qualification. Existing Docker data is not reused/reset silently.
- Review reported dependency advisories and resolve compatible fixes with tests. No blind major upgrade or reset.
- Retain actual source/command/browser evidence, update roadmap/debt/state, report attributable JES progress, and issue a bounded delivered-use decision under the owner's delegation.

Affected: API public views/routes/config, extension watch controls, operator/build scripts, packaging, tests, documentation and JES reporting. Continue existing single-process API architecture; no new website hosting platform or public deployment is necessary.

## Dependencies, validation and ownership

Depends on Done WR-EWP-003. Codex owns all local software work and evidence adjudication. Validation: full build/unit/integration/browser suites; spectator rendering/live updates/read-only counts; invalid/malicious names rendered as text; package extraction; actual local setup/start/readiness/stop/restart; migration safety and source diff review. Browser screenshots must be visually inspected. Native Windows, OBS application capture and public internet qualification remain separate if not actually exercised.

## Approval and done

WR-DEC-006 approves r1 under the user's explicit owner/operator delegation, 2026-09-07. Done requires all required local-product gates to have evidence and docs. The final delivered-product decision identifies exact intended use and limitations; it does not turn untested deployment paths into supported evidence.

## Closeout

Pending.
