import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

// Explicit external-service profile. Never substitutes Wikipedia responses.
test("real Wikipedia article navigation is extracted and scored by the installed extension",{timeout:180000},async()=>{
  const output=resolve(".jes/local/ewp-005/live",String(Date.now()));await mkdir(output,{recursive:true});console.log(`Live Wikipedia evidence: ${output}`);
  const profile=await mkdtemp(resolve(".local/wr-live-"));const app=buildApp();const origin=await app.listen({port:0,host:"127.0.0.1"});
  const extensionPath=resolve("apps/extension/dist");let context:any;
  const startedAt=new Date().toISOString();
  try{
    context=await chromium.launchPersistentContext(profile,{channel:"chromium",headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`],viewport:{width:1280,height:900}});
    const worker=context.serviceWorkers()[0]??await context.waitForEvent("serviceworker");const id=worker.url().split("/")[2];
    const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html?view=board`);
    await popup.locator("#server-settings summary").click();await popup.locator("#api-origin").fill(origin);await popup.locator("#save-server").click();
    await expect(popup.locator("#connection")).toContainText(origin);
    await popup.locator("#player-name").fill("Live Wikipedia qualification");await popup.locator("#start").click();await expect(popup.locator("#status")).toContainText("Lobby ready");
    const initial=await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));
    const squares=await prisma.boardSquare.findMany({where:{board:{gameId:initial.gameId}}});
    for(const square of squares)await prisma.boardSquare.update({where:{id:square.id},data:{type:"VISIT_ARTICLE",label:square.position===0?"Visit Science":`Qualification control ${square.position}`,condition:{title:square.position===0?"Science":`Unmatched qualification ${square.position}`}}});
    await popup.locator("#start-match").click();await expect(popup.locator("#status")).toContainText("Match active");
    const article=await context.newPage();
    const response=await article.goto("https://en.wikipedia.org/wiki/Science",{waitUntil:"domcontentloaded",timeout:60000});
    assert.ok(response?.ok(),`Wikipedia HTTP status ${response?.status()}`);
    await expect(article.locator("#firstHeading")).toHaveText("Science");
    await expect(popup.locator("#progress")).toContainText("Your progress: 1/25",{timeout:20000});
    const event=await prisma.pageVisitEvent.findFirstOrThrow({where:{gameId:initial.gameId,playerId:initial.playerId,title:"Science"}});
    assert.equal(event.url,"https://en.wikipedia.org/wiki/Science");assert.ok(event.categories.length>0);assert.ok(event.links.length>100);
    assert.equal(await prisma.squareCompletion.count({where:{gameId:initial.gameId,playerId:initial.playerId}}),1);
    await article.screenshot({path:resolve(output,"real-wikipedia-science.png")});await popup.screenshot({path:resolve(output,"live-scored-board.png"),fullPage:true});
    await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,startedAt,finishedAt:new Date().toISOString(),profile:"actual Chromium extension, real Wikipedia network response, real local PostgreSQL/HTTP/WebSockets",articleUrl:event.url,httpStatus:response?.status(),extractedTitle:event.title,categoryCount:event.categories.length,linkCount:event.links.length,completionCount:1,syntheticNetworkResponses:false},null,2));
  }catch(error){await writeFile(resolve(output,"failure.json"),JSON.stringify({passed:false,startedAt,failedAt:new Date().toISOString(),error:String(error),syntheticNetworkResponses:false},null,2));throw error;}
  finally{await context?.close();await app.close();await prisma.$disconnect();await rm(profile,{recursive:true,force:true});}
});
