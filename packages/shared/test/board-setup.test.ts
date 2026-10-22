import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BOARD_CONFIG, boardConfigSummary, boardSetupIssue } from "../src/board-setup.js";

test("board summaries explain named-only settings, singular counts and older records", () => {
  assert.equal(boardConfigSummary(DEFAULT_BOARD_CONFIG), "15 named articles · 10 flexible objectives · Mixed articles · Up to 3 per topic");
  assert.match(boardConfigSummary({ ...DEFAULT_BOARD_CONFIG, vitalArticleTileCount: 0, genericTileCount: 25 }), /Article difficulty and topic limits do not apply/);
  assert.match(boardConfigSummary({ ...DEFAULT_BOARD_CONFIG, vitalArticleTileCount: 1, genericTileCount: 24, maxTilesPerTopic: 25 }), /1 named article · 24 flexible objectives · Mixed articles · No topic limit/);
  assert.match(boardConfigSummary(null), /older match/);
});

test("setup validation respects the selected server's capacities and rejects malformed counts", () => {
  const capacities = [11, 22, ...Array(23).fill(25)];
  const options = { articleCapacities: { EASY: capacities, MIXED: capacities, HARD: capacities.map(n => Math.min(n, 7)) } };
  assert.equal(boardSetupIssue(DEFAULT_BOARD_CONFIG, options), null);
  assert.match(boardSetupIssue({ ...DEFAULT_BOARD_CONFIG, maxTilesPerTopic: 1 }, options)!, /up to 11/);
  assert.match(boardSetupIssue({ ...DEFAULT_BOARD_CONFIG, difficulty: "HARD" }, options)!, /up to 7/);
  for (const changes of [{ vitalArticleTileCount: 0 }, { vitalArticleTileCount: -1, genericTileCount: 26 }, { vitalArticleTileCount: 14.5, genericTileCount: 10.5 }, { maxTilesPerTopic: 0 }, { maxTilesPerTopic: 26 }])
    assert.ok(boardSetupIssue({ ...DEFAULT_BOARD_CONFIG, ...changes }, options));
});
