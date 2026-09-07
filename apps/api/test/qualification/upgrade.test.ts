import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
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
