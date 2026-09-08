import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
const app=buildApp();let origin:string;
before(async()=>{origin=await app.listen({port:0,host:"127.0.0.1"});});
after(async()=>{await app.close();await prisma.$disconnect();});
const key=()=>randomBytes(32).toString("base64url");
const post=(url:string,payload:object,entryKey?:string)=>app.inject({method:"POST",url,payload,headers:entryKey?{"idempotency-key":entryKey}:{}});

test("concurrent keyed creates recover one private identity and one board",async()=>{
  const secret=key();const responses=await Promise.all(Array.from({length:20},()=>post("/games",{displayName:"Retry host"},secret)));
  for(const response of responses)assert.equal(response.statusCode,201,response.body);
  const states=responses.map(r=>r.json());const first=states[0];
  assert.equal(new Set(states.map(s=>s.gameId)).size,1);assert.equal(new Set(states.map(s=>s.playerId)).size,1);assert.equal(new Set(states.map(s=>s.board.id)).size,1);
  assert.ok(states.every(s=>s.playerToken===secret&&s.revision===0));
  assert.equal(await prisma.player.count({where:{gameId:first.gameId}}),1);
  const stored=await prisma.player.findUniqueOrThrow({where:{id:first.playerId}});assert.equal(stored.sessionTokenHash,createHash("sha256").update(secret).digest("hex"));assert.equal(stored.admissionRequestHash?.length,64);assert.ok(!JSON.stringify(stored).includes(secret));
  for(const url of [`/games/${first.gameId}`,`/games/${first.gameId}/spectator`]) {
    const publicResponse=await app.inject({url});assert.equal(publicResponse.statusCode,200,publicResponse.body);assert.ok(!publicResponse.body.includes(secret));assert.ok(!publicResponse.body.includes("sessionTokenHash"));assert.ok(!publicResponse.body.includes("admissionRequestHash"));
  }
});

test("keyed replay binds normalized input and refuses changed intent or cross-operation reuse",async()=>{
  const secret=key();const original=(await post("/games",{displayName:"  Canonical  "},secret)).json();
  const replay=await post("/games",{displayName:"Canonical",mode:"NORMAL",boardConfig:{genericTileCount:10,vitalArticleTileCount:15,difficulty:"MIXED",maxTilesPerTopic:3}},secret);
  assert.equal(replay.statusCode,201,replay.body);assert.equal(replay.json().playerId,original.playerId);
  assert.equal((await post("/games",{displayName:"Other"},secret)).statusCode,409);
  assert.equal((await post(`/games/${original.gameId}/players`,{displayName:"Canonical"},secret)).statusCode,409);
  assert.equal(await prisma.player.count({where:{gameId:original.gameId}}),1);
});

test("concurrent keyed joins broadcast and increment the lobby only once",async()=>{
  const host=(await post("/games",{})).json();const socket=new WebSocket(`${origin.replace("http:","ws:")}/ws/${host.gameId}`);const updates:any[]=[];
  socket.on("message",data=>{const message=JSON.parse(String(data));if(message.type==="GAME_STATE_UPDATED")updates.push(message);});
  await once(socket,"open");
  try {
    const secret=key();const responses=await Promise.all(Array.from({length:20},()=>post(`/games/${host.gameId}/players`,{displayName:"One guest"},secret)));
    for(const response of responses)assert.equal(response.statusCode,200,response.body);
    assert.equal(new Set(responses.map(r=>r.json().playerId)).size,1);assert.ok(responses.every(r=>r.json().revision===1));
    assert.equal(await prisma.player.count({where:{gameId:host.gameId}}),2);await delay(75);assert.equal(updates.length,1);
  }finally{const closed=once(socket,"close");socket.close();await closed;}
});

test("replay recovers a finished membership but cannot resurrect a departed one",async()=>{
  const secret=key();const host=(await post("/games",{},secret)).json();const auth={authorization:`Bearer ${secret}`};
  assert.equal((await app.inject({method:"POST",url:`/games/${host.gameId}/end`,payload:{playerId:host.playerId},headers:auth})).statusCode,200);
  const replay=await post("/games",{},secret);assert.equal(replay.statusCode,201,replay.body);assert.equal(replay.json().status,"FINISHED");assert.equal(replay.json().playerId,host.playerId);
  assert.equal((await app.inject({method:"POST",url:`/games/${host.gameId}/players/${host.playerId}/leave`,payload:{},headers:auth})).statusCode,200);
  const revision=(await prisma.game.findUniqueOrThrow({where:{id:host.gameId}})).revision;
  assert.equal((await post("/games",{},secret)).statusCode,409);assert.equal((await prisma.game.findUniqueOrThrow({where:{id:host.gameId}})).revision,revision);
});

test("one key raced against different join targets binds to exactly one target",async()=>{
  const hosts=await Promise.all([post("/games",{}),post("/games",{})]);const ids=hosts.map(h=>h.json().gameId);const secret=key();
  const results=await Promise.all(Array.from({length:12},(_,i)=>post(`/games/${ids[i%2]}/players`,{displayName:"Bound guest"},secret)));
  assert.equal(results.filter(r=>r.statusCode===200).length,6);assert.equal(results.filter(r=>r.statusCode===409).length,6);
  assert.equal(await prisma.player.count({where:{gameId:{in:ids}}}),3);
});

test("invalid keys and definitive admission rejection create no reserved membership",async()=>{
  for(const invalid of ["short","x".repeat(44),"!".repeat(43)])assert.equal((await post("/games",{},invalid)).statusCode,400);
  const secret=key();assert.equal((await post(`/games/${randomUUID()}/players`,{},secret)).statusCode,404);
  const valid=await post("/games",{},secret);assert.equal(valid.statusCode,201,valid.body);
  const secondApp=buildApp();try {const replay=await secondApp.inject({method:"POST",url:"/games",payload:{},headers:{"idempotency-key":secret}});assert.equal(replay.statusCode,201,replay.body);assert.equal(replay.json().playerId,valid.json().playerId);}finally{await secondApp.close();}
});
