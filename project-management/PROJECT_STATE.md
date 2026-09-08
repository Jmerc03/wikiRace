# WikiRace project state

Updated: 2026-09-08 UTC (September 7 local). Operator: Codex under Jaxson Mercer's explicit delegation.

- Product baseline: PROJECT_PROPOSAL.md v1.1, Approved (WR-DEC-009; original WR-DEC-001).
- Engineering plan: ENGINEERING_PLAN.md v1.2, Accepted (WR-DEC-010; prior WR-DEC-009/002).
- JES: installed plugin 0.3.0; local Core healthy, `0009_monorepo_authority`; Project `JES-PROJECT-WIKIRACE`, System `JES-SYSTEM-WIKIRACE`, Repository `JES-REPO-WIKIRACE`, four Subsystems registered and read back through API.
- Metadata: `jes-repository.v2`; exact ownership review in `.jes/OWNERSHIP.md`; registration requests/receipts in `.jes/local/registration`.
- Standards: POS v0.3.0-dev and EO v0.3-dev working standards, each with v0.2 latest release. JES's 0.3.0 does not imply a POS/EO release.
- Intake source: HEAD `7c164a4` with inherited dirty edits. Retained exact tracked diff and untracked source snapshot in `.jes/local/baseline`.
- M1 / WR-EWP-001: Done; 23 original unit tests and six database/WebSocket characterization cases passed.
- M2 / WR-EWP-002: Done; 26 unit and 13 database/WebSocket cases passed; atomic mutations, protected sessions, and stored winners.
- M3 / WR-EWP-003: Done at commit `e46440f`; 28 unit tests, 18 integration cases and two actual Chromium extension workflows passed. Normal isolation, team Lockout majority, browser restart, API outage/restart, and leave synchronization verified.
- M4 / WR-EWP-004: Done; 28 unit, 20 integration and four Chromium workflows, clean install, zero dependency findings, actual native API/database restart with data/session preservation.
- WR-EWP-005 r2: Done (WR-DEC-011). Live Wikipedia/generated-board wins, 30-minute idle/restart run, forced-worker alarm recovery, delayed-response isolation, legacy host recovery, explicit draws, 23 integration cases and eight browser workflows passed.
- Current: WR-EWP-006 operator recovery and final delivered-use adjudication. Backup/restore exact rows plus five authenticated sessions, actual managed cutover/rollback, and rejection of profile changes while running passed. The original API is running/ready with a matching profile. Repeated-session cleanup qualification is active. Repository-only execution records are authoritative; no synthetic Core Execution or Approval objects.
- Local database: dedicated PostgreSQL on `127.0.0.1:55432`, database/user `wikirace`, data in `.local/postgres`. Pre-existing databases outside this dedicated profile were untouched; no database reset was used. Integration runs remove only their random schemas, and restore qualification removes only its newly created temporary databases.
- Qualification limit: deterministic fixtures and real Wikipedia navigation have separate passing Chromium evidence with actual HTTP/WebSockets/PostgreSQL. Native Windows, OBS application capture, and public deployment remain unqualified. Spectator and native local startup/recovery have separate passing M4 evidence.
- Cutoff: 2026-09-08 01:00 UTC unless corrected by the user. Continue bounded implementation and verification until that point.

Repository records remain authoritative for delegated approvals and actual work. No Core Execution records or human-attributed approvals are fabricated to represent this manually initiated Codex task.
