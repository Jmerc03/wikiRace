import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createHash, randomUUID } from "node:crypto";
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
  const post=async(path:string,payload:any,player?:any)=>{const response=await app.inject({method:"POST",url:path,payload,headers:player?{authorization:`Bearer ${player.playerToken}`}:{}});assert.ok([200,201].includes(response.statusCode),response.body);return response.json();};
  const players:any[]=[];
  try{
    for(const mode of ["NORMAL","LOCKOUT"]){
      const host=await post("/games",{mode,displayName:`Backup ${mode} host`});const guest=await post(`/games/${host.gameId}/players`,{displayName:`Backup ${mode} guest`});players.push(host,guest);
      const squares=await prisma.boardSquare.findMany({where:{board:{gameId:host.gameId}}});for(const square of squares)await prisma.boardSquare.update({where:{id:square.id},data:{type:"VISIT_ARTICLE",condition:{title:`Restore fixture ${square.position}`}}});
      if(mode==="LOCKOUT"){const team=await post(`/games/${host.gameId}/teams`,{playerId:host.playerId,name:"Restored team"},host);for(const player of [host,guest])await post(`/games/${host.gameId}/teams/${team.id}/join`,{playerId:player.playerId},player);}
      await post(`/games/${host.gameId}/start`,{playerId:host.playerId},host);
      for(let i=0;i<(mode==="LOCKOUT"?13:3);i++){const player=i%2?guest:host;await post(`/games/${host.gameId}/events/page-visit`,{playerId:player.playerId,title:`Restore fixture ${i}`,url:`https://en.wikipedia.org/wiki/Restore_fixture_${i}`,categories:["Fixture category"],links:["/wiki/Science"]},player);}
    }
    players.push(await post("/games",{displayName:"Waiting recovery host"}));
    const before=await rows(prisma);const sourceHash=digest(before);const expectedStates=[];
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
    const waiting=players.at(-1);const started=await fetch(`${origin}/games/${waiting.gameId}/start`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${waiting.playerToken}`},body:JSON.stringify({playerId:waiting.playerId})});assert.equal(started.status,200);assert.equal((await started.json()).status,"ACTIVE");
    const childClosed=once(child,"exit");child.kill("SIGTERM");await childClosed;child=undefined;
    await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,profile:"actual pg_dump custom archive and pg_restore into a unique new PostgreSQL database; restored compiled API authenticated with existing test tokens",sourceSchema:schema,temporaryRestoreDatabase:restoreName,archiveSha256:archiveHash,exactRowSha256:sourceHash,counts:Object.fromEntries(models.map(model=>[model,before[model].length])),sourceUnchanged:true,allFiveSessionsAuthenticated:true,restoredHostAction:true,normalProgressPreserved:true,teamMajorityWinnerPreserved:true,archivePermissions:"0600"},null,2));
  }catch(error){await writeFile(resolve(output,"failure.json"),JSON.stringify({passed:false,error:String(error),temporaryRestoreDatabase:restoreName},null,2));throw error;}
  finally{if(child){const closed=once(child,"exit");child.kill("SIGTERM");await closed;}await app.close();await restored.$disconnect();if(created)await prisma.$executeRawUnsafe(`DROP DATABASE "${restoreName}"`);await prisma.$disconnect();}
});
