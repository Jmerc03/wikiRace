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
