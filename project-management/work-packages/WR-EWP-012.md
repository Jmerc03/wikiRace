# WR-EWP-012 r1 — Host lobby controls

Status: Done. Phase 1A: CLOSEOUT. Issued 2026-10-22 after the user's explicit selection of
"Host lobby controls: remove players and lock joining (recommended)" in this
chat. Identifier assigned afterward; no unseen-document or general product
approval is claimed. Preserve WR-EWP-010/011 and their completed evidence.

## Scope and behavior

The current host can remove another active member in WAITING, with an explicit
UI confirmation. Self-removal uses existing Leave Game. Removal ends that saved
membership, clears its readiness and retains the row with a public removal marker.
The removed player receives a specific authenticated explanation; its session
cannot ready, score, change teams or recover through admission/rematch replay.
A fresh anonymous membership can join when joining is open; this is not an
account or IP ban. Active/finished players cannot be removed by the host.

The current host can lock or reopen joining in WAITING or ACTIVE. Locking blocks
new normal admissions and new rematch opt-ins, while existing authenticated
sessions and exact committed-admission/rematch recovery keep working. Locking
persists through start and host transfer. New games/rematches default open.
Finished matches remain closed and their lock cannot change. Use explicit
idempotent desired-state setters and the existing game-row lock/revision system.
Concurrent lock/join and remove/start resolve as one serialized valid outcome.

Add default-false Game.isJoinLocked and Player.removedByHost columns; use existing
leftAt for membership revocation. Expose lock state in extension, spectator and
invitation views; controls are host-only and name rendering stays literal.
Keep scoring, teams, histories, credentials, presence and multiplayer protocols
otherwise intact. Package as extension 1.6.0. No kick-during-play, force-start,
ban system, matchmaking or daily challenge scope.

## Verification and delivery

Require workspace build/unit tests, PostgreSQL/HTTP/WebSocket integration,
Chromium multi-player workflows and restore/migration evidence. Cover owner and
cross-game checks, no-op retries, revocation/recovery, lock/start/team/leave races,
rematch carryover defaults and locked recovery, invitation/spectator state,
removed-player restart, lost responses and protected stale async state. Back up
operator data before deployment and compare original-column digests afterward.
Commands: `npm run prisma:migrate:deploy`, `npm run prisma:generate`,
`npm run prisma:validate`, `npm run build`, `npm test` with selected DATABASE_URL.
Never reset operator data. End before 15:00 America/Chicago on 2026-10-22.

Prior Core reporting remains unavailable/pending. Local records are authoritative;
no Core execution, human approval or product acceptance is fabricated.

## Closeout — 2026-10-22

Extension 1.6.0 implements confirmed waiting-player removal, current-host joining
locks/reopening in WAITING/ACTIVE, public access/removal labels, and previous-round
rematch lock notifications. Existing identities recover through locks; removed
members cannot recover or mutate with the revoked identity. Late state responses
cannot revive the extension's revoked state, and invalid sessions disconnect.
Visual review led to hiding stale team/readiness controls and clearly labeling
the cached board. New anonymous entries remain possible when joining reopens;
this does not claim a ban system.

Full build, 40 unit, 55 PostgreSQL/HTTP/WebSocket integration and 24 real Chromium
workflows pass. Actual browser tests cover both modes, confirmation cancellation,
removal/restart, lock/reopen, transferred host controls during play, committed
response loss, prior-round UI notifications, locked reconnect and a deliberately
held pre-removal state response. The first browser attempt captured the previous
round before the new controls were visible; that harness wait was corrected.
The original failed attempt is retained. All 24 passed before and after the visual
cleanup, with the final log identifying the delivered UI.

Three actual migration cases pass: prototype, pre-readiness and pre-host-controls.
Existing ready/session/history columns remain exact; old rounds default open and
historical departures are not relabeled. Actual archive/restore preserves four
games, eight player records, seven valid sessions, one revoked membership, five
valid admission recoveries, two rematch recoveries, locks, readiness, teams and
16 visits. The restored revoked identity and a new arrival to a locked round
remain rejected. Prisma validation and reproducible ZIP packaging pass.

The operator database was backed up before migration 12. It contained zero game
rows and retained its original-column digests; populated retention is established
by the fixtures, not that empty comparison. The original loopback service is
running ready at http://127.0.0.1:4000. A smoke check of the running compiled API
verified locking, rejection, removal, revocation, start and fresh open rematch.
Served assets match the verified package; temporary games, schemas and restored
databases were removed. Installed user browser profiles were not touched; reload
the extension to use 1.6.0.

The uncommitted source over `1556487` includes preserved earlier feature work.
Its exact 112-file source/test inventory SHA-256 is
`777ed6df689c184c414909f6b089763f9fd4eedcf3a0bb48de2851d3c2dd0a7f`.
See [host-control evidence](../evidence/HOST_CONTROLS_20261022.json) for logs,
artifacts and precise execution limits. No new platform, public deployment,
long-duration or subjective owner acceptance claim is made. Historical Core
reporting remains pending; no Core execution or human approval was fabricated.
Engineering delivery completed before the 15:00 Central cutoff. Owner acceptance
is recorded separately as pending in FEATURE_DELIVERY_REVIEW.md.
