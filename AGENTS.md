# Agent Instructions

Before making changes:

1. Read docs/ARCHITECTURE.md
2. Read docs/GAME_RULES.md
3. Read docs/ROADMAP.md
4. Read docs/SETUP.md

## Development Principles

- Make focused edits.
- Prefer modifying existing code over rewrites.
- Explain major architectural changes before implementing them.
- Do not change Prisma schema without providing migration commands.
- Keep Normal and Lockout game logic separate.
- Preserve websocket functionality unless explicitly requested.
- Preserve multiplayer synchronization.
- Prefer small commits and incremental progress.

## Build Reminders

After API changes:

```bash
npm run --workspace=api build
```

After extension changes:

```bash
cd apps/extension
rm -rf dist
npx tsc
cp public/manifest.json dist/
cp src/popup.html dist/
```

## Current Project State

Implemented:

- Multiplayer games
- WebSocket synchronization
- Normal mode
- Lockout mode
- Player names
- Player colors
- Team creation
- Team joining
- Team colors
- Team-aware ownership
- Team-aware win detection
- Team roster support

Current milestone:

See docs/ROADMAP.md
