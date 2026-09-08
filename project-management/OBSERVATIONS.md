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
