import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { WebSocket } from "ws";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const app = buildApp();
let origin: string;
type Session = { gameId: string; playerId: string; playerToken: string; [key: string]: any };
const auth = (p: Session) => ({ authorization: `Bearer ${p.playerToken}` });
before(async () => { origin = await app.listen({ port: 0, host: "127.0.0.1" }); });
after(async () => { await app.close(); await prisma.$disconnect(); });
async function create(mode = "NORMAL"): Promise<Session> {
  const response = await app.inject({ method: "POST", url: "/games", payload: { mode, displayName: "Host" } });
  assert.equal(response.statusCode, 201, response.body); return response.json();
}
async function join(p: Session): Promise<Session> {
  const response = await app.inject({ method: "POST", url: `/games/${p.gameId}/players`, payload: { displayName: "Guest" } });
  assert.equal(response.statusCode, 200, response.body); return response.json();
}
function send(p: Session, path: string, body: object = {}) {
  return app.inject({ method: "POST", url: `/games/${p.gameId}${path}`, headers: auth(p), payload: { playerId: p.playerId, ...body } });
}
async function post(p: Session, path: string, body: object = {}, expected = 200) {
  const response = await send(p, path, body);
  assert.equal(response.statusCode, expected, response.body); return response.json();
}
async function state(p: Session) {
  const response = await app.inject({ url: `/games/${p.gameId}/state?playerId=${p.playerId}`, headers: auth(p) });
  assert.equal(response.statusCode, 200, response.body); return response.json();
}
const ownReady = (s: any, id = s.playerId) => s.players.find((p: any) => p.id === id).isReady;
const ready = (p: Session, isReady = true) => post(p, "/ready", { isReady });

const lock = (p: Session, isJoinLocked = true) => post(p, "/join-lock", { isJoinLocked });
const remove = (p: Session, target: Session, expected = 200) => post(p, `/players/${target.playerId}/remove`, {}, expected);

test("host controls enforce ownership, same-game targets, lifecycle and strict lock values", async () => {
  for (const mode of ["NORMAL", "LOCKOUT"]) {
    const host=await create(mode);const guest=await join(host);const foreign=await create();const before=await state(host);
    assert.equal(before.isJoinLocked,false);
    for(const isJoinLocked of [null,undefined,1,"false",{}])await post(host,"/join-lock",{isJoinLocked},400);
    await post(guest,"/join-lock",{isJoinLocked:true},403);await remove(guest,host,403);await remove(host,host,409);await remove(host,foreign,409);
    await post({...foreign,gameId:host.gameId},"/join-lock",{isJoinLocked:true},401);
    assert.deepEqual(await state(host),before);
    await ready(host);await ready(guest);await post(host,"/start");await remove(host,guest,409);
    assert.equal((await lock(host)).isJoinLocked,true);assert.equal((await lock(host,false)).isJoinLocked,false);
    await post(host,"/end");await post(host,"/join-lock",{isJoinLocked:true},409);await remove(host,guest,409);
  }
});

test("locked games reject new admission but preserve exact committed-entry recovery and allow reopening", async () => {
  const key=randomBytes(32).toString("base64url");const host=await create();
  const path=`/games/${host.gameId}/players`;const payload={displayName:"Recoverable guest"};
  const admission=()=>app.inject({method:"POST",url:path,payload,headers:{"idempotency-key":key}});
  const guest=(await admission()).json();await ready(guest);const locked=await lock(host);
  const replay=await admission();assert.equal(replay.statusCode,200);assert.equal(replay.json().playerId,guest.playerId);assert.equal(replay.json().playerToken,key);assert.equal(ownReady(replay.json()),true);
  assert.equal((await state(host)).revision,locked.revision);assert.equal((await lock(host)).revision,locked.revision);
  const freshKey=randomBytes(32).toString("base64url");const newEntry=()=>app.inject({method:"POST",url:path,payload:{displayName:"New arrival"},headers:{"idempotency-key":freshKey}});
  const blocked=await newEntry();assert.equal(blocked.statusCode,409);assert.match(blocked.body,/Joining is locked/);
  assert.equal(await prisma.player.count({where:{gameId:host.gameId}}),2);
  await ready(host);await post(host,"/start");assert.equal((await newEntry()).statusCode,409);
  assert.equal((await admission()).statusCode,200,"Committed admission recovers even while active and locked");
  await lock(host,false);assert.equal((await newEntry()).statusCode,200);
  assert.equal((await state(host)).playerCount,3);
});

test("removal revokes the saved session, clears readiness, preserves the row and cannot be replayed into membership", async () => {
  const host=await create("LOCKOUT");const key=randomBytes(32).toString("base64url");
  const entry=()=>app.inject({method:"POST",url:`/games/${host.gameId}/players`,payload:{displayName:"Removed guest"},headers:{"idempotency-key":key}});
  const guest=(await entry()).json();const team=await post(host,"/teams",{name:"Crew"});await post(guest,`/teams/${team.id}/join`);
  await ready(host);await ready(guest);const before=await state(host);const removed=await remove(host,guest);
  const row=await prisma.player.findUniqueOrThrow({where:{id:guest.playerId}});
  assert.ok(row.leftAt);assert.equal(row.removedByHost,true);assert.equal(row.isReady,false);assert.equal(row.teamId,team.id);
  assert.equal(removed.playerCount,1);assert.equal(removed.teams[0].players.length,0);assert.equal(ownReady(removed),true);
  assert.equal(removed.revision,before.revision+1);assert.deepEqual(await remove(host,guest),removed);
  const denied=await app.inject({url:`/games/${host.gameId}/state?playerId=${guest.playerId}`,headers:auth(guest)});assert.equal(denied.statusCode,401);assert.match(denied.body,/host removed you/);
  const forged=await app.inject({url:`/games/${host.gameId}/state?playerId=${guest.playerId}`,headers:auth(host)});assert.equal(forged.statusCode,401);assert.ok(!forged.body.includes("host removed you"));
  for(const path of ["/ready","/teams/leave","/events/page-visit"])await post(guest,path,{isReady:true,title:"Science",url:"https://en.wikipedia.org/wiki/Science"},401);
  const replay=await entry();assert.equal(replay.statusCode,409);assert.match(replay.body,/host removed/);
  await post(guest,`/players/${guest.playerId}/leave`);assert.equal((await state(host)).revision,removed.revision);
  await lock(host);assert.equal((await post(host,"/start")).status,"ACTIVE");
  assert.equal(await prisma.player.count({where:{gameId:host.gameId}}),2);assert.equal(await prisma.pageVisitEvent.count({where:{gameId:host.gameId}}),0);
});

test("host departure transfers lock authority without reopening joining or changing readiness", async () => {
  const host=await create();const guest=await join(host);await ready(guest);await lock(host);
  await post(host,`/players/${host.playerId}/leave`);const current=await state(guest);
  assert.equal(current.hostPlayerId,guest.playerId);assert.equal(current.isJoinLocked,true);assert.equal(ownReady(current),true);
  await post(host,"/join-lock",{isJoinLocked:false},401);
  assert.equal((await lock(guest,false)).isJoinLocked,false);assert.equal((await join(guest)).isJoinLocked,false);
});

test("locked rematches block only new opt-ins, notify the previous round and cannot recover removed members", async () => {
  const host=await create("LOCKOUT");const guest=await join(host);const late=await join(host);
  await lock(host);await post(host,"/end");const next=await post(host,"/rematch") as Session;
  assert.equal(next.isJoinLocked,false,"New rounds never inherit a join lock");
  const nextGuest=await post(guest,"/rematch") as Session;await ready(nextGuest);
  const socket=new WebSocket(`${origin.replace("http","ws")}/ws/${host.gameId}`);await once(socket,"open");
  try {
    // Fetch first so the initial CONNECTED greeting has been delivered.
    await state(host);const notice=once(socket,"message",{signal:AbortSignal.timeout(3000)});
    await lock(next);await notice;
    assert.equal((await state(host)).rematchJoinLocked,true);
    const recovered=await post(guest,"/rematch");assert.equal(recovered.playerId,nextGuest.playerId);assert.equal(ownReady(recovered),true);
    await post(late,"/rematch",{},409);assert.equal(await prisma.player.count({where:{gameId:next.gameId}}),2);
    await remove(next,nextGuest);await post(guest,"/rematch",{},409);
    await lock(next,false);assert.equal((await state(host)).rematchJoinLocked,false);
    assert.equal((await post(late,"/rematch")).status,"WAITING");
    assert.equal(await prisma.player.count({where:{gameId:next.gameId}}),3);
  } finally {const closed=once(socket,"close");socket.close();await closed;}
});

test("lock updates and removals each broadcast once despite concurrent retries", async () => {
  const host=await create();const guest=await join(host);const socket=new WebSocket(`${origin.replace("http","ws")}/ws/${host.gameId}`);
  const messages:any[]=[];socket.on("message",raw=>{const message=JSON.parse(String(raw));if(message.type==="GAME_STATE_UPDATED")messages.push(message);});await once(socket,"open");
  try {
    const locks=await Promise.all(Array.from({length:10},()=>lock(host)));assert.ok(locks.every(s=>s.revision===2));
    const removals=await Promise.all(Array.from({length:10},()=>remove(host,guest)));assert.ok(removals.every(s=>s.revision===3));
    await state(host);assert.equal(messages.length,2);assert.ok(messages.every(m=>m.data===undefined));
  }finally{const closed=once(socket,"close");socket.close();await closed;}
});

test("concurrent lock and join serialize without admitting a new player through a committed lock", async () => {
  for(let iteration=0;iteration<10;iteration++){
    const host=await create();const actions=[()=>send(host,"/join-lock",{isJoinLocked:true}),()=>app.inject({method:"POST",url:`/games/${host.gameId}/players`,payload:{displayName:"Racing arrival"}})];
    if(iteration%2)actions.reverse();const replies=await Promise.all(actions.map(fn=>fn()));
    assert.ok(replies.every(r=>[200,409].includes(r.statusCode)));const current=await state(host);assert.equal(current.isJoinLocked,true);
    const admitted=replies.find(r=>r.statusCode===200&&r.json().playerToken);
    assert.equal(current.playerCount,admitted?2:1);if(admitted)assert.equal(admitted.json().isJoinLocked,false);
  }
});

test("concurrent remove/start and remove/ready preserve valid membership and match state", async () => {
  for(let iteration=0;iteration<10;iteration++){
    const host=await create();const guest=await join(host);await ready(host);await ready(guest);
    const start=iteration%2===0;const actions=[()=>send(host,`/players/${guest.playerId}/remove`),()=>start?send(host,"/start"):send(guest,"/ready",{isReady:false})];
    if(iteration%3)actions.reverse();const replies=await Promise.all(actions.map(fn=>fn()));assert.ok(replies.every(r=>[200,401,409].includes(r.statusCode)));
    const current=await state(host);const target=current.players.find((p:any)=>p.id===guest.playerId);
    assert.equal(current.status,start?"ACTIVE":"WAITING");
    if(target.leftAt){assert.equal(target.removedByHost,true);assert.equal(target.isReady,false);assert.equal(current.playerCount,1);}
    else {assert.ok(start);assert.equal(target.isReady,true);assert.equal(current.playerCount,2);assert.ok(replies.some(r=>r.statusCode===409));}
  }
});
