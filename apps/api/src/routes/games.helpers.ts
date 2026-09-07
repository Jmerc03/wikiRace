import type { WinningLineResult } from "@bingo/game-engine";

export type PlayerForSummary = {
  id: string;
  displayName: string;
  color: string | null;
  teamId: string | null;
};

export type TeamForSummary = {
  id: string;
  name: string;
  color: string;
};

export type LockoutClaimForWinCheck = {
  squareId: string;
  playerId: string;
  player: {
    teamId: string | null;
  };
};

export type SquareForWinCheck = {
  id: string;
  position: number;
};

export type SquareClaimForSummary = LockoutClaimForWinCheck & {
  claimedAt: Date;
  player: {
    displayName: string;
    color: string | null;
    teamId: string | null;
  };
};

export type LockoutWinningOwnerResult = {
  ownerKey: string;
  claimedSquareIds: string[];
  claimCount: number;
  requiredClaimCount: number;
};

export function buildPlayerSummaries(players: PlayerForSummary[]) {
  return players.map((player) => ({
    id: player.id,
    displayName: player.displayName,
    color: player.color,
    teamId: player.teamId,
  }));
}

export function buildTeamSummaries(
  teams: TeamForSummary[],
  players: PlayerForSummary[],
) {
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    players: players
      .filter((player) => player.teamId === team.id)
      .map((player) => ({
        id: player.id,
        displayName: player.displayName,
        color: player.color,
      })),
  }));
}

export function buildSquareClaimSummaries(
  claims: SquareClaimForSummary[],
  teams: TeamForSummary[],
) {
  return claims.map((claim) => {
    const team = teams.find((team) => team.id === claim.player.teamId);

    return {
      squareId: claim.squareId,
      playerId: claim.playerId,
      playerName: claim.player.displayName,
      playerColor: claim.player.color,
      teamId: claim.player.teamId,
      teamName: team?.name ?? null,
      teamColor: team?.color ?? null,
      claimedAt: claim.claimedAt,
    };
  });
}

export function buildWinningResult(winningLineResult: WinningLineResult | null) {
  return {
    winner: winningLineResult !== null,
    winningLine: winningLineResult?.positions ?? null,
    winningLineType: winningLineResult?.type ?? null,
  };
}

export function buildLockoutWinningResult(
  winningOwnerResult: LockoutWinningOwnerResult | null,
) {
  return {
    winner: winningOwnerResult !== null,
    winningLine: null,
    winningLineType: null,
  };
}

export function buildWinningOwner(
  winningOwnerResult: LockoutWinningOwnerResult | null,
  players: PlayerForSummary[],
  teams: TeamForSummary[],
) {
  if (!winningOwnerResult) {
    return null;
  }

  const [ownerType, ownerId] = winningOwnerResult.ownerKey.split(":", 2);

  if (ownerType === "team") {
    const team = teams.find((team) => team.id === ownerId);

    return team
      ? {
          ownerKey: winningOwnerResult.ownerKey,
          type: "TEAM" as const,
          id: team.id,
          name: team.name,
          color: team.color,
        }
      : null;
  }

  const player = players.find((player) => player.id === ownerId);

  return player
    ? {
        ownerKey: winningOwnerResult.ownerKey,
        type: "PLAYER" as const,
        id: player.id,
        name: player.displayName,
        color: player.color,
      }
    : null;
}

export function getLockoutOwnerKey(claim: LockoutClaimForWinCheck) {
  return claim.player.teamId
    ? `team:${claim.player.teamId}`
    : `player:${claim.playerId}`;
}

export function getLockoutWinningOwnerResult(
  claims: LockoutClaimForWinCheck[],
  squares: SquareForWinCheck[],
): LockoutWinningOwnerResult | null {
  const requiredClaimCount = Math.floor(squares.length / 2) + 1;
  const squareIds = new Set(squares.map((square) => square.id));
  const squareIdsByOwner = new Map<string, string[]>();

  for (const claim of claims) {
    if (!squareIds.has(claim.squareId)) {
      continue;
    }

    const ownerKey = getLockoutOwnerKey(claim);
    const ownerSquareIds = squareIdsByOwner.get(ownerKey) ?? [];
    ownerSquareIds.push(claim.squareId);
    squareIdsByOwner.set(ownerKey, ownerSquareIds);

    if (ownerSquareIds.length >= requiredClaimCount) {
      return {
        ownerKey,
        claimedSquareIds: ownerSquareIds,
        claimCount: ownerSquareIds.length,
        requiredClaimCount,
      };
    }
  }

  return null;
}
