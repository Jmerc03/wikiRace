export type WinningLineType = "ROW" | "COLUMN" | "DIAGONAL";

type BingoLine = {
  positions: number[];
  type: WinningLineType;
  index: number;
};

const BINGO_LINES: BingoLine[] = [
  { positions: [0, 1, 2, 3, 4], type: "ROW", index: 0 },
  { positions: [5, 6, 7, 8, 9], type: "ROW", index: 1 },
  { positions: [10, 11, 12, 13, 14], type: "ROW", index: 2 },
  { positions: [15, 16, 17, 18, 19], type: "ROW", index: 3 },
  { positions: [20, 21, 22, 23, 24], type: "ROW", index: 4 },

  { positions: [0, 5, 10, 15, 20], type: "COLUMN", index: 0 },
  { positions: [1, 6, 11, 16, 21], type: "COLUMN", index: 1 },
  { positions: [2, 7, 12, 17, 22], type: "COLUMN", index: 2 },
  { positions: [3, 8, 13, 18, 23], type: "COLUMN", index: 3 },
  { positions: [4, 9, 14, 19, 24], type: "COLUMN", index: 4 },

  { positions: [0, 6, 12, 18, 24], type: "DIAGONAL", index: 0 },
  { positions: [4, 8, 12, 16, 20], type: "DIAGONAL", index: 1 },
];

export type WinningLineResult = {
  positions: number[];
  type: WinningLineType;
  index: number;
};

export function getWinningLineResult(
  completedPositions: number[],
): WinningLineResult | null {
  const completed = new Set(completedPositions);
  const winningLine = BINGO_LINES.find((line) =>
    line.positions.every((position) => completed.has(position)),
  );

  if (!winningLine) {
    return null;
  }

  return {
    positions: winningLine.positions,
    type: winningLine.type,
    index: winningLine.index,
  };
}

export function getWinningLine(completedPositions: number[]): number[] | null {
  return getWinningLineResult(completedPositions)?.positions ?? null;
}

export function hasBingo(completedPositions: number[]): boolean {
  return getWinningLineResult(completedPositions) !== null;
}
