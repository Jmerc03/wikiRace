import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const app=buildApp();let origin:string;
const output=resolve(".jes/local/ewp-004/browser",String(Date.now()));
before(async()=>{await mkdir(output,{recursive:true});console.log(`Spectator evidence: ${output}`);origin=await app.listen({port:0,host:"127.0.0.1"});});
after(async()=>{await app.close();await prisma.$disconnect();});
const titles=["Science","Earth","History","Mathematics","Music","Physics","Astronomy","Biology","Chemistry","Philosophy","Language","Art","Technology","Geography","Ocean","Mountain","Forest","River","Architecture","Democracy","Literature","Agriculture","Energy","Medicine","Space"];
async function fixture(mode="NORMAL"){
  const created=await app.inject({method:"POST",url:"/games",payload:{mode,displayName:"Ada"}});assert.equal(created.statusCode,201);const host=created.json();
  for(const square of host.board.squares)await prisma.boardSquare.update({where:{id:square.id},data:{type:"VISIT_ARTICLE",label:`Visit ${titles[square.position]}`,condition:{title:titles[square.position]}}});
  const joined=await app.inject({method:"POST",url:`/games/${host.gameId}/players`,payload:{displayName:"<img src=x onerror=alert(1)>"}});const guest=joined.json();
  await app.inject({method:"POST",url:`/games/${host.gameId}/start`,headers:{authorization:`Bearer ${host.playerToken}`},payload:{playerId:host.playerId}});
  return {host,guest};
}
async function visit(player:any,position:number){const response=await app.inject({method:"POST",url:`/games/${player.gameId}/events/page-visit`,headers:{authorization:`Bearer ${player.playerToken}`},payload:{playerId:player.playerId,title:titles[position],url:`https://en.wikipedia.org/wiki/${titles[position]}`}});assert.equal(response.statusCode,200,response.body);}

test("spectator UI follows selected progress, updates live, renders names safely and offers transparent OBS view",{timeout:60000},async()=>{
  const {host,guest}=await fixture();
  await visit(host,0);await visit(host,1);await visit(guest,2);
  const beforeCount=await prisma.player.count({where:{gameId:host.gameId}});
  const browser=await chromium.launch({channel:"chromium",headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},permissions:["clipboard-read","clipboard-write"]});
  const page=await context.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("dialog",async d=>{errors.push("Unexpected dialog: "+d.message());await d.dismiss();});
  try{
    await page.goto(`${origin}/spectate/${host.gameId}`);
    await expect(page.locator(".tile")).toHaveCount(25);
    await expect(page.locator(".tile.completed")).toHaveCount(2);
    await expect(page.locator("#scoreboard")).toContainText("<img src=x onerror=alert(1)>");
    assert.equal(await page.locator("#scoreboard img").count(),0);
    await page.selectOption("#follow-player",guest.playerId);
    await expect(page.locator(".tile.completed")).toHaveCount(1);
    await visit(guest,3);
    await expect(page.locator(".tile.completed")).toHaveCount(2);
    await page.screenshot({path:resolve(output,"normal-spectator.png"),fullPage:true});
    await page.locator("#copy-overlay").click();
    await expect(page.locator("#notice")).toContainText("OBS browser-source URL copied");
    const link=await page.evaluate(()=>navigator.clipboard.readText());
    assert.equal(link,`${origin}/overlay/${host.gameId}?playerId=${guest.playerId}`);
    const overlay=await context.newPage();await overlay.goto(link);
    await expect(overlay.locator(".tile")).toHaveCount(25);
    await expect(overlay.locator(".viewer-tools")).toBeHidden();
    assert.equal(await overlay.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),"rgba(0, 0, 0, 0)");
    assert.equal(await overlay.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),true,"OBS layout must fit the viewport");
    await overlay.screenshot({path:resolve(output,"obs-overlay.png"),omitBackground:true});
    assert.equal(await prisma.player.count({where:{gameId:host.gameId}}),beforeCount);
    assert.equal(await prisma.pageVisitEvent.count({where:{gameId:host.gameId}}),4);
    assert.equal(errors.length,0,errors.join("\n"));
    await writeFile(resolve(output,"spectator-result.json"),JSON.stringify({profile:"actual Chromium; fixture gameplay through actual API/PostgreSQL",readOnly:true,selectedNormalProgress:true,liveUpdates:true,userNamesRenderedAsText:true,transparentOverlay:true,consoleErrors:errors},null,2));
  }finally{await browser.close();}
});

test("operator landing, extension archive, unavailable game and Lockout winner views work",{timeout:60000},async()=>{
  const {host}=await fixture("LOCKOUT");
  for(let i=0;i<13;i++)await visit(host,i);
  const browser=await chromium.launch({channel:"chromium",headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});
  try{
    await page.goto(origin);await expect(page.locator("#connection")).toHaveText("Server ready");
    await expect(page.locator("#home h1")).toContainText("A race through");
    await page.screenshot({path:resolve(output,"operator-home.png"),fullPage:true});
    const archive=await app.inject({url:"/downloads/wikirace-extension.zip"});assert.equal(archive.statusCode,200,archive.body.slice(0,100));
    const files=unzipSync(archive.rawPayload);assert.deepEqual(Object.keys(files).sort(),["background.js","content.js","manifest.json","popup.html","popup.js"]);
    assert.equal(JSON.parse(new TextDecoder().decode(files["manifest.json"])).manifest_version,3);
    await page.goto(`${origin}/spectate/${host.gameId}`);await expect(page.locator("#notice")).toContainText("Ada won by majority");await expect(page.locator(".tile.completed")).toHaveCount(13);
    await expect(page.locator("#follow-player")).toBeHidden();
    await page.screenshot({path:resolve(output,"lockout-spectator.png"),fullPage:true});
    await page.goto(`${origin}/spectate/00000000-0000-4000-8000-000000000000`);
    await expect(page.locator("#notice")).toContainText("Game not found");
    await expect(page.locator("#match-title")).toContainText("unavailable");
  }finally{await browser.close();}
});

test("full rosters and long labels remain readable in the fixed OBS viewport and mobile spectator",{timeout:60000},async()=>{
  const {host}=await fixture();
  for(let i=2;i<32;i++){const response=await app.inject({method:"POST",url:`/games/${host.gameId}/players`,payload:{displayName:`Player ${i} with a deliberately long name`}});assert.equal(response.statusCode,200);}
  await visit(host,0);
  const longLabel="Visit International Covenant on Economic, Social and Cultural Rights";
  await prisma.boardSquare.updateMany({where:{board:{gameId:host.gameId}},data:{label:longLabel}});
  const browser=await chromium.launch({channel:"chromium",headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}});
  try{
    await page.goto(`${origin}/overlay/${host.gameId}`);await expect(page.locator(".tile")).toHaveCount(25);
    const clipped=await page.locator(".tile").evaluateAll(tiles=>tiles.some(tile=>{
      const box=tile.getBoundingClientRect();
      return [...tile.querySelectorAll(".tile-label,.tile-owner")].some(text=>{const rect=text.getBoundingClientRect();return rect.top<box.top+18||rect.bottom>box.bottom-4;});
    }));assert.equal(clipped,false,"Objective and ownership text must fit below the tile number and inside each OBS tile");
    await page.screenshot({path:resolve(output,"full-roster-overlay.png"),omitBackground:true});
    await page.setViewportSize({width:390,height:844});await page.goto(`${origin}/spectate/${host.gameId}`);await expect(page.locator(".score-card")).toHaveCount(32);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,"Mobile spectator must not scroll horizontally");
    await page.screenshot({path:resolve(output,"mobile-spectator.png"),fullPage:true});
  }finally{await browser.close();}
});
