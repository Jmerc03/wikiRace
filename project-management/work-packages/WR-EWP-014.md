# WR-EWP-014 r1 — Optional timed rounds

Status: Done. Phase 1A: CLOSEOUT. Issued 2026-10-22 after the user selected
"Optional timed rounds (recommended)". The identifier follows that selection;
no unseen-document approval or broader delegation is claimed.

## Scope and decisions

Untimed remains default. The creator can choose 1, 5, 10, 15, 30 or 60 minutes.
The API accepts null or an integer duration from 60 to 7,200 seconds. The limit
is fixed at creation, visible to players/spectators/invitations and inherited by
rematches. Waiting time does not count. The first successful host start stores
one deadline; start retries, reconnects and host transfers do not extend it.

The API owns time. A persisted UTC deadline survives restart. A one-second
background sweep finishes idle expired rounds and broadcasts after commit;
mutations check expiry after obtaining the game-row lock. An operation accepted
under that lock before the deadline may complete atomically. At/after the
deadline, scoring is closed. Expiry records TIME_LIMIT with finishedAt equal to
the deadline, no fabricated winner, and exactly one revision transition.
Existing bingo/majority wins take precedence if already committed. No score-based
winner, overtime, pause, extension of an active clock or modified win threshold.

Clients use server clock metadata and monotonic elapsed time for a shared visible
countdown; they never decide final results. At zero they refresh until the server
confirms. Offline displays preserve identity and explain confirmation. Rematches
start with a fresh inactive deadline and the same configured duration.

Add nullable Game.timeLimitSeconds and Game.expiresAt plus a due-game index.
Old games remain untimed with every original column unchanged. Preserve omitted
create properties in admission fingerprints so pre-upgrade pending requests still
recover. Package extension 1.8.0. Preserve all earlier package evidence.

## Verification and deployment

Run full build/unit/integration/actual Chromium suites. Cover server-clock skew,
start idempotence, waiting/active/finished states, idle expiry, win-versus-expiry,
row-lock boundary rejection, old credentials, lost create/start responses,
restart recovery, rematches, read-only spectators and overlay countdown.
Verify additive migration, old admission recovery, timed populated archive/restore,
reproducible packaging and running compiled-service behavior. Back up the selected
operator database and compare original-column digests across deployment; never
reset it. Migration commands with the selected DATABASE_URL:
`npm run prisma:migrate:deploy`, `npm run prisma:generate`,
`npm run prisma:validate`, `npm run build`, `npm test`.

Stop before 15:00 America/Chicago on 2026-10-22. Existing Core reporting remains
pending; local evidence is authoritative. Owner acceptance stays separate.

## Closeout — 2026-10-22

Extension 1.8.0 and contract v1.7 deliver optional timed rounds in Normal and
Lockout. The clock begins on host start and appears in extension, spectator and
stream views. Expiry closes scoring and records no winner. Saved deadlines survive
reconnects, response loss, host transfer and API restart; rematches retain the
configured duration with a fresh inactive clock. Untimed remains the default.

Full build, Prisma validation, 46 unit tests, 70 PostgreSQL/HTTP/WebSocket cases
and 35 actual Chromium workflows pass. One browser workflow runs an unmodified
60-second round with a client wall clock twelve hours ahead. Separate accelerated
fixtures cover Lockout, restart across expiry and the running compiled API.
Offline zero preserves the session and asks to reconnect for confirmed results.
Compact, stream and offline screenshots were visually inspected.

Four upgrade cases pass. The new migration preserves every original column and
three exact pre-upgrade create recoveries across waiting, active and finished
rounds. Populated archive/restore preserves five rounds, nine player records,
eight authenticating sessions, six original admissions, two rematch recoveries,
one revoked session, custom configuration and waiting/active/expired timers.
Bounded database-failure recovery and three-timezone reproducible packaging pass.

The first integration attempt exposed a real timezone error comparing Prisma's
UTC timestamp columns with bound timestamptz parameters under America/Chicago.
Both expiry queries now explicitly compare UTC; dedicated UTC, Chicago and Tokyo
session tests pass. Test files sharing one schema run sequentially so one app's
expiry worker cannot mutate another file's deliberate overdue/offline fixture;
explicit concurrent race tests remain concurrent. A later browser run exposed
an older test navigating before its guest received ACTIVE. Waiting for the guest
start update fixed that fixture. All attempts remain in the evidence index.

The original loopback service is ready with thirteen migrations and verified
served assets. A pre-migration backup was retained. Original operator row digests
are unchanged after deployment and cleanup; the database contained no game rows,
so populated retention comes from the separate archive fixture. The compiled API
passed timed creation, idle expiry, late-visit rejection and same-limit fresh
rematch smoke checks. Owned smoke games, test schemas and restore databases are
removed. Installed user browser profiles were not changed; reload extension 1.8.0.

The 123-file source/test inventory over preserved uncommitted baseline 1556487
has SHA-256 `8df35c450c8655a7b137ec3befa53b656329e58501f5e247fd29a141e38535ec`.
See [timed-round evidence](../evidence/TIMED_ROUNDS_20261022.json). Delivery finished
before 15:00 Central. Owner acceptance and existing Core reporting remain pending;
no additional platform, live-site or subjective playtest qualification is claimed.
