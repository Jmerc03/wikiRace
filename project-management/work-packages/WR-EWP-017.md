# WR-EWP-017 r1 — Windows home beta preparation

Status: Done for home-hosting preparation. Phase 1A: CLOSEOUT. Issued 2026-10-22.

Authority: Jaxson selected his existing Windows 11 laptop for hosting, confirmed
that he has no domain, and requested useful launch work before 15:15 Central.
This record bounds that direct instruction; no paid purchase, remote access,
public exposure or hardware qualification is implied. Render provisioning is
paused. The existing approved local product and beta scope remain the baseline.

Deliver: a separate password-protected PostgreSQL/API container profile, portable
operator commands for configuration/start/status/stop/backup/restore rehearsal,
an opt-in tunnel configuration, accurate hosting disclosure, and a Windows 11
handoff. Preserve local data, game rules and websocket synchronization. No new
schema, public deployment or game feature is in scope.

Verify: build/unit/integration checks for affected runtime; isolated real Docker
build, database migrations, HTTP/WebSocket operation, persistence and restored
archive checks where available. Windows hardware, actual tunnel/header behavior,
stable domain, two-network play and Chrome review remain external gates. Record
test scope explicitly; Linux containers on this Mac are not Windows evidence.

JES Core is unavailable; repository evidence remains authoritative and Core
reporting pending. Do not fabricate operational approval or execution objects.

## Closeout

Delivered the isolated Compose stack, portable Node operator commands, random
credential initialization, opt-in token-file tunnel, checksummed PostgreSQL
archives, restore into a disposable database, hosting-specific privacy text,
Windows 11 guide and Windows portable-tool CI job. The original local database
and service remain separate. No schema change or new subscription was introduced.

Full build, 58 unit checks, 87 integration tests and 41 Chromium workflows pass.
The final privacy assertions also pass their 10-case targeted suite. Real Linux
ARM64 and AMD64 images build; both API variants reach healthy status and produce
identical extension ZIP checksums for a non-deployed fixture origin. ARM64
rehearsal covers both game modes over HTTP/WebSocket, stop/start with preserved
identities and boards, and a populated archive restored into a separate database
(four games, eight players, thirteen migrations). This is container evidence on
macOS, not native Windows hardware evidence. The tunnel image and token-file
command were checked without connecting a public tunnel.

The first restart harness retained a stale Node HTTP connection and received
ECONNRESET. Its evidence is preserved; a fresh-connection repeat passes without
application changes. The initial sandboxed integration attempt could not reach
the database; the permitted isolated suite passes and removes its schemas.

See `evidence/HOME_BETA_20261022.json` and ignored `.jes/local/ewp-017` for scope
and logs. Windows CI execution is a separate result to record after publishing
the source checkpoint. Native Windows installation, stable domain, real tunnel
client attribution, two-network play, whole-laptop recovery and Chrome review
remain pending. The user has not purchased a domain or paid hosting.
