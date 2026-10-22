# WR-EWP-015 r1 — Player connection indicators

Status: Done. Phase 1A: CLOSEOUT. Issued 2026-10-22 after the user selected
"Player connection indicators (recommended)". This bounded implementation follows
that direct instruction; the identifier was assigned afterward. No unseen-document
approval, broader delegation or owner acceptance is implied.

## Scope and decisions

Show Online, Reconnecting and Offline beside current players, separately from
their persisted readiness. An authenticated socket establishes presence; public
spectators and knowledge of a player ID cannot impersonate a player. Multiple
sockets count as one player; closing one does not disconnect the others. After
the last socket closes, show Reconnecting for ten seconds before Offline.
Heartbeat detection bounds silent socket failure. Explain that Online indicates
a connected extension, not attention or activity on Wikipedia.
Application-message watchdogs clear stale observation after 45 seconds, checked
every five seconds in the extension and 250 ms in the spectator.

Keep presence ephemeral and scoped to the existing single API process. No Prisma
change, saved last-seen timestamps or account service. Use a separate WebSocket
snapshot so connection changes never alter game revision, scores, readiness,
start gates, membership, host ownership or saved results. Credentials travel in
one private authentication frame, never socket URLs, public snapshots or logs.
Removal/leave revoke presence after commit; authenticate under the game lock so
concurrent revocation cannot leave a false Online identity.

Extension and spectator rosters display fresh status and clear it to unknown
when their observation connection is lost. Old servers/clients remain playable;
unsupported presence stays unknown. New rematch memberships authenticate afresh.
Show compact team connection counts in stream scorecards without overflowing the
fixed viewport. Package extension 1.9.0 and retain all previous evidence.

## Verification and delivery

Full workspace build, unit, real PostgreSQL/HTTP/WebSocket integration and actual
Chromium suites. Cover authentication/foreign/removed sessions, public viewers,
duplicate sockets, heartbeat expiry, grace/reconnect, leave/removal races, unchanged
rows/revisions/readiness, API and browser restart, old-server fallback, stale
old-session messages, rematches and compact/mobile/stream layouts. Verify packaged
assets, bounded database failure and the running compiled operator service.
Preserve the original database and remove only owned temporary fixtures. No new
migration is needed. Stop before 15:00 America/Chicago on 2026-10-22. Existing Core
reporting and subjective owner acceptance remain separately pending.

## Closeout — 2026-10-22

Extension 1.9.0 and game contract v1.8 deliver authenticated Online/Reconnecting/
Offline indicators, unknown observation during outages, individual spectator
rosters and team connection counts in the stream view. Readiness and membership
remain independent. No Prisma schema or migration change; the existing thirteen
migrations remain. Presence is rebuilt from authenticated sockets after restart.

Full build, 48 unit tests, 77 PostgreSQL/HTTP/WebSocket integration cases and
40 actual Chromium workflows pass. Integration uses the real twenty-second
heartbeat to detect a client that does not pong, and checks credentials, duplicate
sockets, revocation races, room isolation and unchanged rows/revisions. Browser
cases use the real ten-second grace and 45-second application-message freshness
deadline, including healthy HTTP/native pong with application frames suppressed.
They verify both game modes, restart, readiness retention, multiple board tabs,
rematch identity, stale old-room rejection, removal and older-protocol fallback.
Compact/mobile/stream/offline screenshots were visually inspected.

Actual forced MV3-worker termination recovers through its alarm without a popup
or content-script wakeup in 60.348 seconds, then authenticates presence with the
same saved identity. Bounded database-failure recovery passes. Extension packaging
is identical across three timezones: 25,091 bytes, SHA-256
`30ec2568b843869b404700c9fa6cca3d31c7df2843b53cc4d113ab6d3deda0f1`.

The initial 39-case browser run passed before the freshness test was added. The
next run passed all five presence workflows but caught an older invitation test
reloading its read-only page before End Match committed. An isolated diagnostic
passed; the test now explicitly waits for FINISHED before reloading. The final
40-case run passes. All attempts and their scope remain in the evidence index.

The original managed loopback API is running ready at http://127.0.0.1:4000 with
matching served assets. Its compiled-service smoke verifies authenticated public
observations, duplicate sockets, disconnect/reconnect grace, revoked membership,
unchanged revision, timed expiry and fresh rematch settings. All owned smoke
games, temporary schemas and restored databases are removed. Exact original
operator row digests remain unchanged; that database had zero game rows. No new
populated migration/archive qualification is claimed for this schema-free batch.
Installed user browser profiles were not changed; reload 1.9.0 on each player.

The 128-file source/test inventory over preserved uncommitted baseline 1556487
has SHA-256 `52c53af66a17d18618c3a3cc59a7eb1379993a99ab0bd50cdf9fc5a81d31d397`.
See [presence evidence](../evidence/PRESENCE_20261022.json). Delivery finished
before 15:00 Central. Owner acceptance and existing Core reporting remain pending.
Single-process and awake-runtime timing limits remain explicit; no additional
platform, live-site, actual OBS or subjective playtest claim is made.
