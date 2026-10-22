# Game Rules

## Normal Mode

Players compete independently.

Rules:

- Each player tracks their own progress.
- Multiple players may complete the same square.
- Completions do not block other players.
- Bingo is checked per player.

Winner:

First player to complete a valid bingo line.

Final standings identify that stored bingo winner even when another player has
completed more total squares. Other players are ordered by completed squares;
equal scores share a place.

---

## Lockout Mode

Squares may be claimed.

Rules:

- Claimed squares become owned.
- Ownership cannot be stolen.
- Ownership is determined by player or team.

Ownership Rules

Player without team:

Square belongs to player.

Player with team:

Square belongs to player's team.

Teammates share ownership.

Opposing teams cannot claim already-owned squares.

Winner:

First owner (player or team) to claim a majority of the board.

On a 5x5 board, majority is 13 squares.

Bingo rows, columns, and diagonals do not determine Lockout wins. If all 25 squares are claimed and no player or team has 13, the match ends as a draw. This can occur with three or more owners.

---

## Teams

In a waiting lobby, players may:

- Create teams
- Join teams
- Leave teams

Team membership is locked when the host starts the match. Normal mode still
scores each player independently; teams share territory only in Lockout.

Each team has:

- Name
- Color

Team colors are displayed on owned squares.

## Match lifecycle

Creating a game opens a waiting lobby. Share the game ID, join, and configure
teams, then every player (including the host) selects **Mark Ready**. The host
can select **Start Match** only when all remaining players are ready. Page visits
in the lobby do not score. Joining an active match is allowed as a solo player; team membership
cannot change during play. Games support up to 32 active players and 16 teams.

The host may end a match without a winner. Leaving transfers host controls to
the earliest remaining player. The last player leaving ends the game. Leaving
does not erase that player's visits, completions, or claims. Finished games
cannot be joined or scored, and all clients see the same stored winner.

Only English Wikipedia article pages count. Main Page, special pages, and
namespaces such as Category, Talk, User, and File are excluded. Each qualifying
visit may satisfy several objectives; repeated visits do not duplicate claims
or completions. Direct navigation/search is allowed; no link-only restriction
or anti-cheat guarantee is currently part of the rules.

---

## Current Win Detection

Normal Mode:

Bingo checked per player.

Lockout Mode:

Majority territory control checked per owner.

Owner:

team:<teamId>

or

player:<playerId>

Claims from different owners never combine to form a bingo.
Claims from different owners never combine to form a majority.

## Results and playing another round

After a match finishes, results show the stored outcome, duration when known,
and final player/team scores. **View article** on a completed square shows the
article that first earned it, the player, and the recorded time. **Scored
articles** lists the same evidence. Normal shows your own completions (or the
spectator's followed player); Lockout shows every exclusive claim. One article
can earn multiple squares. This does not expose unscored browsing history.

The host can select **Open Rematch Lobby** after the match finishes. It creates
a new board with the same mode/settings and copied teams. Each player selects
**Join Rematch** to carry over their name, color, and team. Wait for everyone to
join and mark Ready before starting; rematch opt-in is only available in the waiting lobby.
Old results stay available through **Previous Results** and spectator round
links. A rematch never resets or overwrites the previous match.

## Lobby ready checks

Every new lobby member starts **Not Ready**, including returning rematch players.
Select **Mark Ready** to prepare, or **Ready — click to undo** to withdraw while
waiting. A real team change clears your readiness; rejoining the same team does
not. Other players keep their choices. New arrivals must ready, and departed
players no longer block Start Match. Host transfer keeps each remaining player's
choice. Readiness survives reconnects/browser restarts and indicates an explicit
choice, not whether a player is online. It cannot change after play starts.

## Host access controls

The host can **Lock Joining** or **Reopen Joining** in the lobby or during play.
A lock blocks new invitation joins and new rematch arrivals. Existing players
can reconnect and recover a previously committed entry. Locks stay in place when
the match starts or the host leaves; the next host controls them. New rematches
start with joining open.

Before play starts, the host can **Remove** another player after confirmation.
That saved session ends, its readiness clears, and it no longer blocks Start.
The player remains in the history with a removed label. Removal is unavailable
during active or finished matches. It is not a ban: a fresh session can enter
when joining is open. Lock joining to prevent new arrivals. The host uses
**Leave Game** to leave themselves and transfer control normally.

## Custom board setup

Before creating a lobby, choose how many of the 25 squares require a named
article. The remainder use flexible title, category or link-count objectives.
Article difficulty and topic variety apply only to named articles. Topic variety
limits how many named articles can come from one catalog topic: 1, 2, 3, 5 or
unrestricted. A cap of 1 supports up to 11 named articles; a cap of 2 supports
22. The UI explains invalid combinations and never changes your choice silently.
An all-flexible or all-named board is allowed when the selected cap supports it.

Default setup stays Mixed / 15 named / 10 flexible / at most 3 per topic. Settings
are visible to everyone and remain fixed for the round. Rematches generate a
fresh board with the same setup. Normal bingo and Lockout majority rules do not
change with the mix.

## Optional timed rounds

Choose **Untimed** (the default) or 1, 5, 10, 15, 30 or 60 minutes before creating
the lobby. Everyone sees the chosen limit. The timer starts when the host starts
the match, after everyone is ready. Rejoining, restarting the browser or changing
hosts never adds time. Each rematch inherits the limit and starts a fresh clock.

A bingo or Lockout majority before expiry still wins normally. Otherwise time
expiry ends the round with final scores and **Time’s up — no winner**. Highest
score alone does not win. The server enforces the deadline when a request obtains
the game lock; client timestamps do not backdate a visit. Late visits cannot score.

The countdown is visible to players and spectators, including the stream layout.
If the connection is down when it reaches zero, wait for server confirmation;
the API resumes the persisted deadline after restart and never pauses the clock.
Existing untimed matches stay untimed when upgrading.

## Player connections

Online means a player's extension is connected to the game server. Reconnecting
marks a recent connection loss; after ten seconds it becomes Offline. Silent
network failures take longer to detect. If your own live connection is unavailable,
other players show Connection unknown until updates resume.

These labels are separate from Ready and do not indicate whether someone is
actively browsing. A disconnect does not unready a player, transfer host controls,
remove membership, pause a timer or change scoring. Multiple open boards still
represent one player. Left/Removed describes membership, not network status.

## Hosted beta history

The ad-free hosted beta keeps only articles that earn a new square. Finished
results expire after 30 days; a newer rematch remains available after its previous
round expires. Anyone with a game link can view its roster, results and scored
articles, so use a nickname and share links with intended viewers. Capacity limits
can temporarily prevent new games or memberships. These hosting limits do not
change Normal bingo, Lockout majority, readiness or timer rules. Local servers
retain their existing history behavior; see the selected server's privacy page.
