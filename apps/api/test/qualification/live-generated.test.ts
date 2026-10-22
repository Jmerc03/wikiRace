import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect, type BrowserContext } from "@playwright/test";
import { vitalArticles } from "../../../../packages/game-engine/src/vital-articles.js";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

after(()=>prisma.$disconnect());

function targetTitle(square:any){
  if(square.type==="VISIT_ARTICLE")return square.condition.title;
  if(square.type==="TITLE_CONTAINS")return ({science:"Science",history:"History",war:"War"} as any)[square.condition.text];
  if(square.type==="CATEGORY_CONTAINS")return ({science:"Science",history:"History",geography:"Geography",technology:"Technology"} as any)[square.condition.text];
  if(square.type==="TITLE_STARTS_WITH")return vitalArticles.find(article=>article.title.toLowerCase().startsWith(square.condition.letter.toLowerCase()))?.title;
  if(square.type==="LINK_COUNT_GREATER_THAN")return "Science";
  throw new Error(`Unknown objective ${square.type}`);
}

for(const mode of ["NORMAL","LOCKOUT"] as const)test(`an unmodified generated ${mode} board can be won through real Wikipedia`,{timeout:300000},async()=>{
  const output=resolve(".jes/local/ewp-005/live-generated",`${Date.now()}-${mode}`);await mkdir(output,{recursive:true});console.log(`Generated-board live evidence: ${output}`);
  const profile=await mkdtemp(resolve(".local/wr-live-generated-"));const app=buildApp();const origin=await app.listen({port:0,host:"127.0.0.1"});let context:BrowserContext|undefined;const observations:any[]=[];
  try{
    const extensionPath=resolve("apps/extension/dist");context=await chromium.launchPersistentContext(profile,{channel:"chromium",headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`],viewport:{width:1280,height:900}});
    const worker=context.serviceWorkers()[0]??await context.waitForEvent("serviceworker");const id=worker.url().split("/")[2];const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html?view=board`);
    await popup.locator("#server-settings summary").click();await popup.locator("#api-origin").fill(origin);await popup.locator("#save-server").click();await expect(popup.locator("#connection")).toContainText(origin);
    await popup.locator("#player-name").fill(`Live ${mode} player`);await popup.locator("#game-mode").selectOption(mode);await popup.locator("#difficulty").selectOption("MIXED");await popup.locator("#start").click();await expect(popup.locator("#status")).toContainText("Mark Ready");
    const initial=await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));await writeFile(resolve(output,"original-board.json"),JSON.stringify(initial.board,null,2));
    await popup.locator("#set-ready").click();await popup.locator("#start-match").click();const article=await context.newPage();
    const targets=mode==="NORMAL"?initial.board.squares.filter((square:any)=>square.position<5):initial.board.squares;
    for(const square of targets){
      const before=await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));if(before.winner)break;if(before.completedSquareIds.includes(square.id))continue;
      const title=targetTitle(square);assert.ok(title,`No qualification navigation candidate for ${square.label}`);
      const url=`https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ","_"))}`;const response=await article.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
      const heading=await article.locator("#firstHeading").textContent();const observation={squareId:square.id,type:square.type,label:square.label,targetTitle:title,requestedUrl:url,finalUrl:article.url(),heading,httpStatus:response?.status()};observations.push(observation);await writeFile(resolve(output,"observations.json"),JSON.stringify(observations,null,2));
      assert.ok(response?.ok(),JSON.stringify(observation));
      await expect.poll(async()=>{const result=await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));return result.completedSquareIds.includes(square.id);},{timeout:10000,message:JSON.stringify(observation)}).toBe(true);
      await delay(750); // Modest request cadence for the external service.
    }
    const final=await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));assert.equal(final.status,"FINISHED");assert.equal(final.winner,true);assert.equal(final.winningOwner.id,initial.playerId);
    await popup.screenshot({path:resolve(output,"actual-generated-board-winner.png"),fullPage:true});
    const stored=await prisma.board.findUniqueOrThrow({where:{gameId:initial.gameId},include:{squares:{orderBy:{position:"asc"}}}});assert.deepEqual(stored.squares.map(s=>({id:s.id,type:s.type,label:s.label,condition:s.condition})),initial.board.squares.map((s:any)=>({id:s.id,type:s.type,label:s.label,condition:s.condition})));
    await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,mode,boardUnmodified:true,actualWikipediaResponses:true,articleNavigations:observations.length,completedSquares:final.completedSquareIds.length,winningOwner:final.winningOwner,endReason:final.endReason,observations},null,2));
  }catch(error){await writeFile(resolve(output,"failure.json"),JSON.stringify({passed:false,mode,error:String(error),observations},null,2));throw error;}
  finally{await context?.close();await app.close();await rm(profile,{recursive:true,force:true});}
});
