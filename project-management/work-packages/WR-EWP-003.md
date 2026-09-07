# WR-EWP-003 r1 — Complete player lifecycle and resilient extension

Status: In Progress. Phase 1A: EXECUTION. Owner: Codex. Date: 2026-09-07.

## Objective and traceability

Enable players to create a waiting lobby, join/configure teams, start a match, play, recover interruptions, and leave through understandable controls. Implements PR-004/005/007 under proposal v1.0 and plan M3. [Game Contract v1.0](../../docs/GAME_CONTRACT.md) is the accepted cross-component specification.

## Requirements and affected artifacts

API lifecycle: waiting creation; authenticated host start/end; team membership only before play; retained departed player/claim history; deterministic host transfer; last-player leave ends the match. All mutations use M2 transactions. Realtime room validation and heartbeat/reconnect behavior remain compatible with spectator clients.

Extension: complete lobby/player UI; explicit leave and host controls; display the named global winner; persist session and configured backend origin; permission-scoped backend configuration; bounded requests, clear errors, retry/reconnect, no clearing identity on transient errors; stale async responses cannot change a newer session. Current-tab scoring only after start and valid Wikipedia articles. Portable build, shared response types, and a real or accurately limited browser test path.

Affected: apps/api, apps/extension, packages/shared, build/browser test scripts, setup/rules/architecture. Preserve existing UI features and Normal/Lockout distinction. No public deployment or account system.

## Dependencies, ownership and validation

Depends on Done WR-EWP-002; blocks M4. Codex owns software implementation/testing. Browser framework/Chromium availability is a test prerequisite to resolve early; a simulated extension API alone cannot prove an installed extension. No physical tests required.

Run full build/unit tests, database integration tests for every lifecycle transition and unauthorized action, extension state/recovery tests, and actual Chromium extension loading/navigation where available. Exercise at least two player identities and websocket updates, restart/resume, and invalid backend behavior. Documentation must show setup and known limits.

## Approval and done

WR-DEC-005 approves exact r1 under the user's delegated authority, 2026-09-07. Done requires the described workflow and available tests to pass; any missing required browser evidence remains explicitly open. No product acceptance claim at this internal package closeout.

## Closeout

Pending.
