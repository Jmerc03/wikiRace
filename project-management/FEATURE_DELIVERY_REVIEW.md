# Feature continuation — delivery review

Date: 2026-10-22. Engineering status: complete, WR-EWP-010 r1 through WR-EWP-015 r1. Product-owner decision: Pending. Owner: Jaxson Mercer.

## Authorized intent and delivered behavior

The user selected results, scored-article history and rematches for the existing
local multiplayer game. Extension 1.4.0 and game contract v1.3 provide final
outcome/duration/standings, original earning articles with player/time, and fresh
linked rounds with preserved names/colors/teams through individual opt-in.
Previous results remain accessible. Separate Normal and Lockout rules persist.

## Evidence and configuration

- Full build; 40 unit, 39 real PostgreSQL/HTTP/WebSocket integration and 16 actual Chromium workflows pass. Browser workflows use deterministic Wikipedia DOM fixtures.
- Committed-response-loss/restart recovery passes for opening and joining rematches, including recovery after the next round starts and stale old-round action rejection.
- Old-schema migration and populated archive/restore pass: seven sessions authenticate, five original admissions and two rematch memberships recover without changing rows.
- Extension, spectator and compact-popup screenshots were visually inspected. Untrusted names/article titles remain text; unsafe historical links are suppressed.
- Node 24.15/macOS, dedicated PostgreSQL, ten migrations, loopback API ready at `http://127.0.0.1:4000`. ZIP and served assets match the checked source. No disposable database resources remain.
- Exact source/artifact references: [evidence index](evidence/FEATURES_20261022.json) and [work package](work-packages/WR-EWP-010.md).

## Limits and owner follow-up

Reload the installed unpacked Chrome extension or install the packaged 1.4.0
build. No original user browser profile was changed. Live-Wikipedia, Windows,
public-network, OBS and long-duration profiles were not rerun for this batch;
historical evidence remains separately scoped. Subjective play quality has not
been assessed by the user. JES observation reporting is pending Core availability.

The owner can evaluate the local delivered flow by finishing a match, inspecting
a scored article, and joining a rematch with another player. Record acceptance,
conditions or requested changes here after an explicit owner decision. The user's
implementation instruction and these automated checks do not imply that decision.

## Subsequent delivery: lobby ready checks (WR-EWP-011)

The user's second feature selection is delivered in **1.5.0**. Each member,
including the host, marks Ready before Start Match is allowed. The lobby and
spectator show readiness; new/rematch players start unready, real team changes
clear that player's choice, and departures stop blocking start. Choices survive
reconnects and browser restart. Readiness does not indicate online presence.

Current evidence supersedes the runtime/version counts above, while preserving
that earlier batch's historical results: 40 unit, 47 integration and 19 actual
Chromium checks pass. Prior-schema/prototype migration, populated mixed-readiness
backup/restore, bounded database failure and reproducible packaging pass. The
original loopback API is ready with eleven migrations; actual served assets and
running gate/rematch smoke checks pass. The installed extension needs reloading.
See [ready-check evidence](evidence/READY_CHECKS_20261022.json) and
[WR-EWP-011](work-packages/WR-EWP-011.md). The same platform/playtest limits apply.

Owner acceptance remains **Pending**. A two-player lobby can now be reviewed by
readying both players, withdrawing readiness, changing a team, and starting once
everyone is ready. This engineering record does not claim that user review occurred.

## Subsequent delivery: host lobby controls (WR-EWP-012)

The user's third selection is delivered in **1.6.0**. Hosts can remove another
waiting player with confirmation, or lock/reopen new arrivals before or during
play. Removed sessions stay revoked; existing members recover through locks.
Access state appears in extension/spectator/invitation views. A fresh rematch is
open. Removal is not a ban on new anonymous identities when joining is open.

Current verification: build, 40 unit, 55 integration, 24 Chromium workflows,
three migration cases and exact archive/restore pass. The restore contains eight
player records: seven valid sessions and one revoked membership that stays
rejected. Locks, readiness, results and recoverable identities persist. The local
API is ready on the original loopback profile with twelve migrations, and served
assets match the tested ZIP. The installed extension needs reloading. Source and
artifact references: [host-control evidence](evidence/HOST_CONTROLS_20261022.json)
and [WR-EWP-012](work-packages/WR-EWP-012.md).

Owner acceptance remains **Pending**, separately from the earlier historical
acceptance. The host can review lock/reopen, cancel/confirm removal, and see the
remaining ready players start a match. No subjective review is claimed here.

## Subsequent delivery: custom board setup (WR-EWP-013)

The fourth user selection is delivered in **1.7.0**. Choose 0–25 named articles,
complementary flexible objectives, article difficulty and per-topic article caps.
Impossible combinations are explained before creation. Reset restores the
original default. All players and spectators can see the fixed configuration;
rematches preserve it on a fresh board. Pending-entry restart retains the exact
original settings. A setup-options outage does not block joining an existing game.

Current verification: build, 43 unit tests with the full 1,950-combination matrix,
59 integration cases, 30 actual Chromium workflows, exact custom-configuration
archive/restore and reproducible packaging pass. The loopback API is ready and
served files match the package. No new migration is required; the installed
extension needs reloading. See [custom-board evidence](evidence/CUSTOM_BOARD_20261022.json)
and [WR-EWP-013](work-packages/WR-EWP-013.md). Earlier evidence remains historical.

Owner acceptance is **Pending**. Review a custom lobby with another player and
compare an all-flexible or all-named board, then open a rematch. No subjective
assessment of the resulting board difficulty or variety is claimed.

## Subsequent delivery: optional timed rounds (WR-EWP-014)

The fifth user selection is delivered in **1.8.0**. Choose Untimed or 1, 5, 10,
15, 30 or 60 minutes. Waiting does not consume time. Players and spectators see
the shared countdown; the server closes scoring at the saved deadline and records
no winner on expiry. Existing wins still finish immediately. Reconnects and API
restart preserve the deadline. Offline clients retain their session and request
confirmation. Rematches retain the chosen duration with a fresh clock.

Current verification: build, Prisma validation, 46 unit tests, 70 integration
cases, 35 actual Chromium workflows, four upgrade cases, populated archive/restore,
bounded database failure and reproducible packaging pass. Browser evidence includes
an actual one-minute round and a twelve-hour client-clock offset. UTC, Chicago and
Tokyo database-session tests verify deadline comparisons. The original loopback
API is ready with thirteen migrations and matching served assets. Reload the
installed extension. See [timed-round evidence](evidence/TIMED_ROUNDS_20261022.json)
and [WR-EWP-014](work-packages/WR-EWP-014.md).

Owner acceptance remains **Pending**. Review a timed match with another player,
then open a rematch and compare untimed play. No subjective assessment of the
selected durations or multiplayer pacing is claimed.

## Subsequent delivery: player connection indicators (WR-EWP-015)

The sixth user selection is delivered in **1.9.0**. Player and spectator rosters
show Online, a brief Reconnecting grace, and Offline. Unknown means the observing
client cannot confirm current connections. Stream scorecards aggregate team
connections. Spectators do not count as players, and multiple connected boards
do not duplicate a player. Leaving or removal ends that membership's presence.
Online does not indicate attention, browsing activity or Ready; disconnection
does not reset readiness, transfer host controls or change a match.

Current verification: build, 48 unit tests, 77 integration cases, 40 actual
Chromium workflows, forced-worker recovery, bounded database failure and
reproducible packaging pass. Tests include actual heartbeat, ten-second grace
and 45-second stale-stream deadlines. The original loopback API is ready with
matching assets and unchanged operator rows. No migration is needed. Reload
the extension on each player; older clients do not announce presence. See
[presence evidence](evidence/PRESENCE_20261022.json) and
[WR-EWP-015](work-packages/WR-EWP-015.md).

Owner acceptance remains **Pending**. Review the roster with another player,
close/reopen their browser, and compare Ready against the connection label.
No subjective assessment or OS-sleep timing qualification is claimed.
