# Chrome Web Store beta submission packet

Draft for the locally verified 1.10.0 hosted beta build; public deployment is pending.
Public support: jaxmerc03@gmail.com.
Publisher/operator label: WikiRace. Visibility: **Private** with trusted testers.
Unlisted is an alternative if link-based installation is desired; it is not a
private access boundary. All visibility choices undergo Chrome review.
[Distribution reference](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution).

## Listing text

**Name:** WikiRace — Wikipedia Bingo BETA

**Short description:** Race friends across Wikipedia to complete your bingo board. Ad-free multiplayer with teams, timers and rematches.

**Detailed description:**

THIS EXTENSION IS FOR BETA TESTING.

Turn a Wikipedia rabbit hole into a game with friends. Create a lobby, share its
invitation, mark Ready and explore English Wikipedia to complete your board.

Play Normal mode to race for a bingo line on your own board, or Lockout to claim
squares before your opponents. Team up in Lockout and share your team's progress.
Choose your mix of named articles and flexible objectives, adjust topic variety,
and play untimed or with an optional round timer.

Live boards show player connections and scores. Hosts can lock joining and
remove a player before a match starts. Spectators can follow a game through a
read-only web page. After the match, inspect the articles that earned your
squares and open a fresh rematch lobby with the same settings.

No ads. No account required. Choose a nickname and play with people you invite.
An internet connection and access to the hosted WikiRace server are required.
The beta may have limited capacity and scheduled service interruptions.

During active matches, the extension sends eligible English Wikipedia article
titles, URLs, category labels and outgoing links to our server for scoring. The
hosted beta saves only articles that earn squares, discards the category/link
payloads after evaluation, and expires finished results after 30 days. Anyone
with your game link can view its roster, results and scored articles. We do not
sell this data or use it for advertising. See the linked privacy policy for full
details and deletion contact information.

WikiRace is independent and is not affiliated with Wikipedia or the Wikimedia
Foundation. This beta is for friendly games, not cheat-proof ranked competition.

## Dashboard fields

- Homepage: the real deployed HTTPS origin, verified by `release:beta`.
- Privacy policy: the same origin plus `/privacy`.
- Support contact: jaxmerc03@gmail.com.
- Language: English. Choose the available Games category in the current dashboard.
- Single purpose: Let invited players compete in Wikipedia bingo matches by
  evaluating eligible article visits against a shared game board.
- Remote code: **No**. The ZIP bundles all extension JavaScript. API responses
  contain game data, not remotely executed extension code.

Permission explanations:

| Permission | Justification |
| --- | --- |
| `storage` | Keep the player's private session, selected game and recoverable pending entry locally across browser restarts. No Chrome Sync is used. |
| `alarms` | Recover the multiplayer connection when Chrome suspends the extension's background service worker. |
| `https://en.wikipedia.org/*` | Read eligible article titles, categories and outgoing links for scoring while in an active match. |
| Exact hosted API origin | Send scoring/game actions and receive authenticated game state and live updates. |

The beta ZIP has no `tabs`, history, cookies, all-sites, or optional-host permission.
The local developer ZIP intentionally supports custom servers and is **not** the
store upload candidate. Use `release/beta/wikirace-extension.zip` after preflight.

Data disclosures must include transmitted data even if it is immediately discarded.
Review the current dashboard's category definitions and disclose: player names
(allow nicknames), article URLs/titles/categories/links used during play, gameplay
activity and timestamps, and private authentication/session credentials used for
requests. Do not mark "no user data collected." Website content and web-history
categories apply to the article data. Authentication information applies to the
private session tokens; hashes persist server-side. Infrastructure processes IP
addresses for delivery/abuse handling. No payment, health, precise location,
personal-message or general browser-history feature exists.

Certify the limitations only after checking the uploaded build: no sale of data,
no advertising use, no unrelated use/transfer, and no creditworthiness use. Keep
the dashboard, in-product notice and live policy consistent.
[Privacy-field guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy),
[Limited Use policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use).

## Review instructions

No reviewer account is needed. Open the extension, enter a nickname, create a
lobby, mark Ready, and Start Match. Use a second Chrome profile with the same
beta to join the invitation and test multiplayer. Browse an article named on the
board, then reopen the extension or full board to see the score. Open the
spectator link to verify read-only progress. End Match shows results; Open
Rematch Lobby starts the next lobby. Privacy and data use opens the live policy.

Explain the invitation-only distribution and any current server capacity to the
reviewer. Keep the server available throughout review. Review timing is external;
submission before 3 p.m. does not imply approval by 3 p.m.

## Images

- `apps/extension/public/icon-128.png`: original icon with transparent padding.
- `docs/store/assets/01-live-game.png`: actual spectator UI, synthetic test match.
- `docs/store/assets/02-player-board.png`: actual extension UI, same test match.
- `docs/store/assets/promo-small.png`: optional 440 × 280 original brand artwork;
  editable SVG beside it. Regenerate with `node scripts/generate-store-artwork.mjs`.

Screenshots use 1280 × 800 browser viewports and show implemented functionality.
They are presentation evidence, not public-host/network qualification. Inspect
them before uploading; regenerate after material UI changes. No Wikipedia logo,
endorsement claim, fabricated testimonials, or advertising badges are used.
The synthetic-match screenshots are generated under the ignored beta browser
evidence folder. Copy reviewed images into this packet deliberately; ordinary
test runs do not modify the published source assets.
[Chrome image guidance](https://developer.chrome.com/docs/webstore/images).
