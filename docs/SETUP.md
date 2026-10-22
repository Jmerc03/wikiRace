# Setup and operation

For the selected Windows 11 home beta, use [HOME_BETA.md](HOME_BETA.md).
[BETA_LAUNCH.md](BETA_LAUNCH.md) and `render.yaml` retain the alternative Render
deployment. The instructions below describe the existing local profile.
Hosted beta and local developer ZIPs have different permissions and server
configuration; only `npm run release:beta` produces a checked store candidate.

## Local quick start

Use Node.js 22.12 or newer. On macOS, put PostgreSQL tools (`pg_ctl`, `initdb`, `psql`, `createdb`) on PATH. Alternatively, run Docker Desktop and select Docker database mode.

```bash
npm ci
npm run setup:local
npm run local:start
```

Open `http://127.0.0.1:4000`. The setup command initializes a **dedicated** native database only when its data directory is absent, verifies ownership of the selected database port, applies checked-in migrations, generates Prisma, builds the app, and packages the extension. Rerunning it preserves existing games.

Defaults:

| Item | Location |
| --- | --- |
| Operator page / API | `http://127.0.0.1:4000` |
| Native PostgreSQL | `127.0.0.1:55432`, database/user `wikirace` |
| Native data | `.local/postgres` |
| Selected local configuration | `.local/runtime.json` |
| API ownership/PID | `.local/api-owner.json` |
| API/database logs | `.local/api.log`, `.local/postgres-server.log` |
| Built extension | `apps/extension/dist` |
| Extension ZIP/checksum | `apps/api/public/downloads` |

`WIKIRACE_API_PORT` and `WIKIRACE_DB_PORT` can select non-default ports during setup. `WIKIRACE_DATABASE_NAME` selects a restored database while retaining the same API address; its value persists across setup/start. See [Backup and restore](BACKUP_RESTORE.md) for the qualified procedure. Docker database mode uses the port in `compose.local.yml`. These variables do not select or reset unrelated databases. Local trust authentication is restricted to the loopback profile; it is not a public production database configuration.

## Stop and recover

`npm run local:backup` creates an immutable local PostgreSQL archive and checksum manifest. It does not replace the database or schedule future backups.

```bash
npm run local:status
npm run local:stop
npm run local:start
```

Stop the dedicated database too when needed:

```bash
npm run local:stop -- --database
npm run local:start
```

The manager verifies the API instance identity before stopping its recorded PID. Setup rejects database/port changes while that API is running, before creating a database or changing the saved profile. Status reports process ownership, database readiness and whether the running profile matches the saved selection. It refuses to take over an occupied API/database port. Starting the service restarts its stopped database. API and database restart preserve game state and session tokens. No reset command is part of normal setup/recovery.

After source changes, run `npm run build`, then stop/start the managed API to load them. The generated extension must be reloaded through Chrome’s extensions page.

## Extension and play

1. Open the operator page and download/unzip the extension, or use `apps/extension/dist` directly.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the folder containing `manifest.json`.
3. Open WikiRace, enter a name, choose your board setup, and **Create Lobby**. Share the game ID with another player using the same server.
4. In Lockout, create/join teams in the lobby. Every player, including the host, selects **Mark Ready**. When everyone is ready, the host selects **Start Match**.
5. Browse English Wikipedia article pages. **Open Wikipedia** chooses a random starting article. **Open Full Board** keeps the board in a normal browser tab.
6. **Leave Game** updates membership. **End Match** is a host action affecting everyone.

Player rosters show **Online**, **Reconnecting** or **Offline** independently of
Ready. Online means the extension is connected, not that its owner is browsing.
The last socket closing starts a ten-second reconnect grace. Silent failures may
take about fifty seconds to become Offline; your own lost observation shows
**Connection unknown**. Nothing automatically removes or unreadies a disconnected
player. Spectators see individual statuses and team connection counts. Expand
**Player connections** for the full spectator roster.

Updating 1.8.0 to 1.9.0 needs `npm run build`, a managed API restart and reloading
the extension on each player; there is no new migration. An older server stays
playable with unknown indicators. Older extensions do not announce presence and
may appear offline until reloaded. Presence is not stored in database backups;
it is rebuilt from authenticated connections after restart.

**Round timer** is optional: Untimed, 1, 5, 10, 15, 30 or 60 minutes. It starts
with Start Match, stays fixed through reconnects/host transfer, and carries into
rematches with a fresh deadline. On expiry, final scores appear with no winner
unless a bingo or majority already ended play. An offline zero says to reconnect
for confirmation; it does not pretend the server has finished. All clients should
reload 1.9.0 to see the countdown and connection indicators, and the extension blocks timed creation
when a server lacks support, retaining the saved request for retry.

To update 1.7.0 for timers, back up the database, stop the managed API, apply
`npm run prisma:migrate:deploy` with the selected DATABASE_URL, then run
`npm run prisma:generate`, `npm run prisma:validate`, and `npm run build`.
Start the API and reload the extension. Migration
`20261022171500_timed_rounds` adds nullable duration/deadline columns and an index;
existing waiting/active/finished rounds remain untimed, and saved entry recovery
still works. No reset is needed.

**Board mix** selects 0–25 named articles; flexible objectives fill the remaining
squares. **Topic variety** caps named articles per catalog topic at 1, 2, 3, 5 or
unrestricted. **Article difficulty** affects only named articles. All-flexible
boards disable the two unused controls. **Reset board settings** restores Mixed,
15 named / 10 flexible, max 3 per topic. The current catalog supports at most
11 named articles with cap 1 and 22 with cap 2; choose fewer articles or a higher
cap if the popup explains that your combination is unavailable.

Board options load from the selected server. If loading fails, update/restart the
server or check its address, then choose **Reload board options**. Joining an
existing match remains available. Shared settings appear in the lobby, match
details, spectator and invitation; a rematch keeps them on a newly generated
board. Updating from 1.6.0 to 1.7.0 needs only build, managed API restart and
extension reload, with no new database migration.

After play, **Match results** shows the final outcome, duration, and standings.
Select **View article** on a completed square, or expand **Scored articles**, to
inspect the original earning article. Spectators can inspect the followed
player's evidence in Normal or every claim in Lockout.

The finished match's host selects **Open Rematch Lobby**. Others select **Join
Rematch** when it appears automatically. Names/colors/teams carry over as each
player opts in; the board is new and the old results remain available through
**Previous Results**. Everyone starts Not Ready and must ready again. The host should wait for the group before starting because
new rematch opt-ins require a waiting lobby. If a response is lost, **Retry
Rematch** recovers the same identity after a restart. **Stay in Previous Match**
abandons the pending transition locally without undoing a server membership.
If the next round has already started, **Recover Rematch** can restore a place
you already joined; it cannot admit a new player with a team after play starts.

Upgrade to these features with the selected database URL and
`npm run prisma:migrate:deploy`, `npm run prisma:generate`, and `npm run build`.
The additive `20261022154000_match_rematches` and
`20261022162000_lobby_ready_checks` / `20261022163500_host_lobby_controls` migrations preserve existing games and sessions.
Existing waiting players start Not Ready after this upgrade; active and finished
rounds retain their status and results. Restart the managed API and reload the unpacked extension
in Chrome; the new package is version **1.9.0**. All players need the updated extension to
mark Ready in a waiting lobby. Changing teams clears only your readiness;
reconnecting retains it. Departed players do not block the host.

The host can **Lock Joining** or **Reopen Joining** before or during play.
Locked invitations show the restriction; existing players can reconnect. A
waiting lobby also shows **Remove** beside other players, with confirmation.
Removed sessions are revoked and shown in the roster; they can use **Forget Local
Session** to leave that local identity. Removal is not a ban on a fresh identity:
lock joining to prevent new arrivals. The host cannot remove players during play.
Locks survive host transfer and restart; a fresh rematch starts open.

The extension retains identity and progress across browser restarts and server outages. If creating or joining loses its response, **Retry Lobby Entry** recovers the same player with the original request. Pending entry survives browser restarts and blocks changing games or servers. **Forget Pending Entry** deliberately discards its recovery key; a player already created on the server may remain in that lobby. Current extensions check server support before creating a player; update/restart an older server before retrying. Reconnect is automatic; **Refresh Board** forces a fetch. A temporary failure preserves credentials and the last known board. **Forget Local Session** explicitly abandons credentials when a session is unavailable; it does not notify an unreachable server. Server preferences survive leaving/forgetting.

To change the backend, leave the current game and use **Server settings**. Enter an HTTP(S) origin without a path or credentials and select **Save Server**. Chrome requests access to that exact origin. The default is `http://localhost:4000`. English Wikipedia and loopback hosts are declared permissions; other hosts use optional permissions. All players need network access to the same chosen backend. Public hosting and TLS termination are operator deployment decisions outside the local evidence profile.

## Invitations and a trusted local network

Select **Copy Invitation** in the extension. A player can paste that complete link into **Join Game**; it identifies both the server and game. A bare game ID uses the currently selected server. Joining remains an explicit click, and Chrome requests access if the new server needs permission. Opening an invitation page shows installation/join instructions and never enrolls a player. Existing or pending sessions must be resolved before selecting another server.

The default loopback address works only on the host computer. To make the API available on a trusted local network, stop the managed API and deliberately select network binding:

```bash
npm run local:stop
WIKIRACE_API_HOST=0.0.0.0 npm run setup:local
npm run local:start
npm run local:status
```

Status lists private IPv4 address candidates observed on the host, for example `http://192.168.x.x:4000`. Use a reachable candidate in each extension’s Server settings before creating/joining. Then copied invitations use that selected network address. The candidate list is not proof that another computer can reach the host; both computers need network access to it. This does not configure firewalls, routers, TLS or public hosting. PostgreSQL stays on loopback.

Return to the default local binding with:

```bash
npm run local:stop
WIKIRACE_API_HOST=127.0.0.1 npm run setup:local
npm run local:start
```

Binding changes while the managed API is running are rejected before changing the saved profile. `node scripts/verify-network.mjs` qualifies this Mac’s private interface using a new temporary database and port, verifies HTTP/WebSocket operation and loopback database binding, then restores the original profile and removes its temporary database. It briefly stops the managed API and must run alone, without other operator restart/restore checks. It does not establish second-machine or public-network qualification.

## Spectators and OBS

Open `/spectate/<game-id>` or select **Watch / Stream** in the extension. Spectators do not become players. Normal mode can follow any player's progress; Lockout shows exclusive ownership and team/player totals.

Select **Copy OBS link**, add a Browser Source in OBS, and paste the URL. Use width 1280 and height 900. `/overlay/<game-id>` has a transparent page background and hides interaction controls. An optional `?playerId=<id>` selects Normal progress. Large overlay rosters use compact names; hover to see the full name. If historical ownership exceeds 32 entries, the overlay shows 32 scores including the followed player and labels that limit; the spectator page retains the full roster. Browser rendering/transparency is tested; actual capture inside OBS is a separate operator check.

## Development and migrations

Build all workspaces and package the extension:

```bash
npm run build
npm test
```

Individual commands build required shared dependencies:

```bash
npm run build:api
npm run build:extension
npm run build:game-engine
npm run --workspace=extension typecheck
```

For foreground development, set `DATABASE_URL` explicitly or use the selected `.local/runtime.json` profile, then run `npm run dev:api`. Without a local profile, the API loads `apps/api/.env`. `.env.example` documents the default local settings; existing `.env` files are not overwritten by setup.

Prisma commands use the supplied `DATABASE_URL` or API environment file. For the default local database, a POSIX example is:

```bash
export DATABASE_URL=postgresql://wikirace@127.0.0.1:55432/wikirace
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate:deploy
```

PowerShell sets the same value with `$env:DATABASE_URL = 'postgresql://wikirace@127.0.0.1:55432/wikirace'`.

To author a new migration, use `npm run prisma:migrate:dev -- --name migration_name`. Apply checked-in migrations with `prisma:migrate:deploy`; do not use a database reset for normal upgrades.

The September 7 additive migration preserves existing games, players, visits and claims, and adds session hashes and stable host/winner fields. Legacy player records cannot recover private tokens from public IDs: explicitly join a new session. The follow-up recovery migration retires tokenless memberships, preserves all historical visits/claims, and leaves unfinished games resumable: the first authenticated join becomes host when no usable host remains. An old finished game without stored winner evidence displays that limitation explicitly. Apply these and the nullable `20260908011800_recoverable_admission` metadata migration with the deploy command above. This adds recoverable-entry request binding while preserving existing hashes and records. Historical records remain available. Prisma CLI stays at 6.19.3; the root development dependency ensures npm applies the reviewed `deepmerge-ts` security override across workspace links. See [dependency review](DEPENDENCIES.md).

## Automated evidence

```bash
npm test
npm run test:integration
npm run browser:install
npm run test:browser
npm run test:live
npm run test:live:generated
npm run test:upgrade
npm run test:worker
npm run test:package
npm run test:endurance
```

Each integration/browser run creates a random `wr_test_*` PostgreSQL schema, applies migrations, executes actual HTTP/WebSocket/browser work, and removes only that schema. Set `WIKIRACE_TEST_DATABASE_URL` to use an explicitly chosen test database; default is the dedicated local instance. A missing database fails the suite rather than skipping it. Files run sequentially so one server's expiry worker cannot act on another file's deadline fixtures; explicit multiplayer race tests still exercise concurrent requests.

Chromium binaries live under ignored `.local/browsers`. The deterministic browser suite loads actual extension profiles and uses synthetic Wikipedia article DOM. It verifies two-player Normal isolation, Lockout teams/majority, saved-profile resume, API stop/restart, live spectators, safe name rendering and overlay transparency. It does not assert live Wikipedia availability by itself.

`test:worker` forcibly stops the isolated extension service worker and verifies alarm-driven recovery with no popup or content-script wakeup. `test:package` verifies identical ZIP hashes across three time zones.

`test:live` contacts real Wikipedia without response substitution. `test:live:generated` wins unmodified randomly generated Normal and Lockout boards via real article navigation; external site availability can cause a failure independent of the local service. `test:upgrade` uses native `psql` to exercise the original prototype schema and current migrations in a separate disposable schema. `test:endurance` defaults to five minutes; set `WIKIRACE_ENDURANCE_SECONDS` from 90 through 3600 for a bounded longer run. It closes the extension popup, keeps a spectator open, sends modest periodic local events, restarts its test API once, and verifies preserved identity and consistent state. The upgrade and endurance profiles leave the operator API/database running.

`node scripts/verify-local.mjs` exercises idempotent managed start/stop, a full API/database restart, preserved sessions/boards, and restores the original game count. It stops only the dedicated local stack; do not run it concurrently with other WikiRace tests or active play.

## Docker alternative

The new local composition uses a separate project/volume from the old `docker-compose.yml`, preserving any older volume.

Database-only setup through the manager:

```bash
WIKIRACE_DB_MODE=docker npm run setup:local
npm run local:start
```

In PowerShell use `$env:WIKIRACE_DB_MODE = 'docker'` before setup. A complete optional container composition is:

```bash
docker compose -f compose.local.yml up --build -d
docker compose -f compose.local.yml stop
```

Do not run the managed native API and container API on port 4000 at the same time. Do not add `-v` when stopping: that deletes database volumes. Docker/native Windows commands are provided as implementation paths; current host qualification is recorded separately in project state. The empty Kubernetes files remain historical placeholders, not a deployable production system.

## JES

The project uses JES 0.3.0 with one repository/System and four explicit Subsystem owners. Planning, exact package decisions and closeouts are repository-owned in `project-management`; local Core has the registered project/owner graph. Reports/receipts and test logs live in ignored `.jes/local` and `.jes/reports`. No synthetic Execution or human Approval objects are created for this manually initiated Codex task.

## Database response deadlines

The API applies Prisma v6 PostgreSQL defaults of 3 seconds for connection establishment, 5 seconds for pool acquisition, and 5 seconds for an individual query response. These prevent an established but unresponsive connection from leaving readiness indefinitely pending. Explicit `connect_timeout`, `pool_timeout` or `socket_timeout` values in `DATABASE_URL` take precedence; zero can disable the corresponding timeout and is outside the bounded-default claim. Other URL options and the chosen schema remain intact. Invalid timeout values fail startup without echoing connection credentials.

The isolated fault qualification pauses the database response path, verifies process liveness, a 503 readiness response in approximately five seconds, rollback of an interrupted host action, and successful same-identity retry after restoring traffic. It does not stop the operator database. Reference: [Prisma v6 PostgreSQL connection options](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql).
