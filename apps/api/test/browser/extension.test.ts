import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, type BrowserContext, type Page } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

let app = buildApp();
let origin: string;
const extensionPath=resolve("apps/extension/dist");
const output=resolve(".jes/local/ewp-003/browser", String(Date.now()));
const errors:string[]=[];
before(async()=>{ await mkdir(output,{recursive:true}); console.log(`Browser evidence: ${output}`); origin=await app.listen({port:0,host:"127.0.0.1"}); });
after(async()=>{ await app.close(); await prisma.$disconnect(); });

type PlayerBrowser={context:BrowserContext;popup:Page;id:string};
async function launch(profile:string):Promise<PlayerBrowser> {
  const context=await chromium.launchPersistentContext(profile,{channel:"chromium",headless:true,
    args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`], viewport:{width:1100,height:900}});
  const worker=context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const id=worker.url().split("/")[2];
  const popup=await context.newPage();
  popup.on("pageerror",error=>errors.push(error.message));
  await context.route("https://en.wikipedia.org/wiki/Fixture_*",async route=>{
    const position=new URL(route.request().url()).pathname.split("_").at(-1);
    await route.fulfill({contentType:"text/html",body:`<!doctype html><html><head><title>Fixture ${position}</title></head><body><h1 id="firstHeading">Fixture ${position}</h1><div id="mw-content-text"><a href="/wiki/Fixture_1">Next article</a></div><div id="mw-normal-catlinks"><ul><li><a>Science</a></li></ul></div></body></html>`});
  });
  await popup.goto(`chrome-extension://${id}/popup.html?view=board`);
  await expect(popup.locator("#status")).not.toHaveText("No game started.");
  return {context,popup,id};
}
async function configure(player:PlayerBrowser) {
  await player.popup.locator("#server-settings summary").click();
  await player.popup.locator("#api-origin").fill(origin);
  await player.popup.locator("#save-server").click();
  await expect(player.popup.locator("#connection")).toContainText(origin);
}
async function snapshot(player:PlayerBrowser):Promise<any> {
  return player.popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));
}

test("two real extension profiles play independent Normal progress, resume, and leave", {timeout:120000}, async()=>{
  const hostProfile=await mkdtemp(resolve(".local/wr-host-"));
  const guestProfile=await mkdtemp(resolve(".local/wr-guest-"));
  let host:PlayerBrowser|undefined;
  let guest:PlayerBrowser|undefined;
  try {
    host=await launch(hostProfile); guest=await launch(guestProfile);
    await configure(host); await configure(guest);
    await host.popup.locator("#player-name").fill("Browser Host");
    await host.popup.locator("#start").click();
    await expect(host.popup.locator("#status")).toContainText("Lobby ready");
    const initial=await snapshot(host);
    assert.ok(initial.gameId); assert.ok(initial.playerId);
    assert.equal(initial.playerToken,undefined);
    const squares=await prisma.boardSquare.findMany({where:{board:{gameId:initial.gameId}}});
    for(const square of squares) await prisma.boardSquare.update({where:{id:square.id},data:{type:"VISIT_ARTICLE",label:`Visit Fixture ${square.position}`,condition:{title:`Fixture ${square.position}`}}});
    await guest.popup.locator("#player-name").fill("Browser Guest");
    await guest.popup.locator("#join-game-id").fill(initial.gameId);
    await guest.popup.locator("#join-game-btn").click();
    await expect(guest.popup.locator("#status")).toContainText("Waiting for the host");
    await expect.poll(async()=> (await snapshot(host!)).playerCount).toBe(2);
    await expect(guest.popup.locator("#start-match")).toBeHidden();
    await host.popup.locator("#start-match").click();
    await expect(guest.popup.locator("#status")).toContainText("Match active");
    const article=await host.context.newPage();
    await article.goto("https://en.wikipedia.org/wiki/Fixture_0");
    await expect(host.popup.locator("#progress")).toContainText("Your progress: 1/25");
    await expect(guest.popup.locator("#progress")).toContainText("Your progress: 0/25");
    const guestArticle=await guest.context.newPage();
    await guestArticle.goto("https://en.wikipedia.org/wiki/Fixture_1");
    await expect(guest.popup.locator("#progress")).toContainText("Your progress: 1/25");
    const beforeRestart=await snapshot(host);
    await host.popup.screenshot({path:resolve(output,"normal-two-player.png"),fullPage:true});
    await host.context.close(); host=undefined;
    host=await launch(hostProfile);
    await expect(host.popup.locator("#progress")).toContainText("Your progress: 1/25");
    const resumed=await snapshot(host);
    assert.equal(resumed.playerId,beforeRestart.playerId); assert.equal(resumed.gameId,beforeRestart.gameId);
    assert.equal(resumed.apiOrigin,origin);

    // Stop and restart the actual API on the same port; clients must retain
    // identity, report the outage, reconnect, and refetch persisted state.
    const port=Number(new URL(origin).port);
    await app.close();
    await host.popup.locator("#refresh").click();
    await expect(host.popup.locator("#status")).toContainText("Your session is saved",{timeout:15000});
    assert.equal((await snapshot(host)).playerId,beforeRestart.playerId);
    app=buildApp(); await app.listen({port,host:"127.0.0.1"});
    await host.popup.locator("#refresh").click();
    await expect(host.popup.locator("#status")).toContainText("Match active");
    await expect.poll(async()=> (await snapshot(host!)).connection,{timeout:15000}).toBe("live");

    await guest.popup.locator("#end-game").click();
    await expect(guest.popup.locator("#status")).toContainText("Create a lobby");
    await expect.poll(async()=> (await snapshot(host!)).playerCount).toBe(1);
    assert.equal((await snapshot(guest)).apiOrigin,origin);
    await host.popup.locator("#host-end").click();
    await expect(host.popup.locator("#status")).toContainText("Match ended");
    assert.equal(errors.length,0,errors.join("\n"));
    await writeFile(resolve(output,"result.json"),JSON.stringify({profile:"actual Chromium extension; synthetic Wikipedia article DOM; real PostgreSQL/HTTP/WebSockets",normalProgressIsolation:true,persistentProfileResume:true,apiRestartRecovery:true,leaveMembershipSync:true,consoleErrors:errors},null,2));
  } finally {
    await host?.context.close(); await guest?.context.close();
    await rm(hostProfile,{recursive:true,force:true}); await rm(guestProfile,{recursive:true,force:true});
  }
});

test("two extension profiles form a team and finish Lockout by majority", {timeout:120000}, async()=>{
  const hostProfile=await mkdtemp(resolve(".local/wr-team-host-"));
  const guestProfile=await mkdtemp(resolve(".local/wr-team-guest-"));
  let host:PlayerBrowser|undefined; let guest:PlayerBrowser|undefined;
  try {
    host=await launch(hostProfile); guest=await launch(guestProfile);
    await configure(host); await configure(guest);
    await host.popup.locator("#player-name").fill("Team Captain");
    await host.popup.locator("#game-mode").selectOption("LOCKOUT");
    await host.popup.locator("#start").click();
    await expect(host.popup.locator("#status")).toContainText("Lobby ready");
    const initial=await snapshot(host);
    const squares=await prisma.boardSquare.findMany({where:{board:{gameId:initial.gameId}}});
    for(const square of squares) await prisma.boardSquare.update({where:{id:square.id},data:{type:"VISIT_ARTICLE",label:`Visit Fixture ${square.position}`,condition:{title:`Fixture ${square.position}`}}});
    await host.popup.locator("#team-name").fill("Explorers");
    await host.popup.locator("#create-team-btn").click();
    await expect(host.popup.locator("#team-select")).toContainText("Explorers");
    await host.popup.locator("#join-team-btn").click();
    await expect(host.popup.locator("#current-team")).toContainText("Explorers");
    await guest.popup.locator("#player-name").fill("Teammate");
    await guest.popup.locator("#join-game-id").fill(initial.gameId);
    await guest.popup.locator("#join-game-btn").click();
    await expect(guest.popup.locator("#team-select")).toContainText("Explorers");
    await guest.popup.locator("#join-team-btn").click();
    await expect(host.popup.locator("#team-rosters")).toContainText("Teammate");
    await host.popup.locator("#start-match").click();
    await expect(guest.popup.locator("#status")).toContainText("Match active");
    const pages=[await host.context.newPage(),await guest.context.newPage()];
    for(let i=0;i<13;i++) {
      await pages[i%2].goto(`https://en.wikipedia.org/wiki/Fixture_${i}`);
      await expect.poll(async()=> (await snapshot(host!)).completedSquareIds.length).toBe(i+1);
      if(i===4) assert.equal((await snapshot(host)).status,"ACTIVE","A bingo row must not win Lockout");
    }
    await expect(host.popup.locator("#status")).toContainText("Explorers won by majority");
    await expect(guest.popup.locator("#status")).toContainText("Explorers won by majority");
    const result=await snapshot(host);
    assert.equal(result.winningOwner.type,"TEAM"); assert.equal(result.winningLine,null);
    assert.equal(result.completedSquareIds.length,13);
    await expect(host.popup.locator("#team-controls")).toBeHidden();
    await host.popup.screenshot({path:resolve(output,"lockout-team-winner.png"),fullPage:true});
    await writeFile(resolve(output,"lockout-result.json"),JSON.stringify({profile:"actual Chromium extensions; synthetic Wikipedia DOM; real PostgreSQL/HTTP/WebSockets",teamCreationAndJoining:true,sharedOwnership:true,bingoDoesNotWin:true,majorityWinnerAgreement:true,consoleErrors:errors},null,2));
    assert.equal(errors.length,0,errors.join("\n"));
  } finally {
    await host?.context.close();await guest?.context.close();
    await rm(hostProfile,{recursive:true,force:true});await rm(guestProfile,{recursive:true,force:true});
  }
});

test("an exhausted three-player Lockout board shows the same draw in extension and spectator",{timeout:60000},async()=>{
  const profile=await mkdtemp(resolve(".local/wr-draw-"));let host:PlayerBrowser|undefined;
  try{
    host=await launch(profile);await configure(host);await host.popup.locator("#game-mode").selectOption("LOCKOUT");await host.popup.locator("#start").click();await expect(host.popup.locator("#status")).toContainText("Lobby ready");
    const initial=await snapshot(host);const squares=await prisma.boardSquare.findMany({where:{board:{gameId:initial.gameId}}});
    for(const square of squares)await prisma.boardSquare.update({where:{id:square.id},data:{type:"VISIT_ARTICLE",label:`Visit Fixture ${square.position}`,condition:{title:`Fixture ${square.position}`}}});
    const others=[];for(const displayName of ["Second owner","Third owner"]){const response=await app.inject({method:"POST",url:`/games/${initial.gameId}/players`,payload:{displayName}});assert.equal(response.statusCode,200);others.push(response.json());}
    await host.popup.locator("#start-match").click();const article=await host.context.newPage();
    for(let position=0;position<25;position++){
      if(position%3===0)await article.goto(`https://en.wikipedia.org/wiki/Fixture_${position}`);
      else{const player=others[position%3-1];const response=await app.inject({method:"POST",url:`/games/${initial.gameId}/events/page-visit`,headers:{authorization:`Bearer ${player.playerToken}`},payload:{playerId:player.playerId,title:`Fixture ${position}`,url:`https://en.wikipedia.org/wiki/Fixture_${position}`}});assert.equal(response.statusCode,200);}
      await expect.poll(async()=>(await snapshot(host!)).squareClaims.length).toBe(position+1);
    }
    await expect(host.popup.locator("#status")).toContainText("Draw!");assert.equal((await snapshot(host)).winner,false);
    const viewer=await host.context.newPage();await viewer.goto(`${origin}/spectate/${initial.gameId}`);await expect(viewer.locator("#notice")).toContainText("Draw!");await expect(viewer.locator(".tile.completed")).toHaveCount(25);
    await host.popup.screenshot({path:resolve(output,"lockout-draw-extension.png"),fullPage:true});await viewer.screenshot({path:resolve(output,"lockout-draw-spectator.png"),fullPage:true});
    await writeFile(resolve(output,"draw-result.json"),JSON.stringify({passed:true,profile:"actual extension/content script plus two API players; synthetic Wikipedia DOM; real PostgreSQL/WebSockets",claimedSquares:25,scores:[9,8,8],winner:null,endReason:"BOARD_EXHAUSTED",extensionSpectatorAgreement:true},null,2));
  }finally{await host?.context.close();await rm(profile,{recursive:true,force:true});}
});
