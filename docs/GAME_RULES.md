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
teams before the host selects **Start Match**. Page visits in the lobby do not
score. Joining an active match is allowed as a solo player; team membership
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
