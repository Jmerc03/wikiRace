import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const models=["game","player","team","board","boardSquare","pageVisitEvent","squareCompletion","squareClaim"] as const;
async function rows(db:PrismaClient){const result:any={};for(const model of models)result[model]=await (db[model] as any).findMany({orderBy:{id:"asc"}});return result;}
const digest=(value:any)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("a PostgreSQL archive restores exact game history, outcomes and authenticated sessions into a new database",{timeout:60000},async()=>{
  const output=resolve(".jes/local/ewp-006/backup",String(Date.now()));await mkdir(output,{recursive:true,mode:0o700});console.log(`Backup/restore evidence: ${output}`);
  const app=buildApp();await app.ready();const source=new URL(process.env.DATABASE_URL!);const schema=source.searchParams.get("schema")!;assert.match(schema,/^wr_test_[a-zA-Z0-9_]+$/);
  const restoreName=`wr_restore_${randomUUID().replaceAll("-","")}`;const target=new URL(source);target.pathname=`/${restoreName}`;const restored=new PrismaClient({datasourceUrl:target.href});let created=false;let child:ReturnType<typeof spawn>|undefined;
  const command=(binary:string,args:string[])=>{const result=spawnSync(binary,args,{encoding:"utf8"});assert.equal(result.status,0,result.stderr||String(result.error));};
  const admissions:{path:string;payload:any;key:string;gameId:string;playerId:string}[]=[];
  const post=async(path:string,payload:any,player?:any)=>{
    const key=player?undefined:randomBytes(32).toString("base64url");
    const response=await app.inject({method:"POST",url:path,payload,headers:player?{authorization:`Bearer ${player.playerToken}`}:{"idempotency-key":key!}});
    assert.ok([200,201].includes(response.statusCode),response.body);
    const result=response.json();
    if(key){assert.equal(result.playerToken,key);admissions.push({path,payload,key,gameId:result.gameId,playerId:result.playerId});}
    return result;
  };
  const players:any[]=[];
  const rematches:{source:any;next:any}[]=[];
  try{
    for(const mode of ["NORMAL","LOCKOUT"]){
      const boardConfig=mode==="NORMAL"?{difficulty:"HARD",vitalArticleTileCount:11,genericTileCount:14,maxTilesPerTopic:1}:{difficulty:"EASY",vitalArticleTileCount:22,genericTileCount:3,maxTilesPerTopic:2};
      const host=await post("/games",{mode,displayName:`Backup ${mode} host`,boardConfig,timeLimitSeconds:600});assert.deepEqual(host.boardConfig,boardConfig);const guest=await post(`/games/${host.gameId}/players`,{displayName:`Backup ${mode} guest`});players.push(host,guest);
      const squares=await prisma.boardSquare.findMany({where:{board:{gameId:host.gameId}}});for(const square of squares)await prisma.boardSquare.update({where:{id:square.id},data:{type:"VISIT_ARTICLE",condition:{title:`Restore fixture ${square.position}`}}});
      if(mode==="LOCKOUT"){const team=await post(`/games/${host.gameId}/teams`,{playerId:host.playerId,name:"Restored team"},host);for(const player of [host,guest])await post(`/games/${host.gameId}/teams/${team.id}/join`,{playerId:player.playerId},player);}
      for(const player of [host,guest])await post(`/games/${host.gameId}/ready`,{playerId:player.playerId,isReady:true},player);
      if(mode==="LOCKOUT")await post(`/games/${host.gameId}/join-lock`,{playerId:host.playerId,isJoinLocked:true},host);
      await post(`/games/${host.gameId}/start`,{playerId:host.playerId},host);
      for(let i=0;i<(mode==="LOCKOUT"?13:3);i++){const player=i%2?guest:host;await post(`/games/${host.gameId}/events/page-visit`,{playerId:player.playerId,title:`Restore fixture ${i}`,url:`https://en.wikipedia.org/wiki/Restore_fixture_${i}`,categories:["Fixture category"],links:["/wiki/Science"]},player);}
    }
    const waiting=await post("/games",{displayName:"Waiting recovery host",timeLimitSeconds:60});players.push(waiting);
    // The finished Lockout pair enters a linked lobby before the archive. Its
    // per-round credentials must remain recoverable from the original tokens.
    for(const source of players.slice(2,4)){
      const next=await post(`/games/${source.gameId}/rematch`,{playerId:source.playerId},source);
      assert.deepEqual(next.boardConfig,source.boardConfig);
      rematches.push({source,next});
    }
    players.push(...rematches.map(pair=>pair.next));
    // Mixed lobby readiness and all-ready solo lobby must survive exact restore.
    await post(`/games/${waiting.gameId}/ready`,{playerId:waiting.playerId,isReady:true},waiting);
    const nextHost=rematches[0].next;
    await post(`/games/${nextHost.gameId}/ready`,{playerId:nextHost.playerId,isReady:true},nextHost);
    await post(`/games/${nextHost.gameId}/join-lock`,{playerId:nextHost.playerId,isJoinLocked:true},nextHost);
    const removed=await post(`/games/${waiting.gameId}/players`,{displayName:"Removed before archive"});
    await post(`/games/${waiting.gameId}/players/${removed.playerId}/remove`,{playerId:waiting.playerId},waiting);
    await post(`/games/${waiting.gameId}/join-lock`,{playerId:waiting.playerId,isJoinLocked:true},waiting);
    const expired=await post("/games",{displayName:"Expired timer archive",timeLimitSeconds:60});players.push(expired);
    await post(`/games/${expired.gameId}/ready`,{playerId:expired.playerId,isReady:true},expired);
    await post(`/games/${expired.gameId}/start`,{playerId:expired.playerId},expired);
    const deadline=new Date(Date.now()-1000);
    await prisma.game.update({where:{id:expired.gameId},data:{startedAt:new Date(deadline.getTime()-60000),expiresAt:deadline}});
    const ended=await post(`/games/${expired.gameId}/events/page-visit`,{playerId:expired.playerId,title:"After time",url:"https://en.wikipedia.org/wiki/Science"},expired);
    assert.equal(ended.endReason,"TIME_LIMIT");assert.equal(ended.finishedAt,deadline.toISOString());
    const before=await rows(prisma);assert.equal(admissions.length,7);assert.ok(before.player.filter((player:any)=>!player.rematchSourcePlayerId).every((player:any)=>/^[a-f0-9]{64}$/.test(player.admissionRequestHash)));const sourceHash=digest(before);const expectedStates=[];
    for(const player of players){const response=await app.inject({url:`/games/${player.gameId}/state?playerId=${player.playerId}`,headers:{authorization:`Bearer ${player.playerToken}`}});assert.equal(response.statusCode,200);expectedStates.push(response.json());}
    const archive=resolve(output,"qualification.dump");const dumpUrl=new URL(source);dumpUrl.searchParams.delete("schema");
    command("pg_dump",["--dbname",dumpUrl.href,"--schema",schema,"--format=custom","--file",archive]);await chmod(archive,0o600);
    const archiveHash=createHash("sha256").update(await readFile(archive)).digest("hex");
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${restoreName}"`);created=true;
    const restoreUrl=new URL(target);restoreUrl.searchParams.delete("schema");command("pg_restore",["--dbname",restoreUrl.href,"--exit-on-error","--no-owner","--no-privileges",archive]);
    const after=await rows(restored);assert.equal(digest(after),sourceHash);assert.equal(digest(await rows(prisma)),sourceHash,"Source rows must be unchanged by backup/restore");
    const script=`import {buildApp} from './apps/api/dist/app.js';import {prisma} from './apps/api/dist/db/prisma.js';const app=buildApp();const origin=await app.listen({port:0,host:'127.0.0.1'});process.send({origin});process.on('SIGTERM',async()=>{await app.close();await prisma.$disconnect();process.exit(0);});`;
    child=spawn(process.execPath,["--input-type=module","-e",script],{env:{...process.env,DATABASE_URL:target.href,NODE_ENV:"test"},stdio:["ignore","pipe","pipe","ipc"]});let childErrors="";child.stderr?.on("data",data=>{childErrors+=data.toString();});const [message]=await once(child,"message",{signal:AbortSignal.timeout(15000)});const origin=(message as any).origin;assert.ok(origin,childErrors);
    for(let i=0;i<players.length;i++){const player=players[i];const response=await fetch(`${origin}/games/${player.gameId}/state?playerId=${player.playerId}`,{headers:{authorization:`Bearer ${player.playerToken}`}});assert.equal(response.status,200);assert.deepEqual(await response.json(),expectedStates[i]);}
    for(const admission of admissions){
      const replay=await fetch(`${origin}${admission.path}`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":admission.key},body:JSON.stringify(admission.payload)});
      if(admission.playerId===removed.playerId){assert.equal(replay.status,409);continue;}
      assert.ok([200,201].includes(replay.status));const recovered=await replay.json();assert.equal(recovered.gameId,admission.gameId);assert.equal(recovered.playerId,admission.playerId);assert.equal(recovered.playerToken,admission.key);
      const conflict=await fetch(`${origin}${admission.path}`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":admission.key},body:JSON.stringify({...admission.payload,displayName:"Conflicting restored request"})});
      assert.equal(conflict.status,409);
    }
    for(const {source:previous,next} of rematches){
      const replay=await fetch(`${origin}/games/${previous.gameId}/rematch`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${previous.playerToken}`},body:JSON.stringify({playerId:previous.playerId})});
      assert.equal(replay.status,200);const recovered=await replay.json();assert.equal(recovered.gameId,next.gameId);assert.equal(recovered.playerId,next.playerId);assert.equal(recovered.playerToken,next.playerToken);
      assert.equal(recovered.teams[0].players.length,2);
    }
    assert.equal(digest(await rows(restored)),sourceHash,"Replayed and conflicting admissions must not mutate restored rows or revisions");
    assert.equal(digest(await rows(prisma)),sourceHash,"Restored admissions must leave source rows unchanged");
    const revoked=await fetch(`${origin}/games/${removed.gameId}/state?playerId=${removed.playerId}`,{headers:{authorization:`Bearer ${removed.playerToken}`}});assert.equal(revoked.status,401);assert.match(await revoked.text(),/host removed you/);
    const locked=await fetch(`${origin}/games/${waiting.gameId}/players`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:"Blocked after restore"})});assert.equal(locked.status,409);
    const started=await fetch(`${origin}/games/${waiting.gameId}/start`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${waiting.playerToken}`},body:JSON.stringify({playerId:waiting.playerId})});assert.equal(started.status,200);assert.equal((await started.json()).status,"ACTIVE");
    const childClosed=once(child,"exit");child.kill("SIGTERM");await childClosed;child=undefined;
    await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,profile:"actual pg_dump custom archive and pg_restore into a unique new PostgreSQL database; restored compiled API authenticated with existing test tokens, original admission keys and recovered rematch credentials",sourceSchema:schema,temporaryRestoreDatabase:restoreName,archiveSha256:archiveHash,exactRowSha256:sourceHash,counts:Object.fromEntries(models.map(model=>[model,before[model].length])),sourceUnchanged:true,authenticatedSessions:players.length,allSixAdmissionsRecovered:true,recoveredRematchMemberships:rematches.length,rematchTeamPreserved:true,mixedLobbyReadinessPreserved:true,joinLocksPreserved:true,revokedMembershipsStillRejected:1,admissionHashesPreserved:true,replayLeavesExactRowsUnchanged:true,conflictingRestoredRequestsRejected:true,restoredHostAction:true,normalProgressPreserved:true,teamMajorityWinnerPreserved:true,customBoardConfigurationsPreserved:true,waitingActiveAndExpiredTimersPreserved:true,archivePermissions:"0600"},null,2));
  }catch(error){await writeFile(resolve(output,"failure.json"),JSON.stringify({passed:false,error:String(error),temporaryRestoreDatabase:restoreName},null,2));throw error;}
  finally{if(child){const closed=once(child,"exit");child.kill("SIGTERM");await closed;}await app.close();await restored.$disconnect();if(created)await prisma.$executeRawUnsafe(`DROP DATABASE "${restoreName}"`);await prisma.$disconnect();}
});
