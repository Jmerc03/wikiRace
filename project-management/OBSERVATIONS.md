# WikiRace observations

Captured 2026-09-07 during WR-EWP-005 VERIFICATION. Author: Codex under the user’s owner/operator delegation. These are Draft observations; recommendations are unaccepted and do not create an improvement proposal, policy, or engineering approval. Product decisions have separate ledger records.

## WR-OBS-2026-001

- Source: WR-EWP-005, revision `b08e0edcff3895e55f9e4c1c5df1e168ed326891`.
- Category: prototype_session_recovery.
- Route: project_local_engineering; this is the narrowest scope supported by the facts.
- JES Draft ID: `JES-OBS-MANUAL-20260907-WR-LEGACY`.
- Fact: Prototype player records had no session token hash, so preserving the old host pointer alone made unfinished games impossible to host after the identity upgrade.
- Fact: The checked-in recovery migration retires only tokenless memberships, retains historical visits and claims, and clears inaccessible host slots. Concurrent authenticated joins elect one host under the game row lock.
- Fact: Actual original-schema upgrade and 22 route/WebSocket cases passed; source: b08e0edcff3895e55f9e4c1c5df1e168ed326891; evidence: .jes/local/ewp-005/upgrade/1788824329693/result.json and .jes/local/ewp-005/draw-integration.log.
- Assumptions: tested local profile only; future host/service availability is not assumed.
- Deferred owner/trigger: project operator when selecting a new deployment/host profile.
- Open questions: none required for this capture.
- Recommendation, unaccepted: A future session-format change should include an explicit membership and host recovery case, in addition to record-count preservation.
- Reporting: recorded through the JES 0.3.0 manual Observation API and read back as captured Drafts; exact outbox/receipt in `.jes/reports`. API readback: `.jes/local/coordination/1788824889048327000`.

## WR-OBS-2026-002

- Source: WR-EWP-005, revision `b08e0edcff3895e55f9e4c1c5df1e168ed326891`.
- Category: lockout_terminal_state.
- Route: product_specific; this is the narrowest scope supported by the facts.
- JES Draft ID: `JES-OBS-MANUAL-20260907-WR-DRAW`.
- Fact: With three owners, a 25-square Lockout board can distribute claims 9/8/8, so no owner reaches the required 13 squares. The previous implementation left that fully claimed game active.
- Fact: Separate delegated-owner decision WR-DEC-009 approved proposal/plan v1.1 and WR-EWP-005 r2. The resulting behavior stores BOARD_EXHAUSTED, finishes without a winner, and displays a draw in both extension and spectator.
- Fact: Actual extension/content-script plus API-player browser evidence: .jes/local/ewp-003/browser/1788824523681/draw-result.json. This capture itself did not approve the rule change.
- Assumptions: tested local profile only; future host/service availability is not assumed.
- Deferred owner/trigger: project operator when selecting a new deployment/host profile.
- Open questions: none required for this capture.
- Recommendation, unaccepted: Retain majority, exhausted-board draw and finished-state immutability as distinct regression cases.
- Reporting: recorded through the JES 0.3.0 manual Observation API and read back as captured Drafts; exact outbox/receipt in `.jes/reports`. API readback: `.jes/local/coordination/1788824889048327000`.

## WR-OBS-2026-003

- Source: WR-EWP-005, revision `b08e0edcff3895e55f9e4c1c5df1e168ed326891`.
- Category: live_article_qualification.
- Route: project_local_engineering; this is the narrowest scope supported by the facts.
- JES Draft ID: `JES-OBS-MANUAL-20260907-WR-LIVE`.
- Fact: The deterministic browser suite uses actual Chromium extension profiles but substitutes Wikipedia DOM responses; it cannot alone establish compatibility with the live site.
- Fact: A separate real-Wikipedia run extracted Science with 5 categories and 2815 links and stored one completion. Additional runs won unmodified generated Normal and Lockout boards with real navigation.
- Fact: Evidence: .jes/local/ewp-005/live/1788824091326/result.json, .jes/local/ewp-005/live-generated/1788824618210-NORMAL/result.json and .jes/local/ewp-005/live-generated/1788824625010-LOCKOUT/result.json. These samples do not prove all 10005 dataset articles or perpetual external-site availability.
- Assumptions: tested local profile only; future host/service availability is not assumed.
- Deferred owner/trigger: project operator when selecting a new deployment/host profile.
- Open questions: none required for this capture.
- Recommendation, unaccepted: Keep live external-service qualification separate from repeatable fixture checks, and rerun it when Wikipedia extraction or dataset handling changes.
- Reporting: recorded through the JES 0.3.0 manual Observation API and read back as captured Drafts; exact outbox/receipt in `.jes/reports`. API readback: `.jes/local/coordination/1788824889048327000`.

## WR-OBS-2026-004

- Date: 2026-09-08 UTC (September 7 local). Source: WR-EWP-006 VERIFICATION, `e2616e790175d2c178574c606d3759267f792000`.
- Category: operator_restore_qualification. Route: project_local_engineering.
- Fact: logical archive verification passed, while the initial actual public-schema clone restore exposed the pre-existing empty public schema. The original database/profile were preserved.
- Fact: fresh-target-only clean restore, same-origin saved-session/host verification, rollback and running-profile rejection then passed. Evidence: `.jes/local/ewp-006/operator-restore/1788826885309/result.json`.
- Assumption: native Mac PostgreSQL 18 profile; no inferred remote/native Windows support.
- Deferred owner/trigger: project operator when selecting off-machine storage or another host/runtime profile. Open questions: none required for capture.
- Recommendation, unaccepted: retain complete operator restoration and rollback checks, separately from successful archive creation.
- JES Draft ID: `JES-OBS-MANUAL-20260908-WR-RESTORE`. Exact input/outbox/receipt: `.jes/local/observation-inputs/WR-OBS-2026-004.json` and `.jes/reports/WR-OBS-2026-004.json`. Capture does not create or approve an improvement proposal. Delivery was recorded and read back as captured Draft in `.jes/local/coordination/1788827457367366000`.

## WR-OBS-2026-005

- Date: 2026-09-08 UTC. Source: WR-EWP-007, `2c45db7` (full revision in the exact outbox).
- Category: admission_transport_recovery. Route: project_local_engineering.
- Facts: the initial committed-response-loss regression had no identity recovery; Chromium also automatically retried one POST in the revised fault harness. The final case dropped four committed responses and recovered the exact create/join identities after browser restart, with unchanged player counts and revisions.
- Evidence: `.jes/local/ewp-007/admission-before.log`, `browser-02.log`, `browser-03.log`, and `browser/1788830772299/result.json`; 30 integration and 10 Chromium cases passed.
- Assumption: measured native Mac/PostgreSQL/Chromium profile. Deferred owner/trigger: project operator when another browser/runtime/network profile is selected. No blocking open question for capture.
- Recommendation, unaccepted: keep stored admission, acknowledgement receipt and automatic transport retries separate in recovery tests.
- JES Draft ID: `JES-OBS-MANUAL-20260908-WR-ADMISSION`; exact input `.jes/local/observation-inputs/WR-OBS-2026-005.json`, outbox/recorded receipt `.jes/reports/WR-OBS-2026-005.json`. Capture is state-neutral and grants no process or scope approval.
