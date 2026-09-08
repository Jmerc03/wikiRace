import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, type BrowserContext } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

test("a forcibly stopped extension worker recovers its saved game through the alarm",{timeout:150000},async()=>{
  const output=resolve(".jes/local/ewp-005/worker",String(Date.now()));await mkdir(output,{recursive:true});console.log(`Worker recovery evidence: ${output}`);
  const profile=await mkdtemp(resolve(".local/wr-worker-"));const app=buildApp();const origin=await app.listen({port:0,host:"127.0.0.1"});let context:BrowserContext|undefined;const events:any[]=[];
  try{
    const extensionPath=resolve("apps/extension/dist");context=await chromium.launchPersistentContext(profile,{channel:"chromium",headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});const worker=context.serviceWorkers()[0]??await context.waitForEvent("serviceworker");const id=worker.url().split("/")[2];
    const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html?view=board`);await popup.locator("#server-settings summary").click();await popup.locator("#api-origin").fill(origin);await popup.locator("#save-server").click();await expect(popup.locator("#connection")).toContainText(origin);
    await popup.locator("#start").click();await expect(popup.locator("#status")).toContainText("Lobby ready");const initial=await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));await expect.poll(()=>app.websocketServer.clients.size).toBe(1);
    const control=await context.newPage();const cdp=await context.newCDPSession(control);let versionId:string|undefined;
    cdp.on("ServiceWorker.workerVersionUpdated",event=>{events.push({time:new Date().toISOString(),versions:event.versions});const own=event.versions.find(version=>version.scriptURL.startsWith(`chrome-extension://${id}/`));if(own)versionId=own.versionId;});
    await cdp.send("ServiceWorker.enable");await expect.poll(()=>versionId).toBeTruthy();await popup.close();
    const stoppedAt=Date.now();await cdp.send("ServiceWorker.stopWorker",{versionId:versionId!});await expect.poll(()=>app.websocketServer.clients.size).toBe(0);
    // No runtime message, popup or Wikipedia navigation wakes the worker here.
    await expect.poll(()=>app.websocketServer.clients.size,{timeout:90000,intervals:[1000]}).toBe(1);
    const recoveredAfterSeconds=(Date.now()-stoppedAt)/1000;
    const restored=await context.newPage();await restored.goto(`chrome-extension://${id}/popup.html?view=board`);await expect(restored.locator("#status")).toContainText("Lobby ready");const current=await restored.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));assert.equal(current.gameId,initial.gameId);assert.equal(current.playerId,initial.playerId);assert.equal(current.apiOrigin,origin);assert.equal(current.connection,"live");
    await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,profile:"actual Chromium MV3 worker stopped through DevTools protocol; alarm recovery without an extension page or content-script wakeup",recoveredAfterSeconds,persistentIdentity:true,persistentOrigin:true,liveConnection:true,events},null,2));
  }catch(error){await writeFile(resolve(output,"failure.json"),JSON.stringify({passed:false,error:String(error),events},null,2));throw error;}
  finally{await context?.close();await app.close();await prisma.$disconnect();await rm(profile,{recursive:true,force:true});}
});
