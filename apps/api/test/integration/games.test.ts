import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
import { randomUUID } from "node:crypto";

const app = buildApp();
const tokens = new Map<string, string>();
const auth = (playerId: string) => ({ authorization: `Bearer ${tokens.get(playerId)}` });
let origin: string;
before(async () => { origin = await app.listen({ port: 0, host: "127.0.0.1" }); });
after(async () => { await app.close(); await prisma.$disconnect(); });

async function createGame(mode = "NORMAL", active = true) {
  const response = await app.inject({ method: "POST", url: "/games", payload: { mode, displayName: "Host" } });
  assert.equal(response.statusCode, 201, response.body);
  const game = response.json();
  tokens.set(game.playerId, game.playerToken);
  for (const square of game.board.squares) {
    await prisma.boardSquare.update({ where: { id: square.id }, data: { type: "VISIT_ARTICLE", condition: { title: `Fixture ${square.position}` } } });
  }
  if (active) await start(game.id, game.playerId);
  return { gameId: game.id, playerId: game.playerId, game };
}
async function start(gameId: string, playerId: string) {
  const response = await app.inject({method:"POST",url:`/games/${gameId}/start`,headers:auth(playerId),payload:{playerId}});
  assert.equal(response.statusCode,200,response.body);
  return response.json();
}
async function join(gameId: string, displayName = "Guest") {
  const response = await app.inject({ method: "POST", url: `/games/${gameId}/players`, payload: { displayName } });
  assert.equal(response.statusCode, 200, response.body);
  const joined = response.json();
  tokens.set(joined.playerId, joined.playerToken);
  return joined;
}
async function visit(gameId: string, playerId: string, position: number) {
  const response = await app.inject({ method: "POST", url: `/games/${gameId}/events/page-visit`, headers: auth(playerId), payload: {
    playerId, title: `Fixture ${position}`, url: `https://en.wikipedia.org/wiki/Fixture_${position}`, categories: [], links: [],
  } });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}
async function state(gameId: string, playerId: string) {
  const response = await app.inject({ url: `/games/${gameId}/state?playerId=${playerId}`, headers: auth(playerId) });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}

test("create/join persists a valid board, names, and distinct player identities", async () => {
  const host = await createGame();
  const guest = await join(host.gameId, "Racer");
  assert.equal(host.game.board.squares.length, 25);
  assert.deepEqual(host.game.board.squares.map((s: any) => s.position).sort((a: number,b: number) => a-b), Array.from({length:25}, (_,i)=>i));
  assert.notEqual(host.playerId, guest.playerId);
  assert.equal(guest.playerName, "Racer");
  assert.equal((await state(host.gameId, host.playerId)).playerCount, 2);
});

test("concurrent joins to a migrated game elect exactly one usable host", async () => {
  const host=await createGame("NORMAL",false);
  await prisma.player.update({where:{id:host.playerId},data:{sessionTokenHash:null,leftAt:new Date()}});
  await prisma.game.update({where:{id:host.gameId},data:{hostPlayerId:null}});
  const [first,second]=await Promise.all([join(host.gameId,"Recovered host"),join(host.gameId,"Recovered guest")]);
  const recovered=await prisma.game.findUniqueOrThrow({where:{id:host.gameId}});
  assert.ok([first.playerId,second.playerId].includes(recovered.hostPlayerId));
  assert.equal((await state(host.gameId,first.playerId)).playerCount,2);
  assert.equal((await state(host.gameId,second.playerId)).hostPlayerId,recovered.hostPlayerId);
  await start(host.gameId,recovered.hostPlayerId!);
  assert.equal(await prisma.player.count({where:{gameId:host.gameId}}),3,"Historical player remains stored");
});

test("concurrent lobby joins enforce the 32-player limit and release a departed slot", async () => {
  const host=await createGame("LOCKOUT",false);
  const results=await Promise.all(Array.from({length:40},(_,index)=>app.inject({method:"POST",url:`/games/${host.gameId}/players`,payload:{displayName:`Capacity player ${index}`}})));
  const admitted=results.filter(r=>r.statusCode===200);const refused=results.filter(r=>r.statusCode===409);
  assert.equal(admitted.length,31);assert.equal(refused.length,9);assert.equal(await prisma.player.count({where:{gameId:host.gameId,leftAt:null}}),32);
  const leaving=admitted[0].json();tokens.set(leaving.playerId,leaving.playerToken);
  const response=await app.inject({method:"POST",url:`/games/${host.gameId}/players/${leaving.playerId}/leave`,headers:auth(leaving.playerId),payload:{}});assert.equal(response.statusCode,200);
  await join(host.gameId,"Replacement player");
  assert.equal((await state(host.gameId,host.playerId)).playerCount,32);
  assert.equal(await prisma.player.count({where:{gameId:host.gameId}}),33,"The departed history remains retained");
});

test("Normal progress persists independently and duplicate visits do not duplicate completions", async () => {
  const host = await createGame(); const guest = await join(host.gameId);
  await visit(host.gameId, host.playerId, 0); await visit(host.gameId, host.playerId, 0);
  assert.equal((await state(host.gameId, host.playerId)).completedSquareIds.length, 1);
  assert.equal((await state(host.gameId, guest.playerId)).completedSquareIds.length, 0);
  await visit(host.gameId, guest.playerId, 0);
  assert.equal(await prisma.squareCompletion.count({ where: { gameId: host.gameId } }), 2);
});

test("Normal bingo finishes the game and subsequent visits cannot write", async () => {
  const host = await createGame();
  for (let i=0; i<5; i++) await visit(host.gameId, host.playerId, i);
  const won = await state(host.gameId, host.playerId);
  assert.equal(won.status, "FINISHED"); assert.equal(won.winner, true);
  assert.deepEqual(won.winningLine, [0,1,2,3,4]);
  const count = await prisma.pageVisitEvent.count({ where: { gameId: host.gameId } });
  await visit(host.gameId, host.playerId, 7);
  assert.equal(await prisma.pageVisitEvent.count({ where: { gameId: host.gameId } }), count);
});

test("Lockout first claims persist and a bingo does not finish a game", async () => {
  const host = await createGame("LOCKOUT"); const guest = await join(host.gameId);
  for (let i=0; i<5; i++) await visit(host.gameId, host.playerId, i);
  await visit(host.gameId, guest.playerId, 0);
  const current = await state(host.gameId, guest.playerId);
  assert.equal(current.winner, false); assert.equal(current.status, "ACTIVE");
  assert.equal(current.squareClaims.length, 5);
  assert.equal(current.squareClaims[0].playerId, host.playerId);
});

test("a three-owner Lockout board ends as an immutable draw without a majority", async () => {
  const host=await createGame("LOCKOUT");const second=await join(host.gameId);const third=await join(host.gameId);
  const players=[host.playerId,second.playerId,third.playerId];
  for(let position=0;position<25;position++)await visit(host.gameId,players[position%3],position);
  const game=await prisma.game.findUniqueOrThrow({where:{id:host.gameId}});
  assert.equal(game.status,"FINISHED");assert.equal(game.endReason,"BOARD_EXHAUSTED");assert.ok(game.finishedAt);
  for(const playerId of players){const view=await state(host.gameId,playerId);assert.equal(view.winner,false);assert.equal(view.winningOwner,null);assert.equal(view.winningLine,null);assert.equal(view.squareClaims.length,25);}
  await visit(host.gameId,host.playerId,0);
  assert.equal(await prisma.pageVisitEvent.count({where:{gameId:host.gameId}}),25);
  assert.equal((await prisma.game.findUniqueOrThrow({where:{id:host.gameId}})).revision,game.revision);
  assert.equal((await app.inject({method:"POST",url:`/games/${host.gameId}/players`,payload:{displayName:"Late"}})).statusCode,409);
});

test("Lockout teammates combine 13 claims into one persisted team winner", async () => {
  const host = await createGame("LOCKOUT", false); const guest = await join(host.gameId);
  const teamResponse = await app.inject({ method: "POST", url: `/games/${host.gameId}/teams`, headers: auth(host.playerId), payload: { playerId: host.playerId, name: "Blue" } });
  assert.equal(teamResponse.statusCode, 200); const team = teamResponse.json();
  for (const playerId of [host.playerId,guest.playerId]) {
    const joined = await app.inject({ method: "POST", url: `/games/${host.gameId}/teams/${team.id}/join`, headers: auth(playerId), payload: { playerId } });
    assert.equal(joined.statusCode, 200);
  }
  await start(host.gameId,host.playerId);
  for (let i=0; i<13; i++) await visit(host.gameId, i%2 ? guest.playerId : host.playerId, i);
  for (const playerId of [host.playerId,guest.playerId]) {
    const result = await state(host.gameId, playerId);
    assert.equal(result.status, "FINISHED"); assert.equal(result.winningOwner.id, team.id);
    assert.equal(result.winningLine, null);
  }
});

test("real WebSocket clients receive the committed page-visit update", async () => {
  const host = await createGame();
  const ws = new WebSocket(`${origin.replace("http:","ws:")}/ws/${host.gameId}`);
  const messages: any[] = [];
  ws.on("message", data => messages.push(JSON.parse(data.toString())));
  await once(ws,"open");
  try {
    const update = new Promise<any>((resolve,reject) => {
      const timer = setTimeout(()=>reject(new Error("WebSocket update timeout")),3000);
      ws.on("message", data => { const message=JSON.parse(data.toString()); if (message.type==="GAME_STATE_UPDATED") { clearTimeout(timer); resolve(message); } });
    });
    await visit(host.gameId, host.playerId, 0);
    const message = await update;
    assert.equal(message.type, "GAME_STATE_UPDATED");
    assert.equal((await state(host.gameId, host.playerId)).completedSquareIds.length, 1);
  } finally { const closed=once(ws,"close"); ws.close(); await closed; }
});

test("invalid counts, payloads and non-article pages return 400 without writes", async () => {
  for (const payload of [{mode:"INVALID"}, {displayName:" "}, {boardConfig:{vitalArticleTileCount:25,genericTileCount:25}}]) {
    const response=await app.inject({method:"POST",url:"/games",payload});
    assert.equal(response.statusCode,400,response.body);
  }
  const host=await createGame();
  for (const url of ["https://example.org/wiki/Test", "https://en.wikipedia.org/wiki/Category:Science", "https://en.wikipedia.org/wiki/Main_Page", "https://en.wikipedia.org/w/index.php", "https://en.wikipedia.org.evil.example/wiki/Test"]) {
    const response=await app.inject({method:"POST",url:`/games/${host.gameId}/events/page-visit`,headers:auth(host.playerId),payload:{playerId:host.playerId,title:"Fixture 0",url}});
    assert.equal(response.statusCode,400,response.body);
  }
  assert.equal(await prisma.pageVisitEvent.count({where:{gameId:host.gameId}}),0);
});

test("unknown, forged, and foreign sessions cannot mutate or read player state", async () => {
  const host=await createGame(); const other=await createGame();
  const before=await prisma.player.count();
  for (const [playerId,headers] of [[randomUUID(),auth(host.playerId)], [host.playerId,{}], [host.playerId,auth(other.playerId)], [other.playerId,auth(other.playerId)]] as const) {
    const response=await app.inject({method:"POST",url:`/games/${host.gameId}/events/page-visit`,headers,payload:{playerId,title:"Fixture 0",url:"https://en.wikipedia.org/wiki/Fixture_0"}});
    assert.equal(response.statusCode,401,response.body);
  }
  const unauthorized=await app.inject({url:`/games/${host.gameId}/state?playerId=${host.playerId}`});
  assert.equal(unauthorized.statusCode,401);
  assert.equal(await prisma.player.count(),before);
  assert.equal(await prisma.pageVisitEvent.count({where:{gameId:host.gameId}}),0);
});

test("session hashes and tokens never appear in public game or ordinary state responses", async () => {
  const host=await createGame(); const guest=await join(host.gameId);
  const player=await prisma.player.findUniqueOrThrow({where:{id:host.playerId}});
  for (const response of [(await app.inject({url:`/games/${host.gameId}`})).body, (await app.inject({url:`/games/${host.gameId}/spectator`})).body, JSON.stringify(await state(host.gameId,guest.playerId))]) {
    assert.ok(!response.includes("sessionTokenHash")); assert.ok(!response.includes("playerToken"));
    assert.ok(!response.includes(player.sessionTokenHash!)); assert.ok(!response.includes(tokens.get(host.playerId)!));
  }
});

test("spectator reads follow only players in that game and never enroll or score", async () => {
  const host=await createGame(); const guest=await join(host.gameId); const foreign=await createGame();
  await visit(host.gameId,host.playerId,0);
  const playerCount=await prisma.player.count(); const visitCount=await prisma.pageVisitEvent.count();
  const defaultView=await app.inject({url:`/games/${host.gameId}/spectator`});
  assert.equal(defaultView.statusCode,200); assert.equal(defaultView.json().spectator,true);
  assert.equal(defaultView.json().completedSquareIds.length,1);
  const guestView=await app.inject({url:`/games/${host.gameId}/spectator?playerId=${guest.playerId}`});
  assert.equal(guestView.statusCode,200); assert.equal(guestView.json().completedSquareIds.length,0);
  for(const id of [foreign.playerId,randomUUID()]) assert.equal((await app.inject({url:`/games/${host.gameId}/spectator?playerId=${id}`})).statusCode,404);
  assert.equal((await app.inject({url:`/games/${randomUUID()}/spectator`})).statusCode,404);
  assert.equal(await prisma.player.count(),playerCount); assert.equal(await prisma.pageVisitEvent.count(),visitCount);
});

test("readiness checks the database schema and the operator page has an explicit content policy", async () => {
  const ready=await app.inject({url:"/ready"}); assert.equal(ready.statusCode,200); assert.equal(ready.json().database,"connected");
  const home=await app.inject({url:"/"}); assert.equal(home.statusCode,200);
  assert.match(String(home.headers["content-security-policy"]),/script-src 'self'/);
  assert.equal(home.headers["x-content-type-options"],"nosniff");
  assert.equal((await app.inject({url:"/assets/../../.env"})).statusCode,404);
});

test("a player's claims cannot transfer through a team change or foreign-game join", async () => {
  const host=await createGame("LOCKOUT",false); const foreign=await createGame("LOCKOUT");
  const teamResponse=await app.inject({method:"POST",url:`/games/${host.gameId}/teams`,headers:auth(host.playerId),payload:{playerId:host.playerId,name:"Keepers"}});
  const team=teamResponse.json();
  const wrongGame=await app.inject({method:"POST",url:`/games/${host.gameId}/teams/${team.id}/join`,headers:auth(foreign.playerId),payload:{playerId:foreign.playerId}});
  assert.equal(wrongGame.statusCode,401);
  await start(host.gameId,host.playerId);
  await visit(host.gameId,host.playerId,0);
  const switched=await app.inject({method:"POST",url:`/games/${host.gameId}/teams/${team.id}/join`,headers:auth(host.playerId),payload:{playerId:host.playerId}});
  assert.equal(switched.statusCode,409);
  assert.equal((await state(host.gameId,host.playerId)).squareClaims[0].teamId,null);
});

test("simultaneous Lockout claim attempts yield one consistent owner", async () => {
  const host=await createGame("LOCKOUT"); const guest=await join(host.gameId);
  const results=await Promise.all([visit(host.gameId,host.playerId,0),visit(host.gameId,guest.playerId,0)]);
  const claims=await prisma.squareClaim.findMany({where:{gameId:host.gameId}});
  assert.equal(claims.length,1);
  assert.ok([host.playerId,guest.playerId].includes(claims[0].playerId));
  for (const result of results) assert.equal(result.squareClaims[0].playerId,claims[0].playerId);
});

test("simultaneous Normal bingos persist exactly one winner visible to every player", async () => {
  const host=await createGame(); const guest=await join(host.gameId);
  for (let i=0;i<4;i++) {await visit(host.gameId,host.playerId,i);await visit(host.gameId,guest.playerId,i);}
  await Promise.all([visit(host.gameId,host.playerId,4),visit(host.gameId,guest.playerId,4)]);
  const winner=await prisma.game.findUniqueOrThrow({where:{id:host.gameId}});
  assert.equal(winner.status,"FINISHED"); assert.ok(winner.winnerPlayerId);
  assert.equal(await prisma.squareCompletion.count({where:{gameId:host.gameId}}),9);
  for (const id of [host.playerId,guest.playerId]) {
    const current=await state(host.gameId,id);
    assert.equal(current.winningOwner.id,winner.winnerPlayerId); assert.equal(current.winner,true);
  }
  const revision=winner.revision;
  await visit(host.gameId,host.playerId,8);
  assert.equal((await prisma.game.findUniqueOrThrow({where:{id:host.gameId}})).revision,revision);
});

test("a database failure rolls back the visit, claim, and revision together", async () => {
  const host=await createGame("LOCKOUT");
  // A real PostgreSQL constraint injects a failure after event creation.
  await prisma.$executeRawUnsafe(`ALTER TABLE "SquareClaim" ADD CONSTRAINT wr_injected_failure CHECK ("playerId" <> '${host.playerId}')`);
  try {
    const response=await app.inject({method:"POST",url:`/games/${host.gameId}/events/page-visit`,headers:auth(host.playerId),payload:{playerId:host.playerId,title:"Fixture 0",url:"https://en.wikipedia.org/wiki/Fixture_0"}});
    assert.equal(response.statusCode,500);
    assert.equal(await prisma.pageVisitEvent.count({where:{gameId:host.gameId}}),0);
    assert.equal(await prisma.squareClaim.count({where:{gameId:host.gameId}}),0);
    assert.equal((await prisma.game.findUniqueOrThrow({where:{id:host.gameId}})).revision,1);
  } finally { await prisma.$executeRawUnsafe('ALTER TABLE "SquareClaim" DROP CONSTRAINT wr_injected_failure'); }
  assert.equal((await visit(host.gameId,host.playerId,0)).completedSquareIds.length,1);
});

test("waiting lobbies do not score and only the host can start or end them", async () => {
  const host=await createGame("NORMAL",false); const guest=await join(host.gameId);
  const waiting=await state(host.gameId,guest.playerId);
  assert.equal(waiting.status,"WAITING"); assert.equal(waiting.startedAt,null);
  const early=await app.inject({method:"POST",url:`/games/${host.gameId}/events/page-visit`,headers:auth(guest.playerId),payload:{playerId:guest.playerId,title:"Fixture 0",url:"https://en.wikipedia.org/wiki/Fixture_0"}});
  assert.equal(early.statusCode,409);
  for(const operation of ["start","end"]) {
    const rejected=await app.inject({method:"POST",url:`/games/${host.gameId}/${operation}`,headers:auth(guest.playerId),payload:{playerId:guest.playerId}});
    assert.equal(rejected.statusCode,403);
  }
  const active=await start(host.gameId,host.playerId);
  assert.equal(active.status,"ACTIVE"); assert.ok(active.startedAt);
  const duplicate=await start(host.gameId,host.playerId);
  assert.equal(duplicate.revision,active.revision);
  const ended=await app.inject({method:"POST",url:`/games/${host.gameId}/end`,headers:auth(host.playerId),payload:{playerId:host.playerId}});
  assert.equal(ended.json().status,"FINISHED"); assert.equal(ended.json().winner,false);
  assert.equal(ended.json().endReason,"HOST_ENDED");
  const late=await app.inject({method:"POST",url:`/games/${host.gameId}/players`,payload:{displayName:"Too late"}});
  assert.equal(late.statusCode,409);
});

test("team create/join/leave works in a lobby and membership locks for all players at start", async () => {
  const host=await createGame("LOCKOUT",false); const guest=await join(host.gameId);
  const create=await app.inject({method:"POST",url:`/games/${host.gameId}/teams`,headers:auth(host.playerId),payload:{playerId:host.playerId,name:"Explorers"}});
  assert.equal(create.statusCode,200); const team=create.json();
  for(const playerId of [host.playerId,guest.playerId]) {
    const joined=await app.inject({method:"POST",url:`/games/${host.gameId}/teams/${team.id}/join`,headers:auth(playerId),payload:{playerId}});
    assert.equal(joined.statusCode,200);
  }
  const left=await app.inject({method:"POST",url:`/games/${host.gameId}/teams/leave`,headers:auth(guest.playerId),payload:{playerId:guest.playerId}});
  assert.equal(left.statusCode,200);
  assert.equal(left.json().teams[0].players.length,1);
  await start(host.gameId,host.playerId);
  for(const operation of [`teams/${team.id}/join`,"teams/leave","teams"]) {
    const locked=await app.inject({method:"POST",url:`/games/${host.gameId}/${operation}`,headers:auth(guest.playerId),payload:{playerId:guest.playerId,name:"Late"}});
    assert.equal(locked.statusCode,409,locked.body);
  }
});

test("leaving preserves claims, transfers host authority, and revokes player operations", async () => {
  const host=await createGame("LOCKOUT"); const guest=await join(host.gameId);
  await visit(host.gameId,host.playerId,0);
  const leave=await app.inject({method:"POST",url:`/games/${host.gameId}/players/${host.playerId}/leave`,headers:auth(host.playerId),payload:{}});
  assert.equal(leave.statusCode,200);
  const current=await state(host.gameId,guest.playerId);
  assert.equal(current.hostPlayerId,guest.playerId); assert.equal(current.playerCount,1);
  assert.equal(current.squareClaims.length,1); assert.equal(current.squareClaims[0].playerId,host.playerId);
  assert.ok(current.players.find((p:any)=>p.id===host.playerId).leftAt);
  const invalid=await app.inject({url:`/games/${host.gameId}/state?playerId=${host.playerId}`,headers:auth(host.playerId)});
  assert.equal(invalid.statusCode,401);
  const again=await app.inject({method:"POST",url:`/games/${host.gameId}/players/${host.playerId}/leave`,headers:auth(host.playerId),payload:{}});
  assert.equal(again.statusCode,200);
  const ended=await app.inject({method:"POST",url:`/games/${host.gameId}/end`,headers:auth(guest.playerId),payload:{playerId:guest.playerId}});
  assert.equal(ended.statusCode,200);
});

test("the last player leaving ends the lobby and simultaneous leaves are consistent", async () => {
  const host=await createGame("NORMAL",false); const guest=await join(host.gameId);
  const results=await Promise.all([host.playerId,guest.playerId].map(playerId=>app.inject({method:"POST",url:`/games/${host.gameId}/players/${playerId}/leave`,headers:auth(playerId),payload:{}})));
  for(const result of results) assert.equal(result.statusCode,200);
  const game=await prisma.game.findUniqueOrThrow({where:{id:host.gameId},include:{players:true}});
  assert.equal(game.status,"FINISHED"); assert.equal(game.endReason,"EMPTY"); assert.equal(game.hostPlayerId,null);
  assert.ok(game.players.every(player=>player.leftAt));
});

test("reconnected WebSocket clients see lobby membership changes without private progress", async () => {
  const host=await createGame("NORMAL",false);
  const ws=new WebSocket(`${origin.replace("http:","ws:")}/ws/${host.gameId}`);
  await once(ws,"open");
  try {
    const update=new Promise<any>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error("Lobby broadcast timeout")),3000);
      ws.on("message",data=>{const msg=JSON.parse(data.toString());if(msg.type==="GAME_STATE_UPDATED"){clearTimeout(timer);resolve(msg);}});
    });
    await join(host.gameId);
    const message=await update;
    assert.equal(message.type,"GAME_STATE_UPDATED");
    assert.equal(message.data,undefined);
    assert.equal((await state(host.gameId,host.playerId)).playerCount,2);
  } finally {const closed=once(ws,"close");ws.close();await closed;}
  const missing=new WebSocket(`${origin.replace("http:","ws:")}/ws/${randomUUID()}`);
  missing.on("error",()=>{});
  const [,response]=await once(missing,"unexpected-response");
  assert.equal(response.statusCode,404); response.resume(); missing.terminate();
});
