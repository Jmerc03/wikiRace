import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const seconds=Number(process.env.WIKIRACE_SESSION_SOAK_SECONDS??90);
if(!Number.isFinite(seconds)||seconds<30||seconds>3300)throw new Error("Session qualification must last 30–3300 seconds");
test("repeated multiplayer lifecycles release sockets and preserve mode-specific scoring",{timeout:(seconds+90)*1000},async()=>{
  const output=resolve(".jes/local/ewp-006/sessions",String(Date.now()));await mkdir(output,{recursive:true});console.log(`Session cleanup evidence: ${output}`);
  const app=buildApp();const origin=await app.listen({port:0,host:"127.0.0.1"});const started=Date.now();const samples:any[]=[];let cycles=0;
  const post=async(path:string,body:any,player?:any)=>{const response=await app.inject({method:"POST",url:path,payload:body,headers:player?{authorization:`Bearer ${player.playerToken}`}:{}});assert.ok([200,201].includes(response.statusCode),response.body);return response.json();};
  try{
    while(Date.now()-started<seconds*1000){
      const mode=cycles%2?"LOCKOUT":"NORMAL";const host=await post("/games",{mode,displayName:"Lifecycle host"});const gameId=host.gameId;const players=[host,await post(`/games/${gameId}/players`,{displayName:"Second"}),await post(`/games/${gameId}/players`,{displayName:"Third"})];const sockets:WebSocket[]=[];
      try{
        const squares=await prisma.boardSquare.findMany({where:{board:{gameId}}});for(const square of squares)await prisma.boardSquare.update({where:{id:square.id},data:{type:"VISIT_ARTICLE",condition:{title:square.position===0?"Science":`Lifecycle control ${square.position}`}}});
        for(const player of players){const socket=new WebSocket(`${origin.replace("http:","ws:")}/ws/${gameId}`);sockets.push(socket);await once(socket,"open");}
        for(const player of players)await post(`/games/${gameId}/ready`,{playerId:player.playerId,isReady:true},player);
        await post(`/games/${gameId}/start`,{playerId:host.playerId},host);
        for(const player of players.slice(0,2))await post(`/games/${gameId}/events/page-visit`,{playerId:player.playerId,title:"Science",url:"https://en.wikipedia.org/wiki/Science"},player);
        assert.equal(await prisma.squareCompletion.count({where:{gameId}}),mode==="NORMAL"?2:0);assert.equal(await prisma.squareClaim.count({where:{gameId}}),mode==="LOCKOUT"?1:0);
        await post(`/games/${gameId}/players/${host.playerId}/leave`,{},host);assert.equal((await prisma.game.findUniqueOrThrow({where:{id:gameId}})).hostPlayerId,players[1].playerId);
        for(const player of players.slice(1))await post(`/games/${gameId}/players/${player.playerId}/leave`,{},player);
        const game=await prisma.game.findUniqueOrThrow({where:{id:gameId}});assert.equal(game.status,"FINISHED");assert.equal(game.endReason,"EMPTY");assert.equal(game.hostPlayerId,null);assert.equal(await prisma.player.count({where:{gameId,leftAt:null}}),0);
      }finally{
        await Promise.all(sockets.map(async socket=>{if(socket.readyState===WebSocket.CLOSED)return;const closed=once(socket,"close");socket.close();await closed;}));
        // A client's close callback may precede the server's close callback.
        const closeDeadline=Date.now()+1000;
        while(app.websocketServer.clients.size&&Date.now()<closeDeadline)await delay(20);
        assert.equal(app.websocketServer.clients.size,0,"No socket may survive a completed cycle");
        await prisma.game.delete({where:{id:gameId}});
      }
      cycles++;const memory=process.memoryUsage();const sample={cycle:cycles,mode,elapsedSeconds:Math.round((Date.now()-started)/1000),openSockets:app.websocketServer.clients.size,remainingGames:await prisma.game.count(),heapBytes:memory.heapUsed,rssBytes:memory.rss};assert.equal(sample.remainingGames,0);samples.push(sample);
      await writeFile(resolve(output,"progress.json"),JSON.stringify({startedAt:new Date(started).toISOString(),requestedSeconds:seconds,samples},null,2));console.log(JSON.stringify(sample));
      await delay(Math.min(15000,Math.max(1,seconds*1000-(Date.now()-started))));
    }
    assert.ok(cycles>=2);await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,profile:"actual local PostgreSQL/HTTP/WebSockets with synthetic visits and three players per cycle",elapsedSeconds:(Date.now()-started)/1000,requestedSeconds:seconds,cycles,zeroSocketsAfterEveryCycle:true,noLeftoverGames:true,modeSpecificScoring:true,hostTransfers:true,samples},null,2));
  }catch(error){await writeFile(resolve(output,"failure.json"),JSON.stringify({passed:false,error:String(error),cycles,samples},null,2));throw error;}
  finally{await app.close();await prisma.$disconnect();}
});
