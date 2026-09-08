# WikiRace local delivered-use review v1.1

Status: Draft pending WR-EWP-009 sustained-run results and final owner adjudication. Reviewer: Codex as delegated project owner; no independent or new human review is implied. Authority: the user delegation in `APPROVAL_LEDGER.md`. Product baseline: proposal v1.2. Engineering plan: v1.5. JES: 0.3.0. The [previous accepted review](baselines/DELIVERY_ACCEPTANCE-v1.0.md) remains historical evidence.

## Intended use

Operator-managed local multiplayer Wikipedia bingo on this Mac, using a single Fastify/PostgreSQL backend and Chrome/Chromium extension clients. Includes Normal bingo, Lockout player/team majority or exhausted-board draw, waiting lobby and host lifecycle, recoverable player sessions and uncertain admission, explicit server/game invitations, read-only spectators, transparent browser-source layout, extension distribution, and native local backup/restore. The optional trusted-network API binding has same-host private-interface evidence only.

## Requirement adjudication

| Requirement | Delivered behavior and evidence | Assessment |
| --- | --- | --- |
| PR-001 | Named 25-objective games; exactly-once recovery of keyed admission; explicit server/game invitations with no enrollment on paste or page visit; generated-board real-site play | Pass |
| PR-002 | Independent Normal progress, atomic first bingo, consistent winner; two actual extension profiles plus multi-room assertions | Core and browser checks pass; long-run result pending |
| PR-003 | Exclusive Lockout ownership, frozen teams, 13-square majority and explicit 9/8/8 exhausted-board draw | Core and browser checks pass; long-run result pending |
| PR-004 | Waiting lobby, host-only start/end, team setup, authenticated leave, host transfer, final departure and legacy migration recovery | Pass |
| PR-005 | Durable pending create/join across browser restart, exact original identity after lost committed responses, HTTP/WebSocket recovery, bounded database stalls and restored admission | Focused checks pass; sustained current-build recovery pending |
| PR-006 | Read-only spectator cannot enroll/score; selected Normal progress, team/solo scores, safe names, transparent overlay, full-roster/mobile layouts and invitation clipboard fallback | Pass for Chromium profile |
| PR-007 | Fresh minimum-Node installation, ready native service, nine additive migrations, deterministic extension archive, exact-row restore, explicit binding and original-profile rollback | Pass; final operator readback pending |
| PR-008 | JES 0.3.0 Project/System/Repository/four Subsystems; explicit ownership, proposal/plan/EWP decisions and six captured Draft observations | Final package/acceptance and source reconciliation pending |

## Current implementation evidence

Qualified product-source checkpoint: `f03c4f4502021e7c251292efab241d33ad90e80f`. Later validation/document edits do not change the loaded product source. The long run retains start/end SHA-256 inventories of all API, extension, shared and engine source files.

- Node 24.15: full build, 36 unit cases, 30 actual PostgreSQL/WebSocket integration cases and 11 actual Chromium workflows pass without required skips. Logs: `.jes/local/ewp-009/{build,unit,integration,browser}-02.log`.
- Minimum Node 22.12: official darwin-arm64 archive checksum verified; fresh isolated checkout/install, Prisma generation, full build, 36/30/11 checks and schema validation pass. Installation reports zero dependency findings. Runtime/archive provenance, command logs, artifact inventory and copied browser evidence are under `.jes/local/ewp-009/node22-*`. The extension ZIP and served invitation module match the Node 24 build byte-for-byte.
- Actual Wikipedia on Node 22.12: unmodified generated Normal board wins bingo after five article navigations; Lockout reaches 13 claims after ten navigations. Raw results/screens: `.jes/local/ewp-009/node22-artifacts/ewp-005/live-generated/1788833171919-NORMAL` and `1788833179173-LOCKOUT`. These are separate from synthetic DOM tests.
- Admission: `.jes/local/ewp-007/browser/1788830772299/result.json` records four intentionally lost committed responses, original create/join identities after browser restart, unchanged player counts and revisions. API regressions cover concurrent exact replay, mismatched request/target and departed membership. Pre-fix failures remain retained.
- Invitations/network: `.jes/local/ewp-008/browser/1788831934230/result.json` covers real two-origin extension use, actual ungranted-origin protection, explicit permission refusal, no enrollment on paste/page view and clipboard fallback. `.jes/local/ewp-008/network/1788831730956` proves same-host private-interface HTTP/WebSocket, loopback database binding and original-profile rollback. It does not prove another machine can connect.
- Established database stall: `.jes/local/ewp-009/database-fault/1788832686745/result.json` records readiness 503 in 5008 ms and a failed host action in 5007 ms, unchanged WAITING/revision 0, then same-player retry to ACTIVE/revision 1. The dedicated operator database was not interrupted. Explicit timeout overrides retain their operator-selected behavior.
- Current-schema archive/restore: `.jes/local/ewp-006/backup/1788833661616/result.json` and `.jes/local/ewp-009/admission-backup-01.log` prove exact rows, all five authenticated sessions, all five recovered original admissions, conflicting-request rejection, unchanged restored rows after replay and a successful restored host action. The same case passes on Node 22.12; its result is copied to `.jes/local/ewp-009/node22-artifacts/ewp-006/backup/1788834035689/result.json`, with the exact validation-fixture hash retained in `node22-backup-test-provenance.json`. Only the disposable schemas/databases were removed; source records stayed unchanged.
- Forced-worker recovery: `.jes/local/ewp-005/worker/1788833755275/result.json` records alarm recovery in 60.177 seconds after the current extension worker was forcibly stopped, without an extension-page or content-script wakeup. Identity, origin and live connection were preserved.
- Sustained current-build profiles: the measured 3600-second four-room/64-player/128-WebSocket run and a 2700-second closed-popup Chromium extension/spectator session are active. Each uses its own API/schema and one controlled API restart. Final results and cleanup remain required before acceptance.

The previous review retains historical original-schema migration, managed restore cutover/rollback, default operator browser and 180 three-player lifecycles over 2700.002 seconds. Their original source checkpoints remain explicit; current checks do not rewrite historical evidence.

## Qualification boundaries

The real-site runs are representative samples, not verification of all 10,005 article entries or a guarantee of future Wikipedia availability. The extension trusts authenticated client-supplied article content; it is not competitive anti-cheat attestation. The multi-room test uses real HTTP/WebSockets with synthetic events, not 64 physical users or browsers. Realtime rooms belong to one API process. Same-host interface access does not establish second-machine reachability. Public internet deployment, native Windows, Docker runtime, actual OBS application capture, and independent storage of backups have no passing claim here.

Raw evidence and backups are host-local ignored artifacts; repository inventories record their paths and checksums. Private player tokens are not exported in these review records. PostgreSQL archives contain session hashes and history and remain private. Losing the extension profile can still lose its private recovery key.

## Decision

Pending the active sustained-run results, resource cleanup, final operator readiness and delegated-owner decision. Target extension: 1.3.0. Verified ZIP SHA-256: `a0fbe6da53d73c6f0172bbe20c5b87568cd851def3d31945d9a63ed708594586`. [M6 evidence inventory](evidence/M6_QUALIFICATION_INDEX.json) remains Draft while active artifacts are incomplete. Final JES reconciliation will identify the documentation checkpoint separately from the qualified product source.
