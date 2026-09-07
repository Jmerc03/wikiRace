# WikiRace project state

Updated: 2026-09-07. Operator: Codex under Jaxson Mercer's explicit delegation.

- Product baseline: PROJECT_PROPOSAL.md v1.0, Approved (WR-DEC-001).
- Engineering plan: ENGINEERING_PLAN.md v1.0, Accepted (WR-DEC-002).
- JES: installed plugin 0.3.0; local Core healthy, `0009_monorepo_authority`; Project `JES-PROJECT-WIKIRACE`, System `JES-SYSTEM-WIKIRACE`, Repository `JES-REPO-WIKIRACE`, four Subsystems registered and read back through API.
- Metadata: `jes-repository.v2`; exact ownership review in `.jes/OWNERSHIP.md`; registration requests/receipts in `.jes/local/registration`.
- Standards: POS v0.3.0-dev and EO v0.3-dev working standards, each with v0.2 latest release. JES's 0.3.0 does not imply a POS/EO release.
- Intake source: HEAD `7c164a4` with inherited dirty edits. Retained exact tracked diff and untracked source snapshot in `.jes/local/baseline`.
- M1 / WR-EWP-001: Done; 23 original unit tests and six database/WebSocket characterization cases passed.
- M2 / WR-EWP-002: Done; 26 unit and 13 database/WebSocket cases passed; atomic mutations, protected sessions, and stored winners.
- M3 / WR-EWP-003: Done at commit `e46440f`; 28 unit tests, 18 integration cases and two actual Chromium extension workflows passed. Normal isolation, team Lockout majority, browser restart, API outage/restart, and leave synchronization verified.
- M4 / WR-EWP-004: Done; 28 unit, 20 integration and four Chromium workflows, clean install, zero dependency findings, actual native API/database restart with data/session preservation.
- Current: WR-EWP-005 live Wikipedia, endurance and upgrade edge-case qualification. Repository-only execution records are authoritative; no synthetic Core Execution or Approval objects.
- Local database: dedicated PostgreSQL on `127.0.0.1:55432`, database/user `wikirace`, data in `.local/postgres`. Existing databases were not reset or modified. Each integration run creates and removes only its random `wr_test_*` schema.
- Qualification limit: actual Chromium extension profiles use synthetic Wikipedia DOM fixtures with real HTTP/WebSockets/PostgreSQL. Live Wikipedia availability, native Windows, OBS application capture, and public deployment are not implied. Spectator and native local startup/recovery have separate passing M4 evidence.
- Cutoff: 2026-09-08 01:00 UTC unless corrected by the user. Continue bounded implementation and verification until that point.

Repository records remain authoritative for delegated approvals and actual work. No Core Execution records or human-attributed approvals are fabricated to represent this manually initiated Codex task.
