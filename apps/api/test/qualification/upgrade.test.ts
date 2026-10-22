import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

test("actual prototype schema upgrades without deleting history or leaving an inaccessible host",async()=>{
  const output=resolve(".jes/local/ewp-005/upgrade",String(Date.now()));await mkdir(output,{recursive:true});
  const url=new URL(process.env.DATABASE_URL!);const schema=`wr_upgrade_${randomUUID().replaceAll("-","")}`;
  const admin=new PrismaClient({datasourceUrl:url.href});const base=new URL(url);base.searchParams.delete("schema");url.searchParams.set("schema",schema);const db=new PrismaClient({datasourceUrl:url.href});
  const migrations=resolve("apps/api/prisma/migrations");const ids=Array.from({length:6},()=>randomUUID());const [gameId,finishedId,playerId,boardId,squareId,eventId]=ids;
  const runSql=(args:string[])=>{const result=spawnSync("psql",["--dbname",base.href,"-v","ON_ERROR_STOP=1","-q",...args],{encoding:"utf8",env:{...process.env,PGOPTIONS:`-c search_path=${schema}`}});assert.equal(result.status,0,result.stderr);};
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try{
    const directories=(await readdir(migrations)).filter(name=>/^\d/.test(name)).sort();
    for(const migration of directories.filter(name=>name<"20260907"))runSql(["-f",resolve(migrations,migration,"migration.sql")]);
    runSql(["-c",`INSERT INTO "Game" (id,mode,status) VALUES ('${gameId}','LOCKOUT','ACTIVE'),('${finishedId}','NORMAL','FINISHED');
      INSERT INTO "Player" (id,"gameId","displayName",color) VALUES ('${playerId}','${gameId}','Prototype player','rgba(10,20,30,0.35)');
      INSERT INTO "Board" (id,"gameId") VALUES ('${boardId}','${gameId}');
      INSERT INTO "BoardSquare" (id,"boardId",position,type,label,condition,difficulty) VALUES ('${squareId}','${boardId}',0,'VISIT_ARTICLE','Visit Science','{"title":"Science"}','EASY');
      INSERT INTO "PageVisitEvent" (id,"gameId","playerId",url,title,categories,links) VALUES ('${eventId}','${gameId}','${playerId}','https://en.wikipedia.org/wiki/Science','Science','["Science"]','["/wiki/Earth"]');
      INSERT INTO "SquareClaim" (id,"gameId","playerId","squareId","pageVisitEventId") VALUES ('${randomUUID()}','${gameId}','${playerId}','${squareId}','${eventId}');`]);
    for(const migration of directories.filter(name=>name>="20260907"))runSql(["-f",resolve(migrations,migration,"migration.sql")]);
    const player=await db.player.findUniqueOrThrow({where:{id:playerId}});const game=await db.game.findUniqueOrThrow({where:{id:gameId}});const finished=await db.game.findUniqueOrThrow({where:{id:finishedId}});
    assert.ok(player.leftAt);assert.equal(player.sessionTokenHash,null);assert.equal(player.displayName,"Prototype player");assert.equal(game.status,"ACTIVE");assert.equal(game.hostPlayerId,null);
    assert.equal(finished.status,"FINISHED");assert.equal(finished.endReason,"LEGACY_UNKNOWN");assert.equal(finished.winnerPlayerId,null);
    assert.equal(await db.pageVisitEvent.count(),1);assert.equal(await db.squareClaim.count(),1);assert.equal(await db.boardSquare.count(),1);
    const retained=await db.pageVisitEvent.findUniqueOrThrow({where:{id:eventId}});assert.deepEqual(retained.categories,["Science"]);assert.deepEqual(retained.links,["/wiki/Earth"]);
    // Reapplying the data repair is idempotent and preserves valid new hosts.
    const newId=randomUUID();await db.player.create({data:{id:newId,gameId,displayName:"Current player",sessionTokenHash:"qualification-hash"}});await db.game.update({where:{id:gameId},data:{hostPlayerId:newId}});
    runSql(["-f",resolve(migrations,"20260907234000_legacy_session_recovery/migration.sql")]);
    assert.equal((await db.game.findUniqueOrThrow({where:{id:gameId}})).hostPlayerId,newId);assert.equal((await db.player.findUniqueOrThrow({where:{id:newId}})).leftAt,null);
    assert.equal((await db.player.findUniqueOrThrow({where:{id:playerId}})).leftAt!.toISOString(),player.leftAt.toISOString());
    await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,profile:"actual original PostgreSQL schema with historical fixture records, followed by checked-in additive and data migrations",migrations:directories,retainedVisits:1,retainedClaims:1,retiredTokenlessMembership:true,unfinishedGameResumable:true,unknownHistoricalWinnerExplicit:true,currentHostPreserved:true,idempotentRepair:true},null,2));console.log(`Upgrade evidence: ${output}`);
  }finally{await db.$disconnect();await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.$disconnect();}
});

test("ready-check migration preserves existing authenticated rounds and defaults their players to unready", async () => {
  const output=resolve(".jes/local/ewp-011/upgrade",String(Date.now()));await mkdir(output,{recursive:true});
  const base=new URL(process.env.DATABASE_URL!);base.searchParams.delete("schema");
  const schema=`wr_upgrade_${randomUUID().replaceAll("-","")}`;const url=new URL(base);url.searchParams.set("schema",schema);
  const db=new PrismaClient({datasourceUrl:url.href});const admin=new PrismaClient({datasourceUrl:base.href});
  const migrations=resolve("apps/api/prisma/migrations");const latest="20261022162000_lobby_ready_checks";
  const sql=(args:string[])=>{const r=spawnSync("psql",["--dbname",base.href,"-v","ON_ERROR_STOP=1","-q",...args],{encoding:"utf8",env:{...process.env,PGOPTIONS:`-c search_path=${schema}`}});assert.equal(r.status,0,r.stderr);};
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for(const migration of (await readdir(migrations)).filter(name=>/^\d/.test(name)&&name<latest).sort())sql(["-f",resolve(migrations,migration,"migration.sql")]);
    const games=[randomUUID(),randomUUID(),randomUUID()];const players=games.map(()=>randomUUID());
    for(let i=0;i<games.length;i++)sql(["-c",`INSERT INTO "Game" (id,mode,status,"hostPlayerId",revision) VALUES ('${games[i]}','${i===1?'LOCKOUT':'NORMAL'}','${['WAITING','ACTIVE','FINISHED'][i]}','${players[i]}',7);
      INSERT INTO "Player" (id,"gameId","displayName","sessionTokenHash","admissionRequestHash") VALUES ('${players[i]}','${games[i]}','Existing player ${i}','${String(i).repeat(64)}','${String(i+3).repeat(64)}');`]);
    sql(["-c",`UPDATE "Game" SET "rematchOfGameId"='${games[2]}' WHERE id='${games[0]}'; UPDATE "Player" SET "rematchSourcePlayerId"='${players[2]}' WHERE id='${players[0]}';`]);
    const gamesBefore=await db.$queryRawUnsafe('SELECT to_jsonb(t) AS row FROM "Game" t ORDER BY id');
    const playersBefore=await db.$queryRawUnsafe('SELECT to_jsonb(t) AS row FROM "Player" t ORDER BY id');
    sql(["-f",resolve(migrations,latest,"migration.sql")]);
    assert.deepEqual(await db.$queryRawUnsafe('SELECT to_jsonb(t) AS row FROM "Game" t ORDER BY id'),gamesBefore);
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT to_jsonb(t) - 'isReady' AS row FROM "Player" t ORDER BY id`),playersBefore);
    assert.ok((await db.$queryRawUnsafe<{isReady:boolean}[]>('SELECT "isReady" FROM "Player"')).every(p=>p.isReady===false));
    const newPlayerId=randomUUID();sql(["-c",`INSERT INTO "Player" (id,"gameId","displayName") VALUES ('${newPlayerId}','${games[0]}','After upgrade');`]);
    const newPlayers=await db.$queryRawUnsafe<{isReady:boolean}[]>(`SELECT "isReady" FROM "Player" WHERE id='${newPlayerId}'`);assert.equal(newPlayers[0].isReady,false);
    await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,migration:latest,profile:"actual prior schema with waiting, active, finished and linked-rematch records",exactExistingColumnsPreserved:true,sessionAndAdmissionHashesPreserved:true,existingPlayersDefaultUnready:true,newPlayersDefaultUnready:true},null,2));console.log(`Ready-check upgrade evidence: ${output}`);
  } finally {await db.$disconnect();await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.$disconnect();}
});

test("host-control migration preserves ready checks and defaults existing rounds open with no fabricated removals",async()=>{
  const output=resolve(".jes/local/ewp-012/upgrade",String(Date.now()));await mkdir(output,{recursive:true});
  const base=new URL(process.env.DATABASE_URL!);base.searchParams.delete("schema");const schema=`wr_upgrade_${randomUUID().replaceAll("-","")}`;
  const url=new URL(base);url.searchParams.set("schema",schema);const db=new PrismaClient({datasourceUrl:url.href});const admin=new PrismaClient({datasourceUrl:base.href});
  const migrations=resolve("apps/api/prisma/migrations");const latest="20261022163500_host_lobby_controls";
  const sql=(args:string[])=>{const r=spawnSync("psql",["--dbname",base.href,"-v","ON_ERROR_STOP=1","-q",...args],{encoding:"utf8",env:{...process.env,PGOPTIONS:`-c search_path=${schema}`}});assert.equal(r.status,0,r.stderr);};
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try{
    for(const migration of (await readdir(migrations)).filter(name=>/^\d/.test(name)&&name<latest).sort())sql(["-f",resolve(migrations,migration,"migration.sql")]);
    const games=[randomUUID(),randomUUID(),randomUUID()];const players=games.map(()=>randomUUID());
    for(let i=0;i<games.length;i++)sql(["-c",`INSERT INTO "Game" (id,mode,status,"hostPlayerId",revision) VALUES ('${games[i]}','NORMAL','${['WAITING','ACTIVE','FINISHED'][i]}','${players[i]}',9);
      INSERT INTO "Player" (id,"gameId","displayName","sessionTokenHash","isReady","leftAt") VALUES ('${players[i]}','${games[i]}','Existing member ${i}','${String(i).repeat(64)}',${i<2},${i===2?'NOW()':'NULL'});`]);
    sql(["-c",`UPDATE "Game" SET "rematchOfGameId"='${games[2]}' WHERE id='${games[0]}';`]);
    const gameRows=await db.$queryRawUnsafe('SELECT to_jsonb(t) AS row FROM "Game" t ORDER BY id');const playerRows=await db.$queryRawUnsafe('SELECT to_jsonb(t) AS row FROM "Player" t ORDER BY id');
    sql(["-f",resolve(migrations,latest,"migration.sql")]);
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT to_jsonb(t) - 'isJoinLocked' AS row FROM "Game" t ORDER BY id`),gameRows);
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT to_jsonb(t) - 'removedByHost' AS row FROM "Player" t ORDER BY id`),playerRows);
    assert.ok((await db.$queryRawUnsafe<{isJoinLocked:boolean}[]>('SELECT "isJoinLocked" FROM "Game"')).every(g=>g.isJoinLocked===false));assert.ok((await db.player.findMany()).every(p=>p.removedByHost===false));
    await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,migration:latest,profile:"actual previous schema with waiting/active/finished/linked rounds, ready and departed players",exactExistingColumnsPreserved:true,readinessAndSessionHashesPreserved:true,existingRoundsDefaultOpen:true,noHistoricalRemovalInvented:true},null,2));console.log(`Host-control upgrade evidence: ${output}`);
  }finally{await db.$disconnect();await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.$disconnect();}
});

test("timed-round migration preserves old rounds and exact pre-upgrade create recovery", { timeout: 60000 }, async () => {
  const output=resolve(".jes/local/ewp-014/upgrade",String(Date.now()));await mkdir(output,{recursive:true});
  const base=new URL(process.env.DATABASE_URL!);base.searchParams.delete("schema");const schema=`wr_upgrade_${randomUUID().replaceAll("-","")}`;
  const url=new URL(base);url.searchParams.set("schema",schema);const db=new PrismaClient({datasourceUrl:url.href});const admin=new PrismaClient({datasourceUrl:base.href});
  const migrations=resolve("apps/api/prisma/migrations");const latest="20261022171500_timed_rounds";
  const sql=(args:string[])=>{const r=spawnSync("psql",["--dbname",base.href,"-v","ON_ERROR_STOP=1","-q",...args],{encoding:"utf8",env:{...process.env,PGOPTIONS:`-c search_path=${schema}`}});assert.equal(r.status,0,r.stderr);};
  let child:ReturnType<typeof spawn>|undefined;
  const sha=(value:string)=>createHash("sha256").update(value).digest("hex");
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for(const migration of (await readdir(migrations)).filter(name=>/^\d/.test(name)&&name<latest).sort())sql(["-f",resolve(migrations,migration,"migration.sql")]);
    const entries=[];
    for(const status of ["WAITING","ACTIVE","FINISHED"]){
      const gameId=randomUUID(),playerId=randomUUID(),boardId=randomUUID(),key=randomBytes(32).toString("base64url");
      const payload={mode:"NORMAL",displayName:`Pre-timer ${status}`,boardConfig:{difficulty:"MIXED",vitalArticleTileCount:15,genericTileCount:10,maxTilesPerTopic:3}};
      const fingerprint=sha(JSON.stringify({operation:"create",gameId:null,body:payload}));
      sql(["-c",`INSERT INTO "Game" (id,mode,status,"hostPlayerId",revision,"boardConfig") VALUES ('${gameId}','NORMAL','${status}','${playerId}',7,'${JSON.stringify(payload.boardConfig)}');
        INSERT INTO "Player" (id,"gameId","displayName","sessionTokenHash","admissionRequestHash","isReady") VALUES ('${playerId}','${gameId}','${payload.displayName}','${sha(key)}','${fingerprint}',true);
        INSERT INTO "Board" (id,"gameId") VALUES ('${boardId}','${gameId}');`]);
      entries.push({gameId,playerId,key,payload,status});
    }
    const before=await db.$queryRawUnsafe('SELECT to_jsonb(t) AS row FROM "Game" t ORDER BY id');
    const playersBefore=await db.$queryRawUnsafe('SELECT to_jsonb(t) AS row FROM "Player" t ORDER BY id');
    sql(["-f",resolve(migrations,latest,"migration.sql")]);
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT to_jsonb(t) - 'timeLimitSeconds' - 'expiresAt' AS row FROM "Game" t ORDER BY id`),before);
    assert.ok((await db.game.findMany()).every(g=>g.timeLimitSeconds===null&&g.expiresAt===null));
    const script=`import{buildApp}from'./apps/api/dist/app.js';import{prisma}from'./apps/api/dist/db/prisma.js';const app=buildApp();const origin=await app.listen({host:'127.0.0.1',port:0});process.send({origin});process.on('SIGTERM',async()=>{await app.close();await prisma.$disconnect();process.exit(0);});`;
    child=spawn(process.execPath,["--input-type=module","-e",script],{env:{...process.env,DATABASE_URL:url.href,NODE_ENV:"test"},stdio:["ignore","pipe","pipe","ipc"]});
    const [message]=await once(child,"message",{signal:AbortSignal.timeout(15000)});const origin=(message as any).origin;
    for(const entry of entries){
      const response=await fetch(origin+"/games",{method:"POST",headers:{"content-type":"application/json","idempotency-key":entry.key},body:JSON.stringify(entry.payload)});
      assert.equal(response.status,201);const state=await response.json();assert.equal(state.gameId,entry.gameId);assert.equal(state.playerId,entry.playerId);assert.equal(state.playerToken,entry.key);assert.equal(state.status,entry.status);assert.equal(state.timeLimitSeconds,null);assert.equal(state.expiresAt,null);
    }
    assert.deepEqual(await db.$queryRawUnsafe('SELECT to_jsonb(t) AS row FROM "Player" t ORDER BY id'),playersBefore);
    assert.deepEqual(await db.$queryRawUnsafe(`SELECT to_jsonb(t) - 'timeLimitSeconds' - 'expiresAt' AS row FROM "Game" t ORDER BY id`),before);
    await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,migration:latest,exactOriginalColumnsPreserved:true,existingWaitingActiveFinishedRemainUntimed:true,preUpgradeCreateFingerprintsRecovered:3,originalCredentialsAndRevisionsPreserved:true},null,2));console.log(`Timed-round upgrade evidence: ${output}`);
  } finally {if(child){const closed=once(child,"exit");child.kill("SIGTERM");await closed;}await db.$disconnect();await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.$disconnect();}
});
