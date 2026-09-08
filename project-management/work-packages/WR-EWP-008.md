# WR-EWP-008 r1 — Explicit invitations and trusted-network operation

Status: In Progress. Phase 1A: VERIFICATION. Owner: Codex. Date: 2026-09-08 UTC.

## Objective and authority

Players can copy/paste a complete invitation and explicitly join the intended server/game. An operator can select a trusted-local-network API binding without exposing PostgreSQL or changing the default loopback profile. Proposal v1.2 PR-001/005/007; plan v1.4 M6; execution approved by delegated-owner WR-DEC-019 under WR-DEC-014.

## Scope and dependencies

Depends on Done WR-EWP-007. API and Extension consume one shared invitation parser; System owns operator binding/configuration and integration tests. Existing owner map remains unchanged. Affected paths: packages/shared, extension popup/background, API static viewer/routes, scripts/local.mjs, contract/setup/docs and tests. Run sequentially in the shared checkout. Blocks M6 delivered-use adjudication.

## Requirements and constraints

Invitations carry only origin/game ID, never private keys. Accept validated IDs or supported links; reject embedded credentials, malformed IDs and unrelated paths/query data. Pasting alone makes no network or membership change. Existing or pending sessions prevent an implicit server switch. Permission refusal or invalid input leaves state unchanged. Invite pages show how to install/join/watch and distinguish local-only addresses; spectator reads remain read-only.

Add an explicit persisted `WIKIRACE_API_HOST=0.0.0.0` option while retaining loopback default/control and loopback database. Reject binding changes while the owned API runs. Surface candidate connection addresses without a cross-machine guarantee. No firewall/router/cloud changes, public hosting, external messages or automatic invites are authorized by this package.

## Validation and done

Shared parser edge cases; API route/private-data checks; actual two-origin Chromium invite-copy/paste/join and existing-session protection; missing/finished invite states; viewer/mobile visual checks. Verify optional network binding on an observed private interface of this Mac and restore the original local profile. This is local-interface evidence, not a second-machine result. Run shared producer and both consumer checks, full build/unit/integration/browser. Document configuration/migration/rollback and retain exact source/evidence. All required checks must pass before Done; product acceptance remains separate.

## Closeout

Pending.
