import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlayerSummaries,
  buildSquareClaimSummaries,
  buildTeamSummaries,
  buildLockoutWinningResult,
  buildWinningResult,
  buildWinningOwner,
  getLockoutOwnerKey,
  getLockoutWinningOwnerResult,
  type LockoutClaimForWinCheck,
} from "../src/routes/games.helpers.js";

const squares = Array.from({ length: 25 }, (_, position) => ({
  id: `square-${position}`,
  position,
}));

function claim(
  position: number,
  playerId: string,
  teamId: string | null,
): LockoutClaimForWinCheck {
  return {
    squareId: `square-${position}`,
    playerId,
    player: { teamId },
  };
}

test("getLockoutOwnerKey preserves player and team owner formats", () => {
  assert.equal(
    getLockoutOwnerKey(claim(0, "player-1", null)),
    "player:player-1",
  );
  assert.equal(
    getLockoutOwnerKey(claim(0, "player-1", "team-1")),
    "team:team-1",
  );
});

test("a Lockout bingo line does not create a winner before majority", () => {
  const claims = [0, 1, 2, 3, 4].map((position) =>
    claim(position, "player-1", "team-1"),
  );

  assert.equal(getLockoutWinningOwnerResult(claims, squares), null);
});

test("eight claimed squares is not a majority on a 5x5 board", () => {
  const claims = Array.from({ length: 8 }, (_, position) =>
    claim(position, "player-1", "team-1"),
  );

  assert.equal(getLockoutWinningOwnerResult(claims, squares), null);
});

test("teammates' claims combine into a majority winner", () => {
  const claims = Array.from({ length: 13 }, (_, position) =>
    claim(position, position % 2 === 0 ? "player-1" : "player-2", "team-1"),
  );

  assert.deepEqual(getLockoutWinningOwnerResult(claims, squares), {
    ownerKey: "team:team-1",
    claimedSquareIds: claims.map((claim) => claim.squareId),
    claimCount: 13,
    requiredClaimCount: 13,
  });
});

test("claims from different teams do not combine", () => {
  const claims = [
    claim(0, "player-1", "team-1"),
    claim(1, "player-2", "team-1"),
    claim(2, "player-3", "team-2"),
    claim(3, "player-4", "team-2"),
    claim(4, "player-5", "team-2"),
  ];

  assert.equal(getLockoutWinningOwnerResult(claims, squares), null);
});

test("twelve claimed squares is not a majority on a 5x5 board", () => {
  const claims = Array.from({ length: 12 }, (_, position) =>
    claim(position, "player-1", null),
  );

  assert.equal(getLockoutWinningOwnerResult(claims, squares), null);
});

test("an unteamed player's majority reports the player owner", () => {
  const claims = Array.from({ length: 13 }, (_, position) =>
    claim(position, "player-1", null),
  );

  assert.deepEqual(getLockoutWinningOwnerResult(claims, squares), {
    ownerKey: "player:player-1",
    claimedSquareIds: claims.map((claim) => claim.squareId),
    claimCount: 13,
    requiredClaimCount: 13,
  });
});

test("unteamed players' claims remain separate", () => {
  const claims = Array.from({ length: 24 }, (_, position) =>
    claim(position, position % 2 === 0 ? "player-1" : "player-2", null),
  );

  assert.equal(getLockoutWinningOwnerResult(claims, squares), null);
});

test("team and player ownership do not combine into a majority", () => {
  const claims = [
    ...Array.from({ length: 7 }, (_, position) =>
      claim(position, "player-1", "team-1"),
    ),
    ...Array.from({ length: 6 }, (_, index) =>
      claim(index + 7, "player-2", null),
    ),
  ];

  assert.equal(getLockoutWinningOwnerResult(claims, squares), null);
});

test("owner that reaches majority wins", () => {
  const claims = [
    ...Array.from({ length: 12 }, (_, position) =>
      claim(position, "player-1", "team-1"),
    ),
    ...Array.from({ length: 13 }, (_, index) =>
      claim(index + 12, "player-2", "team-2"),
    ),
  ];

  assert.equal(
    getLockoutWinningOwnerResult(claims, squares)?.ownerKey,
    "team:team-2",
  );
});

test("claims for unknown squares are ignored", () => {
  const claims = [
    ...Array.from({ length: 12 }, (_, position) =>
      claim(position, "player-1", null),
    ),
    {
      squareId: "unknown-square",
      playerId: "player-1",
      player: { teamId: null },
    },
  ];

  assert.equal(getLockoutWinningOwnerResult(claims, squares), null);
});

test("buildPlayerSummaries preserves the public player shape", () => {
  assert.deepEqual(
    buildPlayerSummaries([
      {
        id: "player-1",
        displayName: "Ada",
        color: "red",
        teamId: "team-1",
      },
    ]),
    [
      {
        id: "player-1",
        displayName: "Ada",
        color: "red",
        teamId: "team-1",
      },
    ],
  );
});

test("buildTeamSummaries includes matching players and empty rosters", () => {
  const teams = [
    { id: "team-1", name: "One", color: "red" },
    { id: "team-2", name: "Two", color: "blue" },
  ];
  const players = [
    {
      id: "player-1",
      displayName: "Ada",
      color: "red",
      teamId: "team-1",
    },
    {
      id: "player-2",
      displayName: "Grace",
      color: null,
      teamId: null,
    },
  ];

  assert.deepEqual(buildTeamSummaries(teams, players), [
    {
      id: "team-1",
      name: "One",
      color: "red",
      players: [{ id: "player-1", displayName: "Ada", color: "red" }],
    },
    {
      id: "team-2",
      name: "Two",
      color: "blue",
      players: [],
    },
  ]);
});

test("buildSquareClaimSummaries resolves team metadata and null fallbacks", () => {
  const claimedAt = new Date("2026-06-03T12:00:00.000Z");
  const claims = [
    {
      squareId: "square-0",
      playerId: "player-1",
      claimedAt,
      player: {
        displayName: "Ada",
        color: "red",
        teamId: "team-1",
      },
    },
    {
      squareId: "square-1",
      playerId: "player-2",
      claimedAt,
      player: {
        displayName: "Grace",
        color: null,
        teamId: null,
      },
    },
  ];

  assert.deepEqual(
    buildSquareClaimSummaries(claims, [
      { id: "team-1", name: "One", color: "team-red" },
    ]),
    [
      {
        squareId: "square-0",
        playerId: "player-1",
        playerName: "Ada",
        playerColor: "red",
        teamId: "team-1",
        teamName: "One",
        teamColor: "team-red",
        claimedAt,
      },
      {
        squareId: "square-1",
        playerId: "player-2",
        playerName: "Grace",
        playerColor: null,
        teamId: null,
        teamName: null,
        teamColor: null,
        claimedAt,
      },
    ],
  );
});

test("buildWinningResult preserves winning and no-win response fields", () => {
  assert.deepEqual(buildWinningResult(null), {
    winner: false,
    winningLine: null,
    winningLineType: null,
  });
  assert.deepEqual(
    buildWinningResult({
      positions: [0, 1, 2, 3, 4],
      type: "ROW",
      index: 0,
    }),
    {
      winner: true,
      winningLine: [0, 1, 2, 3, 4],
      winningLineType: "ROW",
    },
  );
});

test("buildLockoutWinningResult preserves majority response fields", () => {
  assert.deepEqual(buildLockoutWinningResult(null), {
    winner: false,
    winningLine: null,
    winningLineType: null,
  });
  assert.deepEqual(
    buildLockoutWinningResult({
      ownerKey: "team:team-1",
      claimedSquareIds: Array.from(
        { length: 13 },
        (_, index) => `square-${index}`,
      ),
      claimCount: 13,
      requiredClaimCount: 13,
    }),
    {
      winner: true,
      winningLine: null,
      winningLineType: null,
    },
  );
});

test("buildWinningOwner resolves team and player winner identities", () => {
  const players = [
    {
      id: "player-1",
      displayName: "Jaxson",
      color: "player-red",
      teamId: null,
    },
  ];
  const teams = [{ id: "team-1", name: "Red", color: "team-red" }];

  assert.deepEqual(
    buildWinningOwner(
      {
        ownerKey: "team:team-1",
        claimedSquareIds: Array.from(
          { length: 13 },
          (_, index) => `square-${index}`,
        ),
        claimCount: 13,
        requiredClaimCount: 13,
      },
      players,
      teams,
    ),
    {
      ownerKey: "team:team-1",
      type: "TEAM",
      id: "team-1",
      name: "Red",
      color: "team-red",
    },
  );
  assert.deepEqual(
    buildWinningOwner(
      {
        ownerKey: "player:player-1",
        claimedSquareIds: Array.from(
          { length: 13 },
          (_, index) => `square-${index}`,
        ),
        claimCount: 13,
        requiredClaimCount: 13,
      },
      players,
      teams,
    ),
    {
      ownerKey: "player:player-1",
      type: "PLAYER",
      id: "player-1",
      name: "Jaxson",
      color: "player-red",
    },
  );
  assert.equal(buildWinningOwner(null, players, teams), null);
});
