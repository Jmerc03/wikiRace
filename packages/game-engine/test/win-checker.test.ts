import assert from "node:assert/strict";
import test from "node:test";
import {
  getWinningLine,
  getWinningLineResult,
  hasBingo,
} from "../src/win-checker.js";

const winningLines = [
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
] as const;

test("getWinningLineResult identifies every valid bingo line", () => {
  for (const line of winningLines) {
    assert.deepEqual(getWinningLineResult([...line.positions]), line);
  }
});

test("getWinningLineResult preserves the existing winning-line order", () => {
  const twoWinningRows = [
    ...winningLines[1].positions,
    ...winningLines[0].positions,
  ];

  assert.deepEqual(getWinningLineResult(twoWinningRows), winningLines[0]);
});

test("getWinningLineResult returns null for incomplete and unrelated positions", () => {
  assert.equal(getWinningLineResult([0, 1, 2, 3]), null);
  assert.equal(getWinningLineResult([0, 1, 2, 3, 5, 6, 7, 8]), null);
  assert.equal(getWinningLineResult([]), null);
});

test("duplicate positions do not create a bingo", () => {
  assert.equal(getWinningLineResult([0, 0, 0, 0, 0]), null);
});

test("getWinningLine returns positions for a win and null otherwise", () => {
  assert.deepEqual(getWinningLine([...winningLines[10].positions]), [
    ...winningLines[10].positions,
  ]);
  assert.equal(getWinningLine([0, 1, 2, 3]), null);
});

test("hasBingo reports whether any winning line is complete", () => {
  assert.equal(hasBingo([...winningLines[9].positions]), true);
  assert.equal(hasBingo([0, 1, 2, 3]), false);
});
