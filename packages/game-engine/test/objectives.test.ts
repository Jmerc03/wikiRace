import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSquare } from "../src/game-engine.js";
import type { BoardSquare, PageVisitEvent } from "@bingo/shared";

const event:PageVisitEvent={playerId:"fixture",title:"History of Science",url:"https://en.wikipedia.org/wiki/History_of_science",categories:["History of science","Science and technology"],links:Array.from({length:51},(_,i)=>`/wiki/Article_${i}`)};
const square=(type:BoardSquare["type"],condition:Record<string,unknown>):BoardSquare=>({id:"objective",position:0,type,condition,label:"Objective",difficulty:"EASY"});
test("article objectives distinguish exact titles, substrings, prefixes, categories and strict link thresholds",()=>{
  assert.equal(evaluateSquare(square("VISIT_ARTICLE",{title:"HISTORY OF SCIENCE"}),event),true);
  assert.equal(evaluateSquare(square("VISIT_ARTICLE",{title:"Science"}),event),false,"Exact article objectives must not match a substring");
  assert.equal(evaluateSquare(square("TITLE_CONTAINS",{text:"SCIENCE"}),event),true);
  assert.equal(evaluateSquare(square("TITLE_CONTAINS",{text:"geography"}),event),false);
  assert.equal(evaluateSquare(square("TITLE_STARTS_WITH",{letter:"h"}),event),true);
  assert.equal(evaluateSquare(square("TITLE_STARTS_WITH",{letter:"S"}),event),false,"A later word is not the title prefix");
  assert.equal(evaluateSquare(square("CATEGORY_CONTAINS",{text:"TECHNOLOGY"}),event),true);
  assert.equal(evaluateSquare(square("CATEGORY_CONTAINS",{text:"Science"}),{...event,categories:[]}),false,"The title alone cannot satisfy a category objective");
  assert.equal(evaluateSquare(square("LINK_COUNT_GREATER_THAN",{count:50}),event),true);
  assert.equal(evaluateSquare(square("LINK_COUNT_GREATER_THAN",{count:51}),event),false,"Greater-than excludes the exact boundary");
});
