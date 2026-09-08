import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const seconds=Number(process.env.WIKIRACE_MULTIROOM_SECONDS??90);
if(!Number.isFinite(seconds)||seconds<30||seconds>3900)throw new Error("Multi-room qualification must last 30–3900 seconds");
test("four simultaneous games preserve 64 player views through 128 sockets and one API restart",{timeout:(seconds+180)*1000},async()=>{
  const output=resolve(".jes/local/ewp-009/multiroom",String(Date.now()));await mkdir(output,{recursive:true});console.log(`Multi-room evidence: ${output}`);
  const paths=execFileSync("git",["ls-files","apps/api/src","apps/api/public","apps/extension/src","apps/extension/public","packages/shared/src","packages/game-engine/src"],{encoding:"utf8"}).trim().split("\n");
  const source=async()=>({head:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),files:await Promise.all(paths.map(async path=>({path,sha256:createHash("sha256").update(await readFile(path)).digest("hex")})))});
  const initialSource=await source();await writeFile(resolve(output,"source-start.json"),JSON.stringify(initialSource,null,2));
  let app=buildApp();let origin=await app.listen({port:0,host:"127.0.0.1"});const port=Number(new URL(origin).port);let restarting=false;let disposed=false;let opens=0;let reads=0;let expectedOutageErrors=0;
  const rooms:any[]=[];const clients:any[]=[];const errors:string[]=[];const samples:any[]=[];const pending=new Set<Promise<void>>();let started=0;let restarted=false;
  const post=async(path:string,body:any,player?:any)=>{const r=await fetch(origin+path,{method:"POST",headers:{"Content-Type":"application/json",...(player?{Authorization:`Bearer ${player.playerToken}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});assert.ok(r.ok,`POST ${path} returned ${r.status}`);return r.json() as Promise<any>;};
  async function refresh(client:any){
    if(client.flight){client.again=true;return client.flight;}
    const work=(async()=>{do{client.again=false;const path=client.spectator?`/games/${client.room.id}/spectator?playerId=${client.player.playerId}`:`/games/${client.room.id}/state?playerId=${client.player.playerId}`;
      const r=await fetch(origin+path,{headers:client.spectator?{}:{Authorization:`Bearer ${client.player.playerToken}`},signal:AbortSignal.timeout(10000)});assert.ok(r.ok,`State returned ${r.status}`);const state:any=await r.json();reads++;
      assert.equal(state.gameId,client.room.id);assert.equal(state.mode,client.room.mode);assert.equal(state.playerCount,16);assert.deepEqual(state.completedSquareIds,[client.expectedSquare]);assert.equal(state.winner,false);assert.ok(!("playerToken" in state));client.revision=state.revision;
    }while(client.again&&!disposed);})().catch(error=>{if(restarting)expectedOutageErrors++;else if(!disposed)errors.push(String(error));}).finally(()=>{client.flight=null;pending.delete(work);});
    client.flight=work;pending.add(work);return work;
  }
  function connect(client:any){
    if(disposed)return;const socket=new WebSocket(`${origin.replace("http:","ws:")}/ws/${client.room.id}`);client.socket=socket;
    socket.on("open",()=>{opens++;client.attempt=0;void refresh(client);});
    socket.on("message",data=>{try{const message=JSON.parse(String(data));if(message.type==="HEARTBEAT")return;assert.equal(message.gameId,client.room.id);if(message.type==="GAME_STATE_UPDATED")void refresh(client);}catch(error){errors.push(String(error));}});
    socket.on("error",()=>socket.close());socket.on("close",()=>{if(!disposed)client.timer=setTimeout(()=>connect(client),Math.min(5000,500*2**Math.min(client.attempt++,4)));});
  }
  async function settled(){
    const deadline=Date.now()+20000;
    while(Date.now()<deadline){if(errors.length)throw new Error(errors.join("\n"));if(clients.every(client=>client.socket?.readyState===WebSocket.OPEN&&client.revision>=client.room.revision)&&pending.size===0)return;await delay(30);}
    throw new Error("All clients must converge to their own room revision within 20 seconds");
  }
  try {
    for(let roomIndex=0;roomIndex<4;roomIndex++){
      const mode=roomIndex%2?"LOCKOUT":"NORMAL";const host=await post("/games",{mode,displayName:`Room ${roomIndex} host`});const players=[host,...await Promise.all(Array.from({length:15},(_,i)=>post(`/games/${host.gameId}/players`,{displayName:`Room ${roomIndex} player ${i+1}`})))];
      const squares=await prisma.boardSquare.findMany({where:{board:{gameId:host.gameId}},orderBy:{position:"asc"}});
      for(const square of squares)await prisma.boardSquare.update({where:{id:square.id},data:{type:"VISIT_ARTICLE",condition:{title:`Control ${square.position}`}}});
      await post(`/games/${host.gameId}/start`,{playerId:host.playerId},host);
      for(let i=0;i<players.length;i++)await post(`/games/${host.gameId}/events/page-visit`,{playerId:players[i].playerId,title:`Control ${mode==="NORMAL"?i:0}`,url:`https://en.wikipedia.org/wiki/Control_${mode==="NORMAL"?i:0}`},players[i]);
      const room={id:host.gameId,mode,host,players,revision:(await prisma.game.findUniqueOrThrow({where:{id:host.gameId}})).revision};rooms.push(room);
      for(let i=0;i<players.length;i++)for(const spectator of [false,true]){const client={room,player:players[i],spectator,expectedSquare:squares[mode==="NORMAL"?i:0].id,revision:-1,attempt:0,socket:null,timer:null,flight:null,again:false};clients.push(client);connect(client);}
    }
    await settled();assert.equal(app.websocketServer.clients.size,128);started=Date.now();let cycle=0;
    while(Date.now()-started<seconds*1000){
      if(!restarted&&Date.now()-started>=seconds*500){
        restarting=true;await app.close();await delay(1000);app=buildApp();origin=await app.listen({port,host:"127.0.0.1"});await settled();restarting=false;restarted=true;
      }
      await Promise.all(rooms.map(async(room,index)=>{const player=room.players[cycle%16];const result=await post(`/games/${room.id}/events/page-visit`,{playerId:player.playerId,title:`Unmatched sample ${index} ${cycle}`,url:`https://en.wikipedia.org/wiki/Unmatched_${index}_${cycle}`},player);room.revision=result.revision;}));
      await settled();cycle++;const memory=process.memoryUsage();const sample={elapsedSeconds:Math.round((Date.now()-started)/1000),cycle,rooms:rooms.length,players:64,activeSockets:app.websocketServer.clients.size,successfulConnections:opens,stateReads:reads,restarted,expectedOutageErrors,rssBytes:memory.rss,heapBytes:memory.heapUsed};assert.equal(sample.activeSockets,128);assert.ok(memory.rss<768*1024*1024,"Measured local API/test process must remain under the declared 768 MiB budget");samples.push(sample);
      await writeFile(resolve(output,"progress.json"),JSON.stringify({startedAt:new Date(started).toISOString(),requestedSeconds:seconds,samples},null,2));console.log(JSON.stringify(sample));await delay(Math.min(30000,seconds*250,Math.max(1,seconds*1000-(Date.now()-started))));
    }
    assert.ok(restarted);assert.equal(opens,256,"Only the deliberate API restart should replace sockets");assert.deepEqual(errors,[]);const finalSource=await source();assert.deepEqual(finalSource.files,initialSource.files,"Product source must remain unchanged during the measured run");await writeFile(resolve(output,"source-end.json"),JSON.stringify(finalSource,null,2));
    disposed=true;for(const client of clients){clearTimeout(client.timer);client.socket?.close();}const closeDeadline=Date.now()+3000;while(app.websocketServer.clients.size&&Date.now()<closeDeadline)await delay(30);assert.equal(app.websocketServer.clients.size,0);await Promise.all(pending);
    const counts={games:await prisma.game.count(),players:await prisma.player.count(),visits:await prisma.pageVisitEvent.count(),completions:await prisma.squareCompletion.count(),claims:await prisma.squareClaim.count()};assert.equal(counts.games,4);assert.equal(counts.players,64);assert.equal(counts.completions,32);assert.equal(counts.claims,2);
    for(const room of rooms)await prisma.game.delete({where:{id:room.id}});assert.equal(await prisma.game.count(),0);
    await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,profile:"four isolated games; 64 synthetic players; 128 real HTTP/WebSocket clients on one Mac; no real-site or second-machine claim",elapsedSeconds:(Date.now()-started)/1000,requestedSeconds:seconds,apiRestartRecovered:true,normalViewsIndependent:true,lockoutOwnershipExclusive:true,unexpectedReconnects:0,successfulConnections:opens,stateReads:reads,countsBeforeCleanup:counts,noRemainingSocketsOrGames:true,productSourcesUnchanged:true,samples},null,2));
  }catch(error){await writeFile(resolve(output,"failure.json"),JSON.stringify({passed:false,error:String(error),elapsedSeconds:started?(Date.now()-started)/1000:0,samples,errors},null,2));throw error;}
  finally{disposed=true;for(const client of clients){clearTimeout(client.timer);client.socket?.terminate();}await app.close();await prisma.$disconnect();}
});
