import { test } from "node:test";
import assert from "node:assert/strict";
import { generateBoard, getBoardSetupOptions } from "../src/board-generator.js";
import { vitalArticles } from "../src/vital-articles.js";

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

test("every mix, difficulty and topic limit matches advertised capacity, distinctness and article eligibility", () => {
  const options = getBoardSetupOptions();
  let generated = 0; let rejected = 0;
  for (const difficulty of ["EASY", "MIXED", "HARD"] as const) {
    const eligible = new Map<string, typeof vitalArticles[number]>();
    for (const article of vitalArticles) {
      if (difficulty === "EASY" && article.level > 3 || difficulty === "HARD" && article.level < 3) continue;
      const title = article.title.trim().toLocaleLowerCase("en");
      if (!eligible.has(title)) eligible.set(title, article);
    }
    for (let cap = 1; cap <= 25; cap++) for (let count = 0; count <= 25; count++) {
      const config = { difficulty, vitalArticleTileCount: count, genericTileCount: 25 - count, maxTilesPerTopic: cap };
      if (count > options.articleCapacities[difficulty][cap - 1]) { assert.throws(() => generateBoard(config), RangeError); rejected++; continue; }
      const board = generateBoard(config); generated++;
      assert.equal(board.squares.length, 25);
      assert.equal(new Set(board.squares.map(s => JSON.stringify([s.type, s.condition]))).size, 25);
      assert.equal(new Set(board.squares.map(s => s.id)).size, 25);
      assert.deepEqual(board.squares.map(s => s.position), Array.from({ length: 25 }, (_, i) => i));
      const topics = new Map<string, number>();
      const named = board.squares.filter(s => s.type === "VISIT_ARTICLE"); assert.equal(named.length, count);
      for (const square of named) {
        const article = eligible.get(String(square.condition.title).trim().toLocaleLowerCase("en")); assert.ok(article);
        const topic = article.topic ?? "Unknown"; topics.set(topic, (topics.get(topic) ?? 0) + 1);
      }
      assert.ok([...topics.values()].every(n => n <= cap));
    }
  }
  assert.equal(generated + rejected, 1950);
  assert.equal(generated, 1899); assert.equal(rejected, 51);
});
