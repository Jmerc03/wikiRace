import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect, type BrowserContext } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const durationSeconds=Number(process.env.WIKIRACE_ENDURANCE_SECONDS??300);
if(!Number.isFinite(durationSeconds)||durationSeconds<90||durationSeconds>3600)throw new Error("Endurance duration must be 90–3600 seconds");

test("closed-popup extension survives idle periods and API restart while a spectator stays consistent",{timeout:(durationSeconds+90)*1000},async()=>{
  const output=resolve(".jes/local/ewp-005/endurance",String(Date.now()));await mkdir(output,{recursive:true});console.log(`Endurance evidence: ${output}`);
  const profile=await mkdtemp(resolve(".local/wr-endurance-"));let app=buildApp();let origin=await app.listen({port:0,host:"127.0.0.1"});
  const port=Number(new URL(origin).port);let context:BrowserContext|undefined;
  const connections:{openedAt:string;closedAt?:string;closeCode?:number;closeReason?:string;lastPingAt?:string;lastPongAt?:string;errors:string[]}[]=[];
  const trackConnections=()=>app.websocketServer.on("connection",socket=>{
    const record:typeof connections[number]={openedAt:new Date().toISOString(),errors:[]};connections.push(record);
    socket.on("ping",()=>{record.lastPingAt=new Date().toISOString();});
    socket.on("pong",()=>{record.lastPongAt=new Date().toISOString();});
    socket.on("error",error=>{record.errors.push(String(error));});
    socket.on("close",(code,reason)=>{record.closedAt=new Date().toISOString();record.closeCode=code;record.closeReason=reason.toString();});
  });trackConnections();
  const samples:any[]=[];const startedAt=Date.now();let restarted=false;
  try{
    const extensionPath=resolve("apps/extension/dist");
    context=await chromium.launchPersistentContext(profile,{channel:"chromium",headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`],viewport:{width:1280,height:900}});
    const worker=context.serviceWorkers()[0]??await context.waitForEvent("serviceworker");const id=worker.url().split("/")[2];
    const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html?view=board`);
    await popup.locator("#server-settings summary").click();await popup.locator("#api-origin").fill(origin);await popup.locator("#save-server").click();await expect(popup.locator("#connection")).toContainText(origin);
    await popup.locator("#player-name").fill("Endurance host");await popup.locator("#start").click();await expect(popup.locator("#status")).toContainText("Mark Ready");
    const initial=await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));
    const squares=await prisma.boardSquare.findMany({where:{board:{gameId:initial.gameId}}});for(const square of squares)await prisma.boardSquare.update({where:{id:square.id},data:{type:"VISIT_ARTICLE",condition:{title:`Never matched control ${square.position}`}}});
    const joined=await app.inject({method:"POST",url:`/games/${initial.gameId}/players`,payload:{displayName:"Periodic visitor"}});assert.equal(joined.statusCode,200);const guest=joined.json();
    const ready=await app.inject({method:"POST",url:`/games/${initial.gameId}/ready`,headers:{authorization:`Bearer ${guest.playerToken}`},payload:{playerId:guest.playerId,isReady:true}});assert.equal(ready.statusCode,200,ready.body);
    await popup.locator("#set-ready").click();await popup.locator("#start-match").click();await expect(popup.locator("#status")).toContainText("Match active");await expect.poll(async()=>(await popup.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}))).connection).toBe("live");
    await popup.close(); // No extension page remains open through the idle windows.
    const spectator=await context.newPage();await spectator.goto(`${origin}/spectate/${initial.gameId}`);await expect(spectator.locator(".tile")).toHaveCount(25);
    let sequence=0;
    while(Date.now()-startedAt<durationSeconds*1000){
      await delay(Math.min(45000,Math.max(1,durationSeconds*1000-(Date.now()-startedAt))));
      if(!restarted&&Date.now()-startedAt>durationSeconds*500){
        await app.close();await delay(5000);app=buildApp();origin=await app.listen({port,host:"127.0.0.1"});trackConnections();restarted=true;
        await expect.poll(()=>app.websocketServer.clients.size,{timeout:20000}).toBeGreaterThanOrEqual(2);
      }
      const response=await app.inject({method:"POST",url:`/games/${initial.gameId}/events/page-visit`,headers:{authorization:`Bearer ${guest.playerToken}`},payload:{playerId:guest.playerId,title:`Endurance observation ${++sequence}`,url:`https://en.wikipedia.org/wiki/Endurance_${sequence}`,categories:[],links:[]}});assert.equal(response.statusCode,200,response.body);
      const state=response.json();assert.equal(state.status,"ACTIVE");assert.equal(state.completedSquareIds.length,0);
      assert.ok(app.websocketServer.clients.size>=2,"Both idle extension and spectator must have live sockets");
      assert.equal(await spectator.locator(".tile.completed").count(),0);
      const sample={elapsedSeconds:Math.round((Date.now()-startedAt)/1000),revision:state.revision,visits:sequence,activeSockets:app.websocketServer.clients.size,totalConnections:connections.length,restarted,apiHeapBytes:process.memoryUsage().heapUsed};samples.push(sample);
      await writeFile(resolve(output,"progress.json"),JSON.stringify({startedAt:new Date(startedAt).toISOString(),requestedDurationSeconds:durationSeconds,samples,connections},null,2));console.log(JSON.stringify(sample));
    }
    const restored=await context.newPage();await restored.goto(`chrome-extension://${id}/popup.html?view=board`);await expect(restored.locator("#status")).toContainText("Match active");
    const current=await restored.evaluate(()=>chrome.runtime.sendMessage({type:"GET_GAME_STATE"}));const game=await prisma.game.findUniqueOrThrow({where:{id:initial.gameId}});
    assert.equal(current.playerId,initial.playerId);assert.equal(current.gameId,initial.gameId);assert.equal(current.revision,game.revision);assert.equal(current.connection,"live");
    assert.equal(await prisma.pageVisitEvent.count({where:{gameId:initial.gameId}}),sequence);assert.equal(await prisma.squareCompletion.count({where:{gameId:initial.gameId}}),0);
    // Exactly two sockets per API lifetime: no unexplained reconnects during idle.
    assert.equal(connections.length,4,"Only the deliberate API restart should replace extension/spectator sockets");
    await restored.screenshot({path:resolve(output,"after-endurance.png"),fullPage:true});
    await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,startedAt:new Date(startedAt).toISOString(),finishedAt:new Date().toISOString(),elapsedSeconds:(Date.now()-startedAt)/1000,requestedDurationSeconds:durationSeconds,extensionPopupClosedDuringIdle:true,persistentIdentity:true,apiRestartRecovered:restarted,committedVisits:sequence,finalRevision:game.revision,unexpectedReconnects:0,connections,samples,profile:"actual Chromium extension and spectator; synthetic local page events; real PostgreSQL/HTTP/WebSockets"},null,2));
  }catch(error){await writeFile(resolve(output,"failure.json"),JSON.stringify({passed:false,error:String(error),elapsedSeconds:(Date.now()-startedAt)/1000,samples,connections},null,2));throw error;}
  finally{await context?.close();await app.close();await prisma.$disconnect();await rm(profile,{recursive:true,force:true});}
});
