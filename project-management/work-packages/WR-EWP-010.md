# WR-EWP-010 r1 — Results, scored articles and rematches

Status: Done. Phase 1A: CLOSEOUT. Owner: Codex. Date: 2026-10-22.

## Objective and authorization

Deliver the user's selected next feature batch: "Results, scored-article history, and rematches (recommended)". The selection directly authorizes this bounded implementation; this record assigns its identifier after that instruction and does not claim the user reviewed this document. Cutoff: 2026-10-22 15:00 America/Chicago. Baseline HEAD: `1556487`; clean working tree, build and 36 unit checks passed at intake.

This continuation extends proposal v1.2 PR-004/006 with the explicit feature scope below. Prior M1–M6 acceptance remains historical and is not acceptance of these additions. No new general product delegation is inferred. Engineering closeout will supply evidence; delivered-use acceptance of this feature batch remains pending the owner.

## Scope and design

- Results in extension/full board and spectator: stored outcome, elapsed match time, mode-correct final standings. A Normal bingo winner remains winner even if another player completed more squares. Draw/host-end/legacy outcomes remain distinct.
- Scored-article evidence: each completed square exposes only the recorded earning article, scorer and time. Normal follows the selected player's independent completions; Lockout shows the exclusive claimant. Never return unrelated navigation history or session hashes. Article links are validated and rendered as text.
- Rematches: a finished match has at most one next lobby, created by its current host. Copy board settings and generate a fresh board; carry names/colors/teams as players explicitly opt in. The old match and its evidence remain available. Each original membership can enter once; retry after lost acknowledgement recovers that same new membership without duplication. New admission into the rematch is lobby-only so team membership cannot change during play. Existing joined members may recover after start/finish; departed new memberships cannot reenroll through retry.
- Use additive nullable provenance fields and migration SQL. Preserve existing opaque bearer authentication, transactional game locks, post-commit websocket invalidation, Normal/Lockout separation, and current 32-player/16-team limits.

System owns this package, docs and integration evidence. API owns serialization/rematch transactions/migrations; Extension owns UI and session transitions; Shared owns result contracts/presentation helpers consumed by extension and spectator. Game-engine scoring is unchanged.

## Validation and done

Require build, unit, PostgreSQL/HTTP/WebSocket integration, Prisma validation, actual Chromium extension/spectator tests, and diff hygiene. Cover winner-versus-score ordering, ties/draws, duration, Normal evidence isolation, multi-square article evidence, duplicate visits, safe links/text, rematch authorization/concurrency/retry/teams/lifecycle, old-result preservation, browser restart and response loss. Migration commands: `npm run prisma:generate`, `npm run prisma:validate`, `npm run prisma:migrate:deploy` with the selected `DATABASE_URL`.

No public hosting, daily challenges, ready checks, accounts, new scoring rules, or broad refactoring. No subjective playtest/public-network/OBS claim. Tests use disposable database schemas and browser profiles; no reset of operator data.

## Reporting context

JES Core at `127.0.0.1:8100` is unavailable at intake (connection refused). Repository records remain authoritative for this independently user-authorized work. No synthetic Execution/Approval is created. Any closeout observation report remains pending until delivered through the supported API.

## Closeout

Engineering closeout completed 2026-10-22, before the 15:00 Central cutoff.

- Implemented results/duration/standings, per-square article evidence and history, spectator round links, and explicit recoverable rematches. Added a stale-popup game-ID guard and recovery after explicitly staying in the previous match. No scoring-rule change.
- Build, 40 unit checks, 39 PostgreSQL/HTTP/WebSocket integration checks and 16 actual Chromium workflows passed with no required skips. Final logs: `.jes/local/ewp-010/unit-final.log`, `integration-03.log`, `browser-final.log`. Browser evidence: `.jes/local/ewp-010/browser/1792684579449`.
- Browser checks include separate Normal/Lockout sessions, preserved independent scoring, team carryover, old-match evidence, literal user text, suppressed unsafe legacy URLs, dialog keyboard dismissal, compact popup layout, committed-response loss, browser restart, retry after next-round start, and stale old-round actions. The browser article DOM is deterministic fixture data; this does not claim a new live-Wikipedia qualification.
- The original-schema migration fixture passed. Actual archive/restore passed with four games, seven authenticated sessions, five original admission recoveries, two recovered rematch memberships, copied teams, 16 visits and retained outcomes. Exact rows remained unchanged during replay. Logs: `upgrade-01.log` and `backup-01.log`; raw results: `.jes/local/ewp-005/upgrade/1792684201851/result.json` and `.jes/local/ewp-006/backup/1792684269399/result.json`.
- Prisma schema validation passed. Extension 1.4.0 is packaged reproducibly across three time zones: SHA-256 `6134c716dcad765f2fe93323bbf72aef3a6af5647679edb1286c05d2dcf5537b`. Package evidence: `.jes/local/ewp-005/package/1792684549291/result.json`.
- The previously stopped dedicated PostgreSQL instance was started. Sandbox shared-memory/network restrictions prevented the first attempts; approved elevated commands allowed the isolated checks to run. Original failed-attempt logs remain retained. A backup was saved before deploying migration 10 to the selected local database. The operator database contained zero game rows at intake; exact row digests stayed unchanged. Populated preservation is established by the separate upgrade/restore fixtures, not by that empty operator comparison.
- The managed loopback API is running and ready at `http://127.0.0.1:4000`, with all ten migrations. Actual HTTP bytes match the tested viewer/shared assets and ZIP. All disposable schemas/restore databases were removed. `.jes/local/ewp-010/delivery-verification.json` records the running version, source inventory, asset hashes and cleanup.
- Source remains an uncommitted working-tree change based on `15564871f2c5e0cf8276206b2bec5c8e2a39e911`; exact 106-file source/test inventory SHA-256: `aa3e7bfe74dff1e99ae581bdc7a573012246944fa3d8d22bbe40dbfd913e4c75`. A clean baseline HEAD is not claimed as the changed source revision.
- Original installed Chrome profiles were not reloaded; the user must reload the unpacked extension or install the new ZIP to use 1.4.0 there. Native macOS/Node 24.15 is the current execution profile. No new Windows, public deployment, OBS capture, minimum-runtime, long-duration or subjective-play qualification is claimed.
- WR-OBS-2026-008 is recorded locally as a Draft; JES Core reporting remains pending because the API was unavailable. No Core Execution, human-attributed approval, product acceptance, or improvement proposal was fabricated.

PR-004/006 continuation outputs are complete with the user's intended local flow. Product-owner acceptance of the new batch remains pending; see `FEATURE_DELIVERY_REVIEW.md`. This does not reopen or overwrite historical M6 acceptance.
