# WikiRace ad-free beta launch

Target: extension 1.10.0, one Render web service and one private managed
PostgreSQL database, initially 20–50 invited testers. That is a recruitment
target, not a measured hosted concurrency capacity. Daily challenge is deferred.

This runbook prepares deployment; it does not establish that a Render service
exists, that billing is enabled, or that Chrome has approved the extension.
The prepared local source includes the cumulative multiplayer feature work and
this beta preparation. Render cannot deploy it until the reviewed release
checkpoint is pushed to the selected GitHub branch. No public push is implied
by the local verification records.

## Configuration and costs

`render.yaml` defines the complete initial stack. Connect the GitHub repository
`Jmerc03/wikiRace` and select the branch containing this file. Keep the database
new and separate from the local operator's database. The blueprint uses a paid
Starter web service, paid Basic-256mb PostgreSQL, 5 GB storage, the Ohio region,
one API instance, private-only database ingress, and manual deployments.
No domain purchase is required: Render supplies an HTTPS `onrender.com` address.

Budget approximately **$20–$40/month for the small beta**, with no hard billing
cap implied. Render's published July 2026 example puts the smallest paid app and
database at roughly $13/month before storage/traffic; 5 GB storage adds $1.50 at
the documented $0.30/GB rate. Verify the dashboard's current total before
provisioning. Hobby workspace fees are separate from compute (currently $0);
bandwidth/build overages, taxes, a larger instance or a paid workspace add cost.
Do not enable autoscaling, preview environments, automatic disk growth or extra
services during the initial beta. Check billing daily in the first week, and
pause invitations/review usage if the projection exceeds $40. Application limits
reduce exposure but are not a provider spending cap or DDoS service.

Sources checked October 22, 2026:
[pricing model](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses),
[current compute identifiers](https://render.com/docs/compute-plans),
[blueprint reference](https://render.com/docs/blueprint-spec).

The public support address is **jaxmerc03@gmail.com**, supplied by the owner.
The operator label is **WikiRace**. Both are public in `/privacy` and are set in
the blueprint. No password or private API key belongs in `render.yaml`.

| Setting | Purpose |
| --- | --- |
| `WIKIRACE_DEPLOYMENT=beta` | Activates the beta safeguards and retention |
| `WIKIRACE_EXTENSION_TARGET=beta` | Builds a hosted-only extension with minimal permissions |
| `RENDER_EXTERNAL_URL` | Render supplies the HTTPS origin at build and runtime |
| `WIKIRACE_PUBLIC_ORIGIN` | Optional exact HTTPS origin override; set identically at build/runtime if using a custom domain |
| `DATABASE_URL` | Injected from the managed database; never print or commit it |
| `WIKIRACE_TRUST_PROXY_HOPS=1` | Trust exactly the nearest reverse proxy; verify actual client attribution on Render before inviting testers |
| `WIKIRACE_SUPPORT_EMAIL`, `WIKIRACE_OPERATOR_NAME` | Public privacy contact, required at beta startup |

Build: `npm ci --include=dev`, `npm run prisma:generate`, `npm run build`.
Before starting the service: `npm run prisma:migrate:deploy`.
Start: `node apps/api/dist/server.js`. Readiness: `/ready`; liveness: `/health`.
Deployment configuration is inspectable at `/deployment` without credentials.
No new Prisma migration is introduced by beta prep; all thirteen prior migrations
are applied to the fresh database. Never use `prisma migrate reset` for deployment.

`.github/workflows/verify.yml` prepares a Linux/Node 24.15/PostgreSQL 16 check on
push and pull request: clean installation, schema validation, build, unit/API/
Chromium suites, reproducible packaging and a production dependency audit. It
uses a disposable database and read-only GitHub permissions. Its first hosted CI
run remains pending until the source is pushed; local macOS results do not prove
that GitHub runner execution. Require that check before deploying later updates.

## Beta bounds and privacy

- At most 200 saved games, including finished games and rematches. The limit is
  serialized in PostgreSQL; exact create/join recovery remains possible at capacity.
- At most 32 active players and 64 lifetime memberships per game. Departed members
  cannot be recycled indefinitely to grow a single game's records.
- At most 256 live sockets per API process and 64 per observed client IP. Socket
  frames are limited to 30/minute; the existing 4 KB frame limit remains.
- HTTP limits: 6,000 requests/minute across the process, 600/minute per IP,
  120 writes/minute per IP, and 20 create/rematch requests/hour per IP plus
  100/hour across the process. Failed attempts count. `429` responses include
  `Retry-After`. Shared networks share the IP allowance. These in-memory request
  counters reset on restart; the saved-game cap does not.
- Bodies are bounded at 1 MiB. Slow socket consumers are disconnected after
  1 MiB queues. Health remains available when request limits are reached.
  At most 32 ordinary HTTP requests run concurrently; excess requests receive
  `503` with a five-second retry hint. The beta database pool defaults to five
  connections unless the operator explicitly sets a different URL limit.
- In the beta, only visits earning a new square are stored. Title, URL, player
  attribution and time support scored-article history. Categories and link lists
  are used for scoring and discarded. Unscored/repeated visits do not write rows.
- Finished games become eligible for deletion after 30 days. Startup and hourly
  sweeps delete up to 100 expired games, cascading their associated records.
  Newer rematches survive with their previous-results link cleared. WAITING and
  ACTIVE games are never deleted automatically. End abandoned games explicitly;
  capacity is a reason to inspect usage, not to erase live games.
- Local deployments retain their existing history behavior and have no automatic
  beta cleanup. Do not point a beta-profile process at the local historical DB.
- Session authentication and Normal/Lockout scoring rules are unchanged. Origin
  checks allow this server and Chrome-extension origins; they do not authenticate
  callers. The API is internet accessible even if the extension listing is private.
- Anyone with a game ID/link can read that game's roster/results/scored articles.
  Players should use nicknames. No ads or third-party analytics SDK are included.

## Deployment and qualification sequence

1. Review the source and test evidence, commit/push the exact release branch,
   then create the Render Blueprint from that branch after accepting its displayed
   charges. Keep `numInstances: 1`; do not add horizontal scaling.
2. Verify `/health`, `/ready`, `/deployment` and `/privacy` over the public HTTPS
   URL. Confirm `profile: beta`, the exact public origin, ad-free status and contact.
3. Confirm the PostgreSQL public IP allowlist is empty, the API uses its internal
   connection string, and the paid database's recovery window is available.
4. Verify the reverse-proxy setting using two real external networks. Requests
   from those networks must consume separate client allowances. Injecting a
   forged `X-Forwarded-For` from a client must not choose its own allowance.
   The local proxy fixture is not evidence about Render's actual edge headers.
5. From this checkout, set `WIKIRACE_PUBLIC_ORIGIN` to the real HTTPS origin and
   run `npm run release:beta`. It checks live readiness, beta configuration and
   privacy before emitting `release/beta/wikirace-extension.zip`, checksum,
   store icon and release-check JSON. A placeholder URL fails preflight.
   The locally built ZIP's version and SHA-256 must match the hosted download
   metadata. A mismatched or failed build preserves any previous release candidate.
   Test-only rehearsals under `.jes/local` are not upload candidates.
6. Load that exact beta build on two computers on different networks. Verify
   Normal independent progress, Lockout claims/teams, ready gates, host controls,
   timers, spectator updates, scored history and rematches. Restart a browser and
   the server and recover the same identities. Check actual live Wikipedia
   navigation. Record origin, ZIP checksum, time, browser versions and results.
7. Complete a managed-database recovery rehearsal below. Review the first usage
   metrics. Only then submit the private Chrome beta; see `store/LISTING.md`.
8. After Chrome approves, invite the small group. Check errors, memory, CPU,
   database size, bandwidth and charges before expanding the invitation list.

## Backups, deletion requests and rollback

Paid Render PostgreSQL provides continuous point-in-time recovery; the documented
Hobby window is three days. Confirm it in the actual account. For the rehearsal,
restore into a **new** private database, check migration state and representative
game/player/scoring rows, then test a temporary API against that restored DB.
Do not overwrite the original. Delete the temporary recovery resources only after
the check is recorded, to stop their additional charges.
[Render recovery instructions](https://render.com/docs/postgresql-backups).

Use the dashboard's logical export before significant deployment changes. Treat
exports as sensitive game data, store them privately, and remove them after the
chosen retention period (seven days for this beta's manual downloads). Provider
logical exports remain available for seven days. Do not retain indefinite local
copies while promising deletion. No cloud backup has been tested by local tests.

For an early deletion request, verify the requester’s relationship to the game
through their chosen contact/host context; never ask for a private session token
by email. Inspect affected records and arrange whole-game deletion with the host
where needed because scores link multiple players. Do not claim deletion while
an export or provider recovery window still retains the data. Reapply deletion
requests if a database is restored from an earlier backup.

Deployment can temporarily overlap old/new API processes even with one desired
instance. Realtime rooms/presence are not shared between them. Schedule updates
between play sessions, stop new invitations, and use Render maintenance controls
when appropriate. Do not claim seamless mid-match rolling upgrades. Record the
previous deploy's commit and ZIP checksum; roll back the API code through Render
if the new release fails readiness. Database rollback is a separate restore
decision, never a reset. Store updates are not instantly reversible, so preserve
backward-compatible endpoints and finish network checks before submission.

## Remaining external gates

- Render account/billing and actual deployment.
- Exact release source committed/pushed and hosted build verified.
- Two-network playtest, actual edge-client attribution and managed recovery.
- Chrome developer registration, private tester list, dashboard disclosures,
  submission and store approval.

These are not satisfied by successful local tests or a prepared ZIP. The beta is
for friendly play; client-supplied article facts are not competitive anti-cheat.
