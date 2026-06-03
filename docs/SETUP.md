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
npm run --workspace=api dev
```

Build:

```bash
npm run --workspace=api build
```

---

## Prisma

Generate client:

```bash
cd apps/api
npx prisma generate
```

Create migration:

```bash
npx prisma migrate dev --name migration_name
```

Open Prisma Studio:

```bash
npx prisma studio
```

---

## Extension

Build:

```bash
cd apps/extension

rm -rf dist

npx tsc

cp public/manifest.json dist/

cp src/popup.html dist/
```

Reload extension:

- Open chrome://extensions
- Enable Developer Mode
- Click Reload

---

## Game Engine

Build:

```bash
npm run --workspace=@bingo/game-engine build
```

---

## Useful Commands

Build everything:

```bash
npm run build
```

Run API only:

```bash
npm run --workspace=api dev
```

Run extension build:

```bash
cd apps/extension && npx tsc
```
