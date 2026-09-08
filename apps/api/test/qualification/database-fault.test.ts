import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, createConnection, type Socket } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "../../src/db/prisma.js";

test("an established stalled database connection fails readiness and mutation within a bound, then recovers",{timeout:60000},async()=>{
  const output=resolve(".jes/local/ewp-009/database-fault",String(Date.now()));await mkdir(output,{recursive:true});console.log(`Database fault evidence: ${output}`);
  const database=new URL(process.env.DATABASE_URL!);const upstreamHost=database.hostname;const upstreamPort=Number(database.port)||5432;const pairs=new Set<{client:Socket;upstream:Socket}>();let paused=false;
  const proxy=createServer(client=>{
    const upstream=createConnection({host:upstreamHost,port:upstreamPort});const pair={client,upstream};pairs.add(pair);
    client.pipe(upstream);upstream.pipe(client);if(paused)upstream.pause();
    const close=()=>{client.destroy();upstream.destroy();pairs.delete(pair);};client.on("error",close);upstream.on("error",close);client.on("close",close);upstream.on("close",close);
  });proxy.listen(0,"127.0.0.1");await once(proxy,"listening");const proxyPort=(proxy.address() as any).port;
  const portReservation=createServer();portReservation.listen(0,"127.0.0.1");await once(portReservation,"listening");const port=(portReservation.address() as any).port;await new Promise<void>(done=>portReservation.close(()=>done()));
  database.hostname="127.0.0.1";database.port=String(proxyPort);
  const child=spawn(process.execPath,[resolve("apps/api/dist/server.js")],{env:{...process.env,DATABASE_URL:database.href,HOST:"127.0.0.1",PORT:String(port),NODE_ENV:"test",WIKIRACE_INSTANCE_ID:randomUUID()},stdio:["ignore","pipe","pipe"]});
  let logs="";child.stdout.on("data",data=>{logs+=data;});child.stderr.on("data",data=>{logs+=data;});const origin=`http://127.0.0.1:${port}`;const samples:any[]=[];
  const hold=(value:boolean)=>{paused=value;for(const pair of pairs)value?pair.upstream.pause():pair.upstream.resume();};
  const request=(path:string,body?:any,token?:string,timeout=8000)=>fetch(origin+path,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(timeout)});
  try {
    let available=false;for(let i=0;i<60;i++){try{if((await request("/ready",undefined,undefined,1000)).ok){available=true;break;}}catch{}await delay(100);}
    assert.ok(available,"Disposable API must become ready before fault injection");
    const created=await request("/games",{displayName:"Database fault host"});assert.equal(created.status,201);const host:any=await created.json();assert.ok(pairs.size>0);
    hold(true);const started=Date.now();const stalled=request("/ready").then(async response=>({status:response.status,body:await response.json()})).catch(error=>({status:0,error:String(error)}));
    const live=await request("/health",undefined,undefined,1000);assert.equal(live.status,200);const outcome=await stalled;const elapsed=Date.now()-started;samples.push({case:"stalled readiness",elapsedMs:elapsed,outcome,livenessAvailable:true});
    assert.equal(outcome.status,503,"Readiness must answer unavailable within 8 seconds even when an established database connection stops responding");assert.ok(elapsed<8000);
    hold(false);await delay(250);assert.equal((await request("/ready")).status,200);
    hold(true);const mutationStarted=Date.now();const mutation=await request(`/games/${host.gameId}/start`,{playerId:host.playerId},host.playerToken,12000);samples.push({case:"stalled host mutation",status:mutation.status,elapsedMs:Date.now()-mutationStarted});assert.ok([500,503].includes(mutation.status));
    hold(false);await delay(250);const stored=await prisma.game.findUniqueOrThrow({where:{id:host.gameId}});assert.equal(stored.status,"WAITING");assert.equal(stored.revision,0);
    const retried=await request(`/games/${host.gameId}/start`,{playerId:host.playerId},host.playerToken);assert.equal(retried.status,200);const state:any=await retried.json();assert.equal(state.status,"ACTIVE");assert.equal(state.revision,1);assert.equal(state.playerId,host.playerId);
    assert.equal((await request("/ready")).status,200);await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,profile:"actual PostgreSQL through isolated stalled loopback TCP proxy and separately spawned API process",samples,livenessAvailable:true,readinessBounded:true,failedMutationRolledBack:true,identityAndRetryPreserved:true},null,2));
  }catch(error){await writeFile(resolve(output,"failure.json"),JSON.stringify({passed:false,error:String(error),samples},null,2));throw error;}
  finally {
    hold(false);if(child.exitCode===null){child.kill("SIGTERM");const killTimer=setTimeout(()=>child.kill("SIGKILL"),7000);killTimer.unref();await once(child,"exit");clearTimeout(killTimer);}
    for(const pair of pairs){pair.client.destroy();pair.upstream.destroy();}await new Promise<void>(done=>proxy.close(()=>done()));await writeFile(resolve(output,"api.log"),logs);await prisma.$disconnect();
  }
});
