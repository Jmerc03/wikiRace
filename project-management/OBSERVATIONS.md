# WikiRace observations

Captured 2026-09-07/08 during WR-EWP-005 through WR-EWP-009 verification. Author: Codex under the user’s owner/operator delegation. These are Draft observations; recommendations are unaccepted and do not create an improvement proposal, policy, or engineering approval. Product decisions have separate ledger records.

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

## WR-OBS-2026-006

- Date: 2026-09-08 UTC. Source: WR-EWP-009, `f03c4f4502021e7c251292efab241d33ad90e80f`.
- Category: established_database_connection_stall. Route: project_local_engineering.
- Facts: after correcting a proxy-fixture setup error, an established PostgreSQL response stall left readiness pending beyond the client's eight-second deadline while process liveness stayed available. Bounded Prisma v6 defaults returned readiness 503 in 5008 ms and a failed host action in 5007 ms. The interrupted transaction preserved WAITING/revision 0, and the same player successfully retried after traffic recovered.
- Evidence: `.jes/local/ewp-009/database-fault-before-02.log`, `database-fault/1788832686745/result.json`; full 36 unit, 30 integration and 11 actual Chromium cases passed. The original fixture failure is retained separately in `database-fault-before.log`.
- Assumptions: separate test API/proxy and isolated schema; the operator database stayed running. An operator override that disables a timeout is outside the bounded-default claim.
- Deferred owner/trigger: project operator when selecting different database deadlines for a new workload or deployment. No blocking open question for capture.
- Recommendation, unaccepted: keep established-connection stalls distinct from stopped-database and HTTP outage checks; process health alone does not establish bounded database failure.
- JES Draft ID: `JES-OBS-MANUAL-20260908-WR-DBSTALL`; exact input `.jes/local/observation-inputs/WR-OBS-2026-006.json`, outbox `.jes/reports/WR-OBS-2026-006.json`, confirmed captured/Draft readback `.jes/local/coordination/1788833546198749000/observation-dbstall-readback.json`. Governance effect is none; no improvement proposal or approval was created.

## WR-OBS-2026-007

- Date: 2026-09-08 UTC. Source: WR-EWP-009, `f03c4f4502021e7c251292efab241d33ad90e80f`.
- Category: display_transition_realtime_qualification. Route: project_local_engineering.
- Facts: during the supplemental extension endurance run, both browser sockets closed at 02:33:30.169 UTC and reopened 503 ms later, before the planned API restart. Sampled state stayed consistent, but the extra connections violate the unchanged strict total-connection criterion. The original run was still active at capture.
- Facts: scoped logs for the disposable browser show display-will-sleep at 02:33:30.175892 UTC and display-did-wake at 02:33:31.474607 UTC. The browser and network process remained running. Temporal correlation is established; the causal mechanism is not independently reproduced.
- Evidence: `.jes/local/ewp-009/endurance-display-transition-analysis.json`, `endurance-reconnect-os-log.json`, `endurance-network-processes.txt`, `qualification-awake-assertion.json`, and `.jes/local/ewp-005/endurance/1788833749386/progress.json`. A separate 1800-second repeat adds close/heartbeat diagnostics without weakening assertions; temporary idle display/system sleep inhibition started at 02:40:10 UTC and is bounded to the qualification window.
- Assumptions: one native Mac and isolated actual Chromium; no general OS power-transition claim. Both runs were unfinished at capture, so no completion was inferred.
- Open question: the exact display-transition/socket-close mechanism remains unproven. Deferred owner: project operator when a broader power-state qualification is required. Final local-use adjudication is a separate delegated-owner decision after measured results and cleanup.
- Recommendation, unaccepted: retain host power-transition evidence and distinguish continuous-connection qualification from automatic state-preserving recovery.
- JES Draft ID: `JES-OBS-MANUAL-20260908-WR-DISPLAY`; exact input `.jes/local/observation-inputs/WR-OBS-2026-007.json`, recorded outbox `.jes/reports/WR-OBS-2026-007.json`. The capture does not approve a qualification exception or create an improvement proposal.

## WR-OBS-2026-008

- Date: 2026-10-22. Source: WR-EWP-010 r1; working-tree source/test inventory SHA-256 `aa3e7bfe74dff1e99ae581bdc7a573012246944fa3d8d22bbe40dbfd913e4c75` in `.jes/local/ewp-010/source-inventory.json`.
- Category: round_transition_recovery. Route: project_local_engineering. State: local Draft; reporting to JES Core pending (API connection refused at intake).
- Confirmed facts: final review identified that queued old-popup actions needed a game-ID guard across rematch session installation. The guard and actual Chromium rejection tests now pass. A pending-rematch marker retains the source credentials across browser restart; host and guest committed-response-loss tests recover the exact next membership, including after the next match starts. Explicitly staying in the previous round does not prevent recovery of an already-created next membership.
- Evidence: `.jes/local/ewp-010/browser-final.log`, `browser/1792684579449/recovery-result.json`, `browser/1792684579449/guest-recovery-result.json`; 40 unit/39 integration/16 browser checks passed.
- Evidence classification: code-review finding plus actual software qualification with deterministic Wikipedia DOM and real local PostgreSQL/HTTP/WebSockets. No live-site or human-playtest claim.
- Assumptions: the source extension session is retained until the replacement is saved; deliberately discarding the profile still loses credentials. No new centralized account recovery is provided.
- Deferred decision: owner acceptance of subjective multiplayer flow; owner Jaxson Mercer, trigger first local playtest of the delivered build. No blocking engineering question remains.
- Recommendation, unaccepted: qualify cross-round action targeting separately from stale async response filtering. No policy change, improvement proposal, Core Execution, or human-attributed approval was created.

## WR-OBS-2026-009

- Date: 2026-10-22. Source: WR-EWP-015 r1; 128-file source/test inventory SHA-256 `52c53af66a17d18618c3a3cc59a7eb1379993a99ab0bd50cdf9fc5a81d31d397` in `.jes/local/ewp-015/source-inventory.json`.
- Category: asynchronous_browser_action_completion. Route: project_local_engineering. State: local Draft; Core reporting has not been performed for this observation.
- Confirmed facts: the expanded browser suite passed all five presence cases but an older invitation test reloaded its one-shot page before the host's End Match request finished. The page still showed Join the race. An isolated diagnostic passed. Waiting for confirmed FINISHED state before reload makes the final 40-case suite pass without changing invitation behavior.
- Evidence: `.jes/local/ewp-015/browser-02.log`, `invitation-diagnostic.log`, `browser-final.log`; exact index `evidence/PRESENCE_20261022.json`. The failed run remains retained.
- Evidence classification: actual Chromium with deterministic article DOM and local PostgreSQL/HTTP/WebSockets. No human playtest or external-site claim.
- Assumption: completing a browser click does not establish completion of the asynchronous request it starts. No additional product change is needed for this test-order issue.
- Recommendation, unaccepted: wait for an observable committed state before testing a separate one-shot page that depends on the action. No policy change or general test timeout increase is proposed.
- Deferred decision: owner acceptance of connection-label clarity during a multiplayer playtest; owner Jaxson Mercer. No blocking engineering question remains.

## WR-OBS-2026-010

- Date: 2026-10-22. Source: WR-EWP-016 r1. Category: hosted_profile_evidence. Route: project_local_engineering. State: local Draft; JES Core reporting pending while its local API is unavailable.
- Confirmed facts: the beta can evaluate article facts without retaining unscored browsing or category/link payloads. Real PostgreSQL tests preserve original earning evidence and quota recovery in both modes; retention cascades expired rounds while keeping newer rematches. Local HTTPS Chromium verifies the restricted extension. A clean-build release rehearsal matches checksums and preserves an earlier candidate on mismatch.
- Evidence: `evidence/BETA_20261022.json`; 153-file product/source inventory SHA-256 `ddb2e3705966ee9f0e579f9529842b9b52b92c8bbdd87d6c539f5f4c7ed2c76e`; `.jes/local/ewp-016/integration-closeout.log`, `browser-final.log`, `release-cli-result.json`, `render-validation.json`.
- Evidence boundary: synthetic browser pages, a local TLS proxy, mocked release-preflight responses and schema validation are software preparation. They do not establish actual Render proxy attribution, public-network availability, provider bills, cloud restore or store approval.
- Deferred decisions: account/provisioning and displayed charges; network/recovery qualification; private beta submission and product acceptance. Owner: Jaxson Mercer; triggers: hosting account access and final configured deployment. No paid resource or public publication was created.
- Recommendation, unaccepted: retain distinct local-preparation and hosted-launch status in later release records. No policy change, Core execution or human-attributed approval is inferred.
