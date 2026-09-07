# Setup

## Requirements

- Node.js
- PostgreSQL
- Chrome

---

## Install

From repository root:

```bash
npm install
```

---

## Run API

```bash
npm run dev:api
```

Build:

```bash
npm run build:api
```

The root API and game-engine commands build their workspace dependencies first.

---

## Prisma

Generate client:

```bash
npm run prisma:generate
```

Validate schema:

```bash
npm run prisma:validate
```

Create migration:

```bash
npm run prisma:migrate:dev -- --name migration_name
```

Apply checked-in migrations without resetting data:

```bash
npm run prisma:migrate:deploy
```

The September 7 match-integrity migration adds private session hashes, host and
winner fields, and indexes. Existing records remain intact. Legacy players have
no recoverable private token: explicitly join again to obtain a new identity;
public player IDs cannot be used to recover credentials. Set `DATABASE_URL` to
the intended database before applying migrations.

Open Prisma Studio:

```bash
npm run prisma:studio
```

---

## Extension

Build:

```bash
npm run build:extension
```

Type-check without rebuilding:

```bash
npm run --workspace=extension typecheck
```

Reload extension:

- Open chrome://extensions
- Enable Developer Mode
- Load `apps/extension/dist` if the extension is not installed
- Click Reload

Open the extension, enter a player name, and **Create Lobby**. Share the game ID
with another player using the same server. In Lockout, create/join teams while
waiting. The host selects **Start Match**. Browse English Wikipedia articles to
score; **Open Full Board** keeps the board in a normal browser tab. **Leave Game**
updates membership, while **End Match** is a host action affecting everyone.

The extension retains game identity across restart and server outages. Refresh
after restoring the server. **Forget Local Session** explicitly abandons local
credentials when a session is unavailable; it does not tell an unreachable
server that the player left. Server preferences survive either leave action.

To connect to another backend, leave the current game, open **Server settings**,
enter its HTTP(S) origin, and select **Save Server**. Chrome asks for access to
that specific origin. The default local origin is `http://localhost:4000`.
Wikipedia access and loopback hosts are declared permissions; remote hosts are
optional permissions requested through this user action.

---

## Game Engine

Build:

```bash
npm run build:game-engine
```

---

## Tests

Run all tests:

```bash
npm test
```

Run one test suite:

```bash
npm run test:game-engine
npm run test:api
```

Install isolated Chromium tooling and run actual extension tests:

```bash
npm run browser:install
npm run test:browser
```

These tests use real installed extension profiles, PostgreSQL, HTTP and
WebSockets, with deterministic Wikipedia DOM fixtures. Browser profile and API
restart are exercised. Fixture navigation is not a claim of live Wikipedia
availability. Chromium binaries live in ignored `.local/browsers`; test database
isolation is the same as the API integration runner.

Database-backed tests run with `npm run test:integration`. They create a unique
`wr_test_*` schema, apply checked-in migrations, exercise actual API and
WebSocket behavior, then remove only that schema. Set
`WIKIRACE_TEST_DATABASE_URL` to an explicitly chosen test PostgreSQL database;
the default is `postgresql://wikirace@127.0.0.1:55432/wikirace`.

JES 0.3.0 project state and approved milestone/package records are in
`project-management/PROJECT_STATE.md`. Local request/receipt and baseline logs
are retained under `.jes/local` and are not committed as source.

---

## Useful Commands

Build everything:

```bash
npm run build
```

Run API only:

```bash
npm run dev:api
```

Run extension build:

```bash
npm run build:extension
```

Build an individual workspace:

```bash
npm run build:shared
npm run build:game-engine
npm run build:api
```
