import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
process.env.PLAYWRIGHT_BROWSERS_PATH??=resolve(".local/browsers");
const {chromium,expect}=await import("@playwright/test");
const requireApi=createRequire(new URL("../apps/api/package.json",import.meta.url));const {PrismaClient}=requireApi("@prisma/client");
const config=JSON.parse(await readFile(".local/runtime.json","utf8"));assert.equal(config.port,4000,"This profile verifies the default quick-start port");
const owner=JSON.parse(await readFile(".local/api-owner.json","utf8"));const health=await (await fetch(`${owner.origin}/health`)).json();assert.equal(health.instanceId,owner.instanceId);
const db=new PrismaClient({datasourceUrl:config.databaseUrl});const originalCount=await db.game.count();
const output=resolve(".jes/local/ewp-006/operator-browser",String(Date.now()));await mkdir(output,{recursive:true});const profile=await mkdtemp(resolve(".local/wr-default-browser-"));let context;let gameId;
try{
 const extensionPath=resolve("apps/extension/dist");context=await chromium.launchPersistentContext(profile,{channel:"chromium",headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`],viewport:{width:1280,height:900}});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent("serviceworker");const id=worker.url().split("/")[2];const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);
 await popup.locator("#player-name").fill("Temporary operator browser check");await popup.locator("#start").click();await expect(popup.locator("#status")).toContainText("Lobby ready");
 const initial=await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));gameId=initial.gameId;assert.equal(initial.apiOrigin,"http://localhost:4000");
 const nextPage=context.waitForEvent("page");await popup.locator("#open-wikipedia").click();const article=await nextPage;await article.waitForLoadState("domcontentloaded");await expect(article.locator("#firstHeading")).not.toBeEmpty();
 assert.equal(new URL(article.url()).hostname,"en.wikipedia.org");assert.ok(!article.url().includes("Special:Random"));assert.equal(await db.pageVisitEvent.count({where:{gameId}}),0,"The waiting lobby must not score the open article");
 await article.bringToFront();await popup.evaluate(()=>document.getElementById("start-match").click());
 await expect.poll(()=>db.pageVisitEvent.count({where:{gameId}}),{timeout:20000}).toBeGreaterThan(0);
 const visit=await db.pageVisitEvent.findFirstOrThrow({where:{gameId}});assert.equal(visit.title,(await article.locator("#firstHeading").textContent()).trim());
 const fullPage=context.waitForEvent("page");await popup.locator("#open-board").click();const full=await fullPage;await expect(full.locator("body")).toHaveClass(/full-view/);await expect(full.locator(".square")).toHaveCount(25);
 const watchPage=context.waitForEvent("page");await popup.locator("#watch-game").click();const watch=await watchPage;await expect(watch.locator(".tile")).toHaveCount(25);assert.equal(new URL(watch.url()).origin,"http://localhost:4000");assert.equal(await db.player.count({where:{gameId}}),1);
 await full.screenshot({path:resolve(output,"default-extension-full-board.png"),fullPage:true});await watch.screenshot({path:resolve(output,"default-watch-shortcut.png"),fullPage:true});
 await popup.locator("#end-game").click();await expect(popup.locator("#status")).toContainText("Create a lobby");await expect(watch.locator("#notice")).toContainText("Everyone has left");
 const ended=await db.game.findUniqueOrThrow({where:{id:gameId}});assert.equal(ended.endReason,"EMPTY");
 await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,profile:"fresh actual Chromium extension using its unconfigured default origin against the managed operator API; real Wikipedia Special:Random navigation",defaultOrigin:initial.apiOrigin,randomArticleUrl:article.url(),randomArticleTitle:visit.title,waitingVisitNotScored:true,startingOnOpenArticleCaptured:true,fullBoardShortcut:true,watchShortcutReadOnly:true,leaveSynchronized:true},null,2));console.log(`Operator browser verification passed: ${output}`);
}catch(error){await writeFile(resolve(output,"failure.json"),JSON.stringify({passed:false,error:String(error)},null,2));throw error;}
finally{await context?.close();if(gameId)await db.game.delete({where:{id:gameId}});assert.equal(await db.game.count(),originalCount);await db.$disconnect();await rm(profile,{recursive:true,force:true});}
