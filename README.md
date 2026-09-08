# WikiRace

Multiplayer Wikipedia bingo with a Chrome extension, live spectators, and an OBS browser view.

Create a lobby, invite friends, choose teams, and race through English Wikipedia. Normal mode awards the first bingo; Lockout awards the first player or team to claim 13 squares, with an explicit draw if the board fills without a majority. The backend keeps progress, ownership, and the final winner synchronized.

## Start locally

Requires Node.js 22.12+ and PostgreSQL tools on PATH, or Docker Desktop for the database.

```bash
npm ci
npm run setup:local
npm run local:start
```

Open [WikiRace](http://127.0.0.1:4000). Download/unzip the extension there, or load `apps/extension/dist` through Chrome’s **Load unpacked** control. The extension’s default server is `http://localhost:4000`.

```bash
npm run local:status
npm run local:backup
npm run local:stop
```

Game data persists in `.local/postgres` with native PostgreSQL. Setup, stop and restart do not reset it. [Setup and recovery](docs/SETUP.md) covers alternative configurations, Docker, browser tests, and migration commands. [Backup and restore](docs/BACKUP_RESTORE.md) covers private archives, restoring to a new database, and verified rollback.

## Play and watch

- **Create Lobby** or join using a game ID. In Lockout, choose teams before the host starts.
- **Start Match**, then browse article pages. Normal progress stays independent; Lockout claims belong permanently to a player or team.
- **Open Full Board** keeps the player board in a browser tab. **Watch / Stream** opens the spectator page.
- Share `/spectate/<game-id>` to watch without an extension. **Copy OBS link** supplies a transparent 1280 × 900 browser-source view.
- **Leave Game** updates membership; the next player inherits host controls. **End Match** stops a match for everyone.

## Verify

```bash
npm run build
npm test
npm run test:integration
npm run browser:install
npm run test:browser
```

Integration and browser tests use a fresh PostgreSQL schema and delete only that schema. The default test database is the dedicated local instance on port 55432. Set `WIKIRACE_TEST_DATABASE_URL` to use another explicit test database.

## Project records

WikiRace is operated under JES 0.3.0. The [project state](project-management/PROJECT_STATE.md), [approved proposal](PROJECT_PROPOSAL.md), [milestone plan](project-management/ENGINEERING_PLAN.md), and [work packages](project-management/work-packages) preserve scope, delegated decisions and actual evidence.

The initial qualified profile is a local Mac service and actual Chromium extension/browser workflows. Public deployment, native Windows, and capture inside OBS itself require their own evidence. See the current project state for live-Wikipedia and endurance results.
