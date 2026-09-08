# WikiRace local delivered-use review v1.0

Status: Accepted for stated local intended use, WR-DEC-013 (2026-09-08 UTC). Reviewer: Codex as delegated project owner; no independent or new human review is implied. Authority: the user delegation in `APPROVAL_LEDGER.md`. Product baseline: proposal v1.1. Engineering plan: v1.2. JES: 0.3.0.

## Intended use

Operator-managed local multiplayer Wikipedia bingo on this Mac, using a single Fastify/PostgreSQL backend and Chrome/Chromium extension clients. Includes Normal bingo, Lockout player/team majority or exhausted-board draw, waiting lobby and host lifecycle, recoverable player sessions, read-only spectators, transparent browser-source layout, extension distribution, and native local backup/restore.

## Requirement adjudication

| Requirement | Delivered behavior and evidence | Assessment |
| --- | --- | --- |
| PR-001 | Create/join with named players and 25 distinct objectives; board validation, concurrent 32-player capacity, and actual unmodified generated-board play | Pass |
| PR-002 | Independent Normal progress, atomic first bingo and shared named outcome; two actual extension profiles preserve independent highlights | Pass |
| PR-003 | Exclusive Lockout ownership, frozen team membership, team majority, 13-square rule and explicit 9/8/8 exhausted-board draw | Pass |
| PR-004 | Waiting lobby, host-only start/end, team setup, authenticated leave, host transfer, final departure and migration recovery | Pass |
| PR-005 | Real HTTP/WebSocket synchronization, browser restart, API outage/restart, 30-minute closed-popup run, alarm recovery after worker stop, stale-response isolation | Pass |
| PR-006 | Public spectator API cannot enroll/score; selected Normal progress, team/solo scores, safe name rendering, live updates, transparent overlay, 32-player/mobile visual checks | Pass for browser profile |
| PR-007 | Clean install/build, ready local service, data-preserving start/stop, private archive/checksum, exact-row restore, authenticated restored sessions and actual operator cutover/rollback | Pass |
| PR-008 | JES 0.3.0 registered project/System/Repository/four Subsystems, explicit ownership, proposal/plan/EWP decisions, read-back Draft observations and retained evidence | Pass |

## Evidence profiles

- Deterministic code: 29 unit cases, 24 real PostgreSQL/WebSocket integration cases and eight actual Chromium workflows pass in `.jes/local/ewp-006/clean-*-final` logs. Required cases are not skipped.
- External Wikipedia: actual Science extraction plus wins on unmodified generated Normal/Lockout boards; `.jes/local/ewp-005/live*` result records. Fixture browser tests are a separate profile.
- Idle/runtime recovery: `.jes/local/ewp-005/endurance/1788824160225`, `worker/1788825325626`, and `recovery/1788825210769`. Measured 30-minute duration and deliberate failure mechanisms are recorded.
- Migration and restore: original prototype schema upgrade; exact restored data for three games, five players, one team, 75 squares, 16 visits, three Normal completions and 13 Lockout claims. `.jes/local/ewp-006/backup/1788825914463` and `operator-restore/1788826885309`.
- Default operator path: `.jes/local/ewp-006/operator-browser/1788827299736/result.json`; fresh default extension, real Random article, waiting/start eligibility, full board, read-only watch and synchronized leave passed.
- Sustained repeated-session operation: `.jes/local/ewp-006/sessions/1788825830160/result.json`, 2700.002 seconds and 180 three-player lifecycles. Both modes score correctly, hosts transfer, final departure ends games, zero sockets remain after each cycle and no test games remain. Runner removed its temporary schema.

## Qualification boundaries

The real-site runs are representative samples, not verification of all 10,005 article entries or a guarantee of future Wikipedia availability. The extension trusts authenticated client-supplied article content; it is not competitive anti-cheat attestation. Realtime rooms belong to one API process. Public internet deployment, native Windows, Docker runtime, actual OBS application capture, and independent storage of backups have no passing claim here.

Raw evidence and backups are host-local ignored artifacts; repository records identify their paths and checksums. Private player tokens are not exported to these records. PostgreSQL archives contain session hashes and history and remain private.

## Decision

Accepted by Codex as delegated project owner, WR-DEC-013, after all six EWP exit gates and PR-001 through PR-008 assessments above passed. Qualified implementation checkpoint: `3490cfe0ae6704d8e1fb595dd7c008cbc64eb470`; subsequent closeout changes only update records. The clean-install build and all required tests passed at that checkpoint. Earlier extended runs retain their own checkpoint/profile limits and do not imply every historical run used the final source.

At delivery, the native operator service is ready at http://127.0.0.1:4000, original database selected, all eight migrations applied, test schemas and restore databases removed, and extension 1.1.0 available. Package SHA-256: `51f19009614cfa2ed5b2d143f6d0704cb12f6126ffa2cc03ce321ffa3671d1a9`. Evidence inventory: [QUALIFICATION_INDEX.json](evidence/QUALIFICATION_INDEX.json). JES Project/Repository reconciliation receipts are retained in `.jes/local/coordination`; their readbacks identify the final documentation commit independently of the qualified implementation checkpoint.

No failed implementation checks or open required acceptance gates remain for the stated local profile. Future product decisions and the explicit qualification boundaries above remain separate work.
