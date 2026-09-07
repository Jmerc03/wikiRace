# Technical debt and qualification limits

Updated 2026-09-07. Normal bingo and Lockout 13-square majority remain separate rules.

## Resolved in WR-EWP-002 through WR-EWP-004

- Player ID impersonation: opaque bearer sessions, hash-only persistence, explicit public serializers.
- Partial game writes and inconsistent winners: per-game row locks, atomic transactions, stored outcome and post-commit invalidation.
- Cross-player Normal progress: clients refetch their own authenticated state.
- Invalid board sizes: exact 25-square validation and distinct objective generation.
- Duplicated wire shapes: shared response contracts and one state serializer.
- Hard-coded origin: extension settings with requested host permission and persistent selection.
- Shell-only extension build: portable Node/esbuild packaging.
- Unprotected database behavior: isolated PostgreSQL integration, actual WebSocket, browser and restart tests.
- Known dependency advisories: compatible updates and a reviewed transitive override; clean installation reports zero findings. See [DEPENDENCIES.md](DEPENDENCIES.md).

## Retained boundaries

- **Single-process realtime:** rooms are in memory. Multiple API instances require shared pub/sub; no horizontal deployment claim.
- **Client-trusted article content:** sessions protect identity, but an authenticated custom client can fabricate Wikipedia visits. This is a friends/local game, not verified competitive anti-cheat.
- **Local operator deployment:** loopback defaults and a dedicated local database are qualified. Docker instructions are supplied but Docker execution, native Windows and public internet deployment are not yet qualified.
- **Legacy data:** additive migrations preserve historical records. Old sessions have no recoverable token; unusable memberships are retired and users explicitly join again. An empty host slot transfers to the first authenticated new join. Finished legacy games without stored winner metadata explicitly report an unknown historical result.
- **Platform-dependent browser capture:** transparent stream layout is exercised in Chromium. Actual OBS application capture is a separate profile.
- **Future infrastructure:** `infra/k8s` files remain placeholders, not deployable manifests.
- **Operational scope:** no accounts, centralized session recovery, match retention policy, public abuse/rate-limiting infrastructure or managed backups. A lost extension profile loses its private session token; retained game history remains readable.

Live Wikipedia and longer realtime lifetimes are additional qualification profiles, separate from deterministic DOM fixture evidence. See current package records for results.
