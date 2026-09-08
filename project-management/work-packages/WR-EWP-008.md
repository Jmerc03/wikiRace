# WR-EWP-008 r1 — Explicit invitations and trusted-network operation

Status: Done. Phase 1A: CLOSEOUT. Owner: Codex. Date: 2026-09-08 UTC.

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

Accepted by delegated-owner WR-DEC-021, 2026-09-08 UTC. Implementation source: `e301c9728e3da6ff502fdf87352dd120c87c4c48`.

- `.jes/local/ewp-008/unit-02.log`: 33 unit cases passed, including four shared invitation tests and both API/extension consumers. `integration-02.log`: 30 PostgreSQL/WebSocket cases passed. `browser-04.log`: 11 actual Chromium workflows passed, including explicit two-origin join, actual ungranted-origin rejection, injected permission refusal, no enrollment on paste/web read, existing-session protection, missing/finished invitations and clipboard fallback. Required cases were not skipped.
- `browser/1788831717947` retains inspected desktop/mobile invitation views; the final browser run also captures the improved full-width mobile input. Initial browser attempts exposed test-only clipboard-read permission and hidden-heading selector issues, plus a transpiled helper in injected clipboard code; their logs are retained rather than represented as product failures.
- `network/1788831730956/result.json` and `checks.json`: managed API bound explicitly to 0.0.0.0 on a new port/database, actual HTTP and WebSocket operation through this Mac’s private IPv4 interface, PostgreSQL listen_addresses remained 127.0.0.1, running binding change was rejected, original game count/profile restored and temporary database removed. The delivered service remains loopback/ready.
- Full build and deterministic extension 1.3.0 package verification passed. Shared parsing is served to web clients and bundled into the extension; private admission/session keys never enter invitation URLs.

Same-host private-interface evidence does not prove another machine, firewall path or public service. Native Windows, Docker and actual OBS remain separate profiles. Documentation provides explicit opt-in/rollback commands. M6 acceptance waits for WR-EWP-009 operational qualification.
