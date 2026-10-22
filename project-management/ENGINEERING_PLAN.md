# WikiRace engineering plan v1.5

Owner: Codex, delegated Systems Architect/project operator. Updated: 2026-09-07.
Proposal: [v1.2](../PROJECT_PROPOSAL.md), WR-DEC-015. Planning authority and acceptance: WR-DEC-002; v1.1 refinement accepted by WR-DEC-009; v1.2 recovery qualification accepted by WR-DEC-010. v1.3 continuation accepted by WR-DEC-016. v1.4 invitation/hosting refinement accepted by WR-DEC-019. v1.5 operational fault/runtime qualification accepted by WR-DEC-020. Review: Accepted. JES 0.3.0, POS v0.3.0-dev, EO v0.3-dev.

## Engineering objective and outputs

Make the existing local Chrome multiplayer product complete and recoverable, with a repeatable test path covering actual PostgreSQL and WebSocket behavior. Preserve the stack and existing working changes. Produce a versioned owner map, bounded EWPs, a lifecycle/interface contract, source changes, setup instructions, and evidence-backed closeout.

## Repository topology and artifact ownership

One System `JES-SYSTEM-WIKIRACE`, one Repository `JES-REPO-WIKIRACE`, existing checkout root. Canonical planning root: `project-management`; EWP registry: `project-management/work-packages`, namespace `WR-EWP`.

| Owner | Source | Responsibility and consumers |
| --- | --- | --- |
| WikiRace System | root, docs, project-management, scripts, infra | Product integration, requirements, contracts, validation, release composition |
| API Subsystem | apps/api | API, persistence, concurrency, realtime, spectator service |
| Extension Subsystem | apps/extension | Player UI, Wikipedia extraction, identity storage, reconnect |
| Game Engine Subsystem | packages/game-engine | Board and rule evaluation; API consumer |
| Shared Contracts Subsystem | packages/shared | Shared wire types; API and extension consumers |

No independent child products or repositories are introduced. Shared changes require producer and affected consumer checks. All source safety checks apply to the whole checkout.

## Architecture and engineering decisions

Current: PostgreSQL is the persistent authority; WebSocket rooms live in one API process. Selected: serialize game mutations with database row locks inside transactions, publish only after commit, and let clients refetch their own state. Add opaque per-player bearer sessions; never expose stored token hashes in roster/state. Use waiting/active/finished lifecycle and preserve departed players for ownership history. Keep mode-specific completion/winner logic separate. Complete the existing extension incrementally; serve spectator assets from the same API to avoid a second runtime.

Consequential cross-component behavior is specified in [GAME_CONTRACT.md](../docs/GAME_CONTRACT.md). These changes are planned until verified by their packages. Authentication protects player operations but client-supplied Wikipedia content is not cheat-proof.

## Milestones

| Milestone | Required output and exit gate | Packages | State |
| --- | --- | --- | --- |
| M1 Foundation | JES ownership/records and preserved baseline; real database characterization passes | WR-EWP-001 | Done |
| M2 Match integrity | Valid boards, validation errors, isolated identity, atomic claims/wins, stable winner | WR-EWP-002 | Done |
| M3 Complete player experience | Lobby/host/team lifecycle, leave/resume, configurable backend, resilient extension | WR-EWP-003 | Done |
| M4 Watch and operate | Spectator/stream pages, documented clean startup, integrated browser/API evidence, delivered-use review | WR-EWP-004 | Done |
| M5 Extended qualification | Real Wikipedia, idle/restart, upgrade/draw edges, backup/restore, repeated-session cleanup and final local delivered-use decision | WR-EWP-005, WR-EWP-006 | Done |
| M6 Recoverable entry and invitations | Exactly one membership after uncertain admission, safe server/game invitation flow, actual browser recovery and bounded integrated operation | WR-EWP-007, WR-EWP-008, WR-EWP-009 | Done |

## Validation readiness and dependencies

| Claim/profile | Coverage and route | Owner | Prerequisite and evidence limit |
| --- | --- | --- | --- |
| Local software conformance | build, game-engine tests, isolated PostgreSQL route tests, real WebSocket clients | Codex | PostgreSQL absent initially; provision dedicated local instance without touching existing databases |
| Browser player/spectator behavior | actual browser automation or explicit manual procedure | Codex | inspect available browser capability; API tests alone do not prove extension loading |
| Service recovery | reconnect/restart, preserved credentials, durable DB, clear errors | Codex | fault injection against dedicated local services |
| Windows/public production | not in this delivery claim | future operator | requires native host/deployment evidence; no implied pass |

Validation commands: `npm run build`, `npm test`, targeted integration/browser suites, and `npm run prisma:validate` after schema changes. Every schema change includes checked-in SQL and migration commands. Record commands/results and source hashes. No publication or external messaging is necessary for the local milestone.

## Responsibility split and risks

Codex owns planning decisions, implementation, local software operation/testing, documentation, and evidence under the user's delegation. No physical work is required. Subjective play quality and unavailable native/browser claims remain identified follow-ups. Existing dirty files are preserved before mutation; the baseline is not misattributed to this session. Single-process realtime limits horizontal deployment; retain and document that boundary.

## First package and review

WR-EWP-001 establishes the baseline and persistence tests before transactional or interface refactoring. No blocking product decisions. Plan reviewed for scope, ownership, dependencies, validation feasibility, and preserved Normal/Lockout separation. Accepted by Codex as delegated owner, 2026-09-07.

## v1.1 qualification refinement

WR-EWP-005 implements an explicit draw when all 25 Lockout squares are claimed without a 13-square owner. Persist `BOARD_EXHAUSTED` with no winner and expose the same result to player/spectator clients. No Normal rule or majority threshold changes. Migration recovery retires unusable prototype sessions while preserving history and allows one new authenticated host to resume unfinished games.

## v1.3 continuation architecture and validation readiness

Current gap: create/join responses contain the sole newly issued credential. A committed request with a lost response leaves the extension without that identity. Planned correction: persist a cryptographically random private admission key in extension storage before sending, use it as the requested player token, retain only its hash plus a canonical request fingerprint in PostgreSQL, serialize matching admission keys before game locks, and return the same membership/current state on an exact replay. Unkeyed older clients retain their existing behavior. Never expose keys through public state, invitation URLs, logs, or UI snapshots. Pending retries retain their original server and request across worker/browser restarts; changing intent is blocked until resolution or explicit abandonment. Additive nullable metadata preserves old records; deploy commands accompany migration.

Invitation work carries only server origin and game ID. Parsing is strict; the player explicitly approves any needed origin permission and joins. Pasting a link must not enroll, navigate, or silently switch an existing session. The local runtime remains loopback by default. Existing System/Subsystem ownership is unchanged.

Validation readiness: actual local PostgreSQL, HTTP/WebSocket and isolated Chromium extension profiles are available. Reproduce committed-response loss before the fix; then cover concurrent same-key requests, mismatched payloads/targets, departed-session replay, browser/worker restart while pending, stale credentials, and successful retry with exactly one stored membership. Existing Normal/Lockout checks remain required. Invitation browser tests must exercise a second server origin and prove user-content/token boundaries. Native Windows, Docker runtime, second-machine routing, public deployment and actual OBS remain separate evidence profiles. Docker client is installed but its daemon was unavailable at continuation intake; no Docker success is assumed.

Codex owns engineering and delegated product review. No human/physical action is needed for this local continuation. The next product decision is v1.2 local use after the M6 evidence; original v1.1 acceptance remains historical. Cutoff: 2026-09-08 03:10:09 UTC.

## v1.4 invitation and local network option

WR-EWP-008 makes the explicit origin/game invitation contract usable in the extension and operator page. Shared parsing accepts only valid game IDs or supported HTTP(S) invitation/spectator paths, excludes credentials and unrelated query data, and never contacts a target merely because text was pasted. An explicit Join action obtains the requested host permission and selects that origin only when no existing/pending session conflicts.

The operator may opt into binding the API to `0.0.0.0` using `WIKIRACE_API_HOST`; default `127.0.0.1` is preserved. PostgreSQL remains loopback-only. The selected binding participates in profile ownership, with running-profile changes rejected. Status provides observed private-interface candidates as connection suggestions, never as proof of another machine's reachability. Qualification uses this Mac's actual local interface and an isolated service, then returns the managed service to loopback. Public internet exposure, router/firewall reconfiguration and second-machine qualification are excluded.

## v1.5 operational validation

WR-EWP-009 checks the difference between a stopped database and an established connection that stops responding. Use a loopback TCP proxy to stall only a disposable API/database connection; keep the operator database running. Liveness must remain usable, readiness and player requests must fail in bounded time, and recovery must preserve durable identities/state. If the current defaults leave queries unbounded, apply supported Prisma v6 connection deadlines with documented operator overrides and regressions. No data-model or scoring-rule change is planned.

Validate the declared minimum Node 22.12 runtime using a verified official binary isolated from the installed Node runtime. Do not replace global tools or mutate installed dependencies during a concurrent soak. Run a measured 60-minute local profile with four games, 64 players and 128 real HTTP/WebSocket clients, mode-specific isolation, one controlled API restart, and final cleanup. This is bounded software operation, not public-scale or second-machine qualification. Record raw durations, errors, connection counts and memory observations; retain failed attempts. Existing native Mac and unavailable Windows/Docker boundaries remain explicit. Final M6 product review follows all required results.

## Feature continuation — 2026-10-22

The user's explicit selection authorizes results, scored-article history and
rematches before 15:00 America/Chicago. WR-EWP-010 r1 implements this bounded
extension to PR-004/006. No new ownership or unrelated milestone is introduced.

Use the existing stored winner/timestamps/completion-event references for
results and per-square evidence. Share result ordering and formatting across
Extension and spectator clients. Add nullable provenance and a unique successor
link for rematches; never reset the source game. The host creates one next lobby,
and original players explicitly opt in with preserved identity/team attributes.
Source-then-destination row locks, per-round derived credentials and a persisted
pending extension transition provide retry recovery without storing plaintext
credentials server-side. GAME_CONTRACT.md v1.3 defines the interface.

Required evidence: full build/unit/API/browser checks; actual migration of old
records; archive/restore with both original admission and rematch recovery;
visual review; original operator-row preservation; and packaged local startup.
No new public/network, live Wikipedia, Windows, subjective play-quality or
uninterrupted-duration qualification is implied. Owner acceptance of the new
features follows the completed engineering evidence, separately from M6's
historical acceptance.

### Lobby ready checks — WR-EWP-011

The user's subsequent explicit selection authorizes ready checks before the same
cutoff. Extend Player with a default-false boolean and expose it in summaries.
Serialize an authenticated desired-state setter, host start gate and team-reset
with existing game mutations. Reuse revision/invalidation/reconnect handling.
Gate all active members, including host; exclude departed members. New/rematch
members start false, and existing readiness survives session recovery.

Verify API authorization/idempotence, simultaneous start/unready/join, team and
host changes, rematches, real browser restart/response loss, prior-schema upgrade
and mixed-readiness archive/restore. Update the existing test fixtures to ready
participants explicitly. No presence, force-start, kick, daily board or new
scoring feature is included. Preserve WR-EWP-010 records and evidence.

### Host lobby controls — WR-EWP-012

The next user selection authorizes host removal and joining locks. Add default-
false lock/removal booleans; retain leftAt as the membership boundary. Check locks
after existing-identity recovery in normal/rematch admission, and serialize host
set/remove with all other game mutations. Notify the previous round of lock
changes. Close invalid-session sockets and reject late state application.

Verify ownership/lifecycle/idempotence, revoked admission/rematch recovery,
concurrent joins/locks and removals/start, actual browser confirmation/restart/
lost responses/stale reads, previous-schema migrations and restored locks/removals.
No ban system, active-play kick or presence authority is introduced. Package the
verified local flow as 1.6.0, retaining earlier evidence and pending owner acceptance.

## WR-EWP-013 continuation — 2026-10-22

The user selected article/objective mix and topic variety in this chat. Execute
the bounded scope in WR-EWP-013 r1: validated 25-square custom setup, shared
configuration visibility and unchanged rematch settings. This selection does
not approve broader product scope or establish owner acceptance.

## Optional timed rounds — 2026-10-22

The user selected optional timed rounds. WR-EWP-014 r1 implements a fixed optional
duration, server-authoritative expiry, visible countdown and fresh rematch clocks.
Existing win rules remain; time expiry records no winner. This instruction does
not imply acceptance or additional product scope.

## Player connection indicators — 2026-10-22

The user's next selection authorizes WR-EWP-015 r1. Add an in-memory presence
tracker per API instance, authenticate socket membership under the existing game
lock, and publish separate presence snapshots to opted-in viewers. Revoke on
committed leave/removal. Shared display helpers serve extension and spectator;
lost observation clears certainty. Verify identity isolation and unchanged game
state alongside reconnect, duplicate socket, restart and responsive UI behavior.

## Ad-free beta preparation — 2026-10-22

The user superseded the daily-challenge selection with launch preparation and
selected Render. WR-EWP-016 r1 covers a one-instance API/private PostgreSQL
blueprint, application/storage limits, minimal scored-article retention, public
privacy contact, hosted-only extension packaging, store assets and release
preflight. Existing local operation and all selected multiplayer features remain.
Public support email: jaxmerc03@gmail.com; operator label: WikiRace. No paid
resource or store publication is included in a local verification claim. The
deployment, two-network/proxy and managed-recovery checks remain explicit gates.
