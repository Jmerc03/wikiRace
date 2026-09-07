# Roadmap

## Completed

### Core Gameplay

- Create game
- Join game
- Multiplayer support
- Normal mode
- Lockout mode

### Realtime

- WebSocket synchronization
- Live board updates

### Players

- Player names
- Persistent player state
- Player colors

### Teams

- Team creation
- Team joining
- Team leaving
- Team colors
- Team ownership
- Team-aware win detection
- Owner-aware Lockout winner display
- Team roster API support
- Team roster cards
- Current team display

### Repository Stabilization

- Standardized root and workspace build scripts
- Initial win-checker and Lockout ownership tests
- Pure response-shaping helpers

---

## In Progress

### Stabilization

- Add database-backed route characterization tests
- Document and prioritize deferred architectural work
- Track remaining work in [TECH_DEBT.md](TECH_DEBT.md)

---

## Next

### Game Management

- Leave game
- Host controls
- Better lobby experience

### Spectators

- Spectator mode
- Read-only game view

### Overlay

- Browser source overlay
- Streamer-friendly layout
- OBS integration

Spectator and overlay work remain deferred until the stabilization items above
are complete.

---

## Future

### Social

- Public lobbies
- Matchmaking
- Friends

### Gameplay

- Daily boards
- Speedrun mode
- Team tournaments
- Draft mode

### Advanced

- Ranking system
- Statistics
- Match history
- AI-generated boards
