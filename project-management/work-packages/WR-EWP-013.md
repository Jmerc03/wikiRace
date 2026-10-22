# WR-EWP-013 r1 — Custom board setup

Status: Done. Phase 1A: CLOSEOUT. Issued 2026-10-22 after the user selected
"Custom board setup: article/objective mix and topic variety (recommended)".
Identifier assigned afterward; execution follows that scoped instruction, with
no unseen-document or general product approval implied.

## Scope and behavior

Choose 0–25 named articles, with the remaining squares filled by flexible title,
category and link-count objectives. Choose a per-topic article cap of 1, 2, 3, 5
or 25. Retain default Mixed / 15 named / 10 flexible / cap 3. Explain that
article difficulty and topic caps apply only to named articles. The API exposes
catalog-derived capacity per difficulty and cap; the popup explains unavailable
combinations and blocks creation until valid. Server validation stays authoritative.
Do not silently adjust selections or generate partial boards.

Show the persisted configuration in the lobby, match details, spectator and
invitation. Rematches retain the same configuration and receive fresh boards.
Pending admission recovery retains the exact original body. Keep Normal and
Lockout scoring, readiness, host controls, teams, identity and synchronization.
No in-lobby board replacement, category filtering, daily challenge, timed rounds
or custom article entry. No database schema change is needed. Package as 1.7.0.
Restore the accidentally overwritten architecture documentation while preserving
its original content and legitimate feature additions.

## Verification and delivery

Build all workspaces and run unit, PostgreSQL/HTTP/WebSocket integration and actual
Chromium suites. Exhaustively exercise the offered mix/difficulty/topic matrix,
including rejected combinations, uniqueness, topic caps and article difficulty.
Cover saved configuration, old defaults, rematches, remote server selection,
failed capability loading, pending-entry restart and shared read-only summaries.
Review desktop and compact popup screenshots. Preserve previous package evidence.
Restart the selected operator service with the verified build, verify served
assets and clean up owned test data. No destructive reset or profile changes.
Stop before 15:00 America/Chicago on 2026-10-22. Core reporting remains pending
under the existing outage; local execution records are authoritative and owner
acceptance remains separate.

## Closeout — 2026-10-22

Extension 1.7.0 provides named/flexible mix, topic variety, reset-to-defaults,
server-derived validation and shared lobby/match/spectator/invitation summaries.
Custom settings survive pending-create recovery, browser restart and fresh
rematches. Unavailable options block creation with retry; joining still works.
Late options from a previously selected server cannot replace current options.
The all-flexible case clearly disables settings that have no effect.

The workspace build and 43 unit tests pass. The generator test exhaustively
checks all 1,950 count/difficulty/cap combinations: 1,899 produce 25 distinct,
eligible squares within the topic cap; 51 impossible combinations reject
explicitly. All 59 PostgreSQL/HTTP/WebSocket integration cases and 30 actual
Chromium workflows pass. Compact setup/lobby and spectator screenshots were
visually reviewed; the compact popup has no horizontal overflow.

Actual pg_dump/pg_restore preserves custom configurations, four rounds, eight
player records, seven authenticating sessions, two rematch recoveries, readiness,
locks, revoked membership and scoring evidence. Three-timezone ZIP reproduction
passes. No schema change or new migration is needed; the existing twelve remain.

Initial integration attempts found global-count assertions racing with other
fixture files. They now count only their own records. The final browser expansion
found older checks relying on transient copy text and an arbitrary visit; they
now verify the actual clipboard and the earning-event relation with an advanced
fixture revision. Retained failed logs and the earlier 29/29 browser pass are
listed in the evidence index. No failed attempt is erased or presented as passing.

The architecture document's accidental replacement by contract text was repaired
from its original content, preserving all legitimate feature additions. Current
rules, setup, contract, roadmap and delivery review describe the selected scope.

The original managed loopback service is running ready at
http://127.0.0.1:4000. Served assets and ZIP match the verified build. Its compiled
API passed custom-capacity, rejected-invalid-create, valid-create, host controls
and same-settings fresh-rematch smoke checks. All owned temporary games, schemas
and restored databases are removed. Exact operator row digests are unchanged;
that database had no game rows, so populated retention is established separately
by the archive fixture. Installed user browser profiles were not changed.
Reload the extension to use 1.7.0.

The 117-file source/test inventory over the preserved uncommitted baseline
1556487 has SHA-256 `b2a51961a8f5125b0ba10354b841ea29cbb104cadadffab8bac0d4fb41fd9560`.
See [custom-board evidence](../evidence/CUSTOM_BOARD_20261022.json). This delivery
completed before 15:00 Central; owner acceptance remains separately pending.
Existing Core reporting remains pending. No new platform or subjective playtest
qualification is implied.
