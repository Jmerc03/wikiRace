# WR-EWP-004 r1 — Watch, operate and validate the local product

Status: Done. Phase 1A: CLOSEOUT. Owner: Codex. Date: 2026-09-07.

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

Build, 28 unit tests, 20 isolated PostgreSQL/WebSocket cases, four actual Chromium workflows, and Prisma validation passed. Exact logs: `.jes/local/ewp-004/final-{build,unit,integration,browser,prisma}.log`. All temporary schemas were removed.

Clean `npm ci` and managed setup passed; the install reports zero vulnerabilities. The exact operator run `.jes/local/ewp-004/operator/1788823509001/result.json` verifies repeated start/stop, full API/database restart, persisted identity/board, unchanged preexisting game count, and cleanup of its sole verification game. It leaves the service ready on port 4000. Setup/install logs are in the same package evidence root.

Browser evidence `.jes/local/ewp-004/browser/1788823926376` verifies selected Normal progress, live updates, no enrollment/scoring by viewers, safe user-name rendering, transparent viewport-fitting overlay, landing readiness, archive contents, and Lockout winner. The equivalent operator, spectator, Lockout and overlay screenshots from the earlier passing run `1788823202695` were visually inspected. Extension M3 workflows also passed on the final sources.

Source review and `git diff --check` passed. No Prisma schema changed in this package. Runtime dependency updates retain Prisma 6; reviewed `deepmerge-ts` 8 override is documented. Windows, Docker runtime, live Wikipedia and actual OBS capture are not converted into passing claims.

Delegated owner decision: required M4 local gates accepted, WR-DEC-007. Further live/endurance/legacy qualification continues under WR-EWP-005; final delivered-use adjudication will reference both packages.
