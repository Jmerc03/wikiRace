# WR-EWP-005 r2 — Live and extended qualification

Status: Done. Phase 1A: CLOSEOUT. Owner: Codex. Date: 2026-09-07.

## Objective and authority

Qualify the delivered local product beyond short deterministic fixtures. Implements verification of PR-001 through PR-008 in proposal v1.1, depends on Done WR-EWP-004, and is approved initially by WR-DEC-008 and refined by WR-DEC-009 under the explicit owner/operator delegation.

## Bounded work

- Load the actual unpacked extension in an isolated Chromium profile and navigate real English Wikipedia without substituted network responses. Prove DOM extraction, persisted visit and objective completion; retain exact failure evidence if the external service cannot be reached.
- Exercise extension and spectator realtime beyond service-worker idle windows, with idle intervals, periodic moderate local gameplay, persisted state comparisons and bounded fault recovery. Keep network/load modest and isolate all test data.
- Review existing-data migration behavior, scoring edge cases, source/packaging reproducibility and operator instructions. Fix concrete defects with focused regression checks and additive migrations only when required.
- End exhausted Lockout boards as explicit draws when no owner reaches 13; verify persisted termination, unchanged majority rules and matching player/spectator displays.
- Maintain exact evidence and JES state, then adjudicate intended local delivered use. Stop at the reset cutoff; state remaining limits explicitly.

## Validation and ownership

Codex owns local implementation, tests, review and delegated acceptance. Real Wikipedia proof is distinct from fixture/browser proof; soak duration is measured and not described as indefinite reliability. No public deployment, native Windows or actual OBS application proof is required or implied. Validate any changes using applicable build/unit/integration/browser/Prisma commands. Retain failed attempts beside later results.

## Closeout

Verified product checkpoint: `f1e7fa4` (building on `b08e0ed`). Product fixes: unusable legacy host recovery, explicit exhausted-board draws, player-specific Normal winner highlights, compact large-roster stream layout and time-zone-independent atomic ZIP replacement. The failed Normal highlight reproduction is retained in `normal-highlight-01.log`; the corrected full eight-workflow browser run passed in `normal-highlight-02.log`.

Evidence in `.jes/local/ewp-005`:

- `verified-build.log`, `verified-unit.log`: full build and 28 unit tests pass. `capacity-integration.log`: 23 PostgreSQL/WebSocket cases pass, including concurrent 32-player admission and departed-slot recovery. `precommit-prisma.log`: Prisma validation passes.
- `live/1788824091326/result.json`: actual Wikipedia Science response, 5 categories, 2815 links, one persisted objective completion.
- `live-generated/1788824618210-NORMAL/result.json` and `1788824625010-LOCKOUT/result.json`: unmodified generated boards won through actual Wikipedia navigation, with 5 and 10 article navigations respectively. No response substitution.
- `upgrade/1788824329693/result.json`: actual original PostgreSQL schema upgrades while preserving visits/claims, retiring unusable sessions, retaining a current valid host, and marking unknown historical winners without invention.
- `endurance/1788824160225/result.json`: measured 1800-second run, popup closed, 40 committed visits, same identity, planned API restart recovered, exactly four total socket connections (two per API lifetime), zero unexpected reconnects. Initial and final source hashes are retained; the background bundle remained unchanged during this run. Separate API and UI refinements have their own tests.
- `worker/1788825325626/result.json`: an actually stopped Manifest V3 worker recovered via its alarm in about 60 seconds, without popup/content-script wakeup, preserving identity and server origin.
- `recovery/1788825210769/result.json`: a deliberately delayed old-game response arrived after a new session and did not overwrite its identity or board.
- `package/1788825628315/result.json`: identical ZIP hashes in UTC, Los Angeles and Tokyo time zones.
- Viewer evidence `.jes/local/ewp-004/browser/1788825116424`: 32-player and long-label overlay/mobile checks; the corrected full-roster screenshot was visually inspected. Draw and named Normal-winner multi-profile screenshots are retained under `.jes/local/ewp-003/browser` with their run logs.

Three attributable Draft observations were recorded through JES and read back; see `OBSERVATIONS.md` and `.jes/local/coordination/1788824889048327000`. No synthetic Execution or human Approval was created.

Delegated owner closeout accepted by WR-DEC-011. This completes the bounded live/extended package, not an assertion that every dataset article, public host, Windows machine, or actual OBS application has been qualified. Operator backup/restore and final delivered-use adjudication continue in WR-EWP-006.
