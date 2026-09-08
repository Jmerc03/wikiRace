import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

test("a late old-game response cannot replace a newly created extension session",{timeout:60000},async()=>{
  const output=resolve(".jes/local/ewp-005/recovery",String(Date.now()));await mkdir(output,{recursive:true});console.log(`Late response evidence: ${output}`);
  const profile=await mkdtemp(resolve(".local/wr-late-response-"));const app=buildApp();let heldGame:string|undefined;
  let release!:()=>void;const gate=new Promise<void>(done=>{release=done;});let entered!:()=>void;const intercepted=new Promise<void>(done=>{entered=done;});let holding=false;
  app.addHook("onSend",async(request,_reply,payload)=>{if(heldGame&&!holding&&request.method==="GET"&&request.url.startsWith(`/games/${heldGame}/state?`)){holding=true;entered();await gate;}return payload;});
  const origin=await app.listen({port:0,host:"127.0.0.1"});const extensionPath=resolve("apps/extension/dist");let context:any;
  try{
    context=await chromium.launchPersistentContext(profile,{channel:"chromium",headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});const worker=context.serviceWorkers()[0]??await context.waitForEvent("serviceworker");const id=worker.url().split("/")[2];const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html?view=board`);
    await popup.locator("#server-settings summary").click();await popup.locator("#api-origin").fill(origin);await popup.locator("#save-server").click();await expect(popup.locator("#connection")).toContainText(origin);
    await popup.locator("#start").click();await expect(popup.locator("#status")).toContainText("Lobby ready");const old=await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));
    await expect.poll(async()=>(await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}))).connection).toBe("live");
    heldGame=old.gameId;
    const late=popup.evaluate(()=>chrome.runtime.sendMessage({type:"SYNC_GAME_STATE"}));await intercepted;
    await popup.locator("#end-game").click();await expect(popup.locator("#status")).toContainText("Create a lobby");
    await popup.locator("#player-name").fill("New session owner");await popup.locator("#start").click();await expect(popup.locator("#status")).toContainText("Lobby ready");
    const fresh=await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));assert.notEqual(fresh.gameId,old.gameId);assert.notEqual(fresh.playerId,old.playerId);
    release();await late;
    await expect.poll(async()=>(await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}))).connection).toBe("live");
    const current=await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));assert.equal(current.gameId,fresh.gameId);assert.equal(current.playerId,fresh.playerId);assert.equal(current.playerName,"New session owner");assert.equal(current.board.id,fresh.board.id);assert.equal(current.error,undefined);
    assert.ok((await prisma.player.findUniqueOrThrow({where:{id:old.playerId}})).leftAt);assert.equal((await prisma.game.findUniqueOrThrow({where:{id:old.gameId}})).endReason,"EMPTY");
    await popup.screenshot({path:resolve(output,"new-session-after-stale-response.png"),fullPage:true});await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,profile:"actual Chromium extension, deliberately delayed actual API state response, real PostgreSQL/WebSockets",oldResponseArrivedAfterNewSession:true,newIdentityAndBoardPreserved:true,oldMembershipLeft:true},null,2));
  }finally{release();await context?.close();await app.close();await prisma.$disconnect();await rm(profile,{recursive:true,force:true});}
});
