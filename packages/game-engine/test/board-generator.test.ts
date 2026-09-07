import { test } from "node:test";
import assert from "node:assert/strict";
import { generateBoard } from "../src/board-generator.js";

test("all default difficulties produce complete distinct 5x5 boards repeatedly", () => {
  for (const difficulty of ["EASY", "MIXED", "HARD"] as const) {
    for (let attempt=0; attempt<20; attempt++) {
      const board = generateBoard({ difficulty, vitalArticleTileCount:15, genericTileCount:10, maxTilesPerTopic:3 });
      assert.equal(board.squares.length,25);
      assert.equal(new Set(board.squares.map(s=>s.id)).size,25);
      assert.equal(new Set(board.squares.map(s=>JSON.stringify([s.type,s.condition]))).size,25);
      assert.deepEqual(board.squares.map(s=>s.position),Array.from({length:25},(_,i)=>i));
    }
  }
});
test("all-generic board configurations remain complete and unique", () => {
  const board = generateBoard({difficulty:"MIXED",vitalArticleTileCount:0,genericTileCount:25,maxTilesPerTopic:3});
  assert.equal(board.squares.length,25);
  assert.equal(new Set(board.squares.map(s=>JSON.stringify([s.type,s.condition]))).size,25);
});
test("invalid counts and impossible topic limits fail explicitly instead of generating a partial board", () => {
  const config = {difficulty:"MIXED" as const,vitalArticleTileCount:15,genericTileCount:10,maxTilesPerTopic:3};
  for (const changes of [{genericTileCount:0},{vitalArticleTileCount:26,genericTileCount:-1},{maxTilesPerTopic:0},{genericTileCount:10.5},{vitalArticleTileCount:25,genericTileCount:0,maxTilesPerTopic:1}]) {
    assert.throws(()=>generateBoard({...config,...changes}),RangeError);
  }
});
