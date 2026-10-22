import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

test("committed create and join responses can be recovered after browser restart without duplicate membership", { timeout: 90000 }, async () => {
  const output=resolve(".jes/local/ewp-007/browser",String(Date.now())); await mkdir(output,{recursive:true}); console.log(`Admission recovery evidence: ${output}`);
  const app=buildApp(); let dropPath=""; let committed:any; let drops=0;
  app.addHook("onSend",async(request,reply,payload)=>{
    if(request.method==="POST"&&request.url===dropPath&&reply.statusCode<300) {
      committed=JSON.parse(String(payload)); drops++; reply.raw.destroy();
    }
    return payload;
  });
  const origin=await app.listen({port:0,host:"127.0.0.1"}); const results:any[]=[];
  const extensionPath=resolve("apps/extension/dist");
  try {
    for(const operation of ["create","join"] as const) {
      const profile=await mkdtemp(resolve(".local/wr-admission-"));let context:any;
      const launch=async()=>{
        context=await chromium.launchPersistentContext(profile,{channel:"chromium",headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
        const worker=context.serviceWorkers()[0]??await context.waitForEvent("serviceworker");const id=worker.url().split("/")[2];const page=await context.newPage();await page.goto(`chrome-extension://${id}/popup.html?view=board`);return page;
      };
      try {
        let page=await launch();await page.locator("#server-settings summary").click();await page.locator("#api-origin").fill(origin);await page.locator("#save-server").click();await expect(page.locator("#connection")).toContainText(origin);
        let gameId:string|undefined;
        if(operation==="join") {
          const host=(await app.inject({method:"POST",url:"/games",payload:{displayName:"Existing host"}})).json();gameId=host.gameId;
          await page.locator("#join-game-id").fill(gameId!);
        }
        await page.locator("#player-name").fill(`Recover ${operation}`);dropPath=operation==="create"?"/games":`/games/${gameId}/players`;
        await page.locator(operation==="create"?"#start":"#join-game-btn").click();
        await expect(page.locator("#retry-admission")).toBeVisible({timeout:15000});
        assert.ok(committed?.playerId,"The response was lost after a stored identity existed");
        const original={gameId:committed.gameId,playerId:committed.playerId};
        const countBefore=await prisma.player.count({where:{gameId:original.gameId}});
        const revisionBefore=(await prisma.game.findUniqueOrThrow({where:{id:original.gameId}})).revision;
        const pending=await page.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));
        assert.equal(pending.gameId,null);assert.equal(pending.pendingAdmission?.kind,operation);assert.ok(!JSON.stringify(pending).includes(committed.playerToken));
        await expect(page.locator("#start")).toBeDisabled();await expect(page.locator("#save-server")).toBeDisabled();
        await page.screenshot({path:resolve(output,`${operation}-pending.png`),fullPage:true});await context.close();context=null;dropPath="";
        page=await launch();await expect(page.locator("#retry-admission")).toBeVisible();
        await page.locator("#retry-admission").click();await expect(page.locator("#status")).toContainText("Mark Ready");
        const recovered=await page.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));assert.equal(recovered.gameId,original.gameId);assert.equal(recovered.playerId,original.playerId);assert.equal(recovered.pendingAdmission,undefined);
        assert.equal(await prisma.player.count({where:{gameId:original.gameId}}),countBefore);assert.equal((await prisma.game.findUniqueOrThrow({where:{id:original.gameId}})).revision,revisionBefore);
        await expect.poll(async()=>(await page.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}))).connection).toBe("live");
        await page.screenshot({path:resolve(output,`${operation}-recovered.png`),fullPage:true});results.push({operation,originalIdentityRecovered:true,unchangedPlayerCount:countBefore,unchangedRevision:revisionBefore,pendingSurvivedBrowserRestart:true});
        await page.locator("#end-game").click();
      } finally {await context?.close();await rm(profile,{recursive:true,force:true});}
    }
    assert.ok(drops>=2);await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,profile:"actual Chromium extension and committed HTTP response socket loss, PostgreSQL and WebSocket recovery",droppedCommittedResponses:drops,results},null,2));
  } finally {await app.close();await prisma.$disconnect();}
});

test("an older server is rejected before admission and a pending entry can be explicitly abandoned", {timeout:45000},async()=>{
  const app=buildApp();let posts=0;
  app.addHook("onRequest",async request=>{if(request.method==="POST")posts++;});
  app.addHook("onSend",async(request,_reply,payload)=>request.url==="/ready"?JSON.stringify({status:"ready",database:"connected"}):payload);
  const origin=await app.listen({port:0,host:"127.0.0.1"});const profile=await mkdtemp(resolve(".local/wr-legacy-admission-"));let context:any;
  try {
    const extensionPath=resolve("apps/extension/dist");context=await chromium.launchPersistentContext(profile,{channel:"chromium",headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});const worker=context.serviceWorkers()[0]??await context.waitForEvent("serviceworker");const page=await context.newPage();await page.goto(`chrome-extension://${worker.url().split("/")[2]}/popup.html?view=board`);
    await page.locator("#server-settings summary").click();await page.locator("#api-origin").fill(origin);await page.locator("#save-server").click();await page.locator("#start").click();await expect(page.locator("#status")).toContainText("server needs an update");assert.equal(posts,0);
    await page.locator("#retry-admission").click();await expect(page.locator("#status")).toContainText("server needs an update");assert.equal(posts,0);
    page.once("dialog",(dialog:any)=>dialog.dismiss());await page.locator("#forget-admission").click();await expect(page.locator("#retry-admission")).toBeVisible();
    page.once("dialog",(dialog:any)=>dialog.accept());await page.locator("#forget-admission").click();await expect(page.locator("#pending-entry")).toBeHidden();await expect(page.locator("#start")).toBeEnabled();await expect(page.locator("#save-server")).toBeEnabled();assert.equal(posts,0);
  }finally{await context?.close();await app.close();await prisma.$disconnect();await rm(profile,{recursive:true,force:true});}
});
