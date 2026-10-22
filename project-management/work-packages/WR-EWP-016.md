# WR-EWP-016 r1 — Ad-free beta launch preparation

Status: Done for local launch preparation. Phase 1A: CLOSEOUT. Issued 2026-10-22.

Authority: Jaxson explicitly directed "prioritize launch prep over the daily
challenge and get it ready for an ad-free beta" and selected Render, with no
existing hosting. This identifier records that instruction after the fact; it
does not imply approval of an unseen document or a purchased/public deployment.
Daily challenge is deferred. Work stops before 15:00 America/Chicago today.

Scope: prepare one-instance Render API/private managed PostgreSQL deployment,
explicit beta runtime configuration, bounded request/socket/game admission,
minimal scored-article persistence and 30-day finished-game retention, privacy
disclosure, extension beta packaging and store submission materials. Preserve
the local profile, current data, multiplayer synchronization and game rules.
No ads, accounts, payments, matchmaking or multi-instance architecture.

The beta uses a fresh database. Local defaults retain existing behavior. A
hosted origin and public operator/support identity are required before release.
Provider signup, billing activation, public deployment, real-network testing
and Chrome review remain separately evidenced launch steps.

Verification: workspace builds/unit tests; real PostgreSQL/HTTP/WebSocket beta
tests for quotas, recovery, minimal storage, retention and origin handling;
existing integration and actual Chromium regressions; reproducible ZIP and
release preflight; visually inspect supplied store artwork/screenshots.
Document exact deployment commands, rollback and backup procedure, costs and
remaining gates. No schema change is planned. Retain existing uncommitted work.

Product traceability: approved local proposal v1.2 and delivered feature scope
remain historical; this direct user instruction authorizes the added beta
preparation scope. Public release/subjective acceptance is pending. JES Core
reporting is independent of the user's established repository authority.

## Implementation and verification closeout

Extension 1.10.0 and game contract v1.9 deliver the bounded preparation scope.
The Render blueprint uses one paid web instance and a private new PostgreSQL 16
database, manual deployment and fixed storage. The beta defaults to five pooled
connections, bounded HTTP/socket work, 200 saved games and 64 lifetime members
per game. Existing admission/rematch recovery precedes storage rejection.
Scoring uses the original payload but stores only earning title/URL/time data;
startup/hourly expiry removes finished games older than 30 days. No schema change
was introduced. Earlier additive migrations remain required on a fresh database.

The public policy and store packet use jaxmerc03@gmail.com and the disclosed
operator label WikiRace. The beta extension is restricted to one HTTPS origin
and English Wikipedia; only storage and alarms remain as API permissions. Local
custom-server support is retained. Original icons, two actual UI screenshots of
a synthetic match, and optional promotional art are supplied and visually checked.
The release CLI refuses a placeholder origin or mismatched hosted package and
preserves an existing candidate on failure. Hosted-response rehearsals are marked
as simulations. There is no real hosted ZIP release until deployment is available.

Build, 55 unit checks, the full 41-case Chromium suite, integration regression,
forced-worker recovery, bounded database-stall recovery, three-timezone package
reproducibility, official Render schema validation and clean beta installation/
Prisma generation/build pass. Compatible Fastify/URI dependency fixes leave zero
production audit findings. A disconnected-client characterization also confirms
the HTTP concurrency allowance is released; no additional runtime patch was needed.
Exact counts, source/artifact hashes and logs are in `evidence/BETA_20261022.json`.

Retained failed attempts: the first beta browser test clicked Leave Game instead
of End Match and was corrected; the first full browser run expected the old ZIP
file list and was updated to check the four icon assets. The clean-generation
rehearsal initially lacked its required DATABASE_URL and then needed normal
access to Prisma's local engine cache. Configured clean generation/build pass.
Release mismatch failure is intentional negative evidence, not a deployment.

The operator API was restarted on 1.10.0, is ready, and serves matching package
bytes. Exact original row hashes and thirteen migrations are unchanged; the
operator database contained zero games. All test schemas were removed. Reload
installed player extensions to use the new local build. No user browser profile
was modified. No paid account, Render resource or Chrome submission was created.

An Ubuntu/Node/PostgreSQL CI workflow is prepared with pinned actions and read-only
permissions; first hosted execution is pending. Remaining external gates are the
public source push, hosting account/charges, real-network play and proxy behavior,
managed restore, and Chrome review. Public product acceptance and JES Core
reporting remain pending. Daily challenge stays deferred. See BETA_DELIVERY_REVIEW
and docs/BETA_LAUNCH.md for the handoff; local preparation completed before 15:00
America/Chicago on October 22.
