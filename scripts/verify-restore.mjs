import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";

const requireApi=createRequire(new URL("../apps/api/package.json",import.meta.url));const {PrismaClient}=requireApi("@prisma/client");
const configPath=resolve(".local/runtime.json");const originalText=await readFile(configPath,"utf8");const original=JSON.parse(originalText);const origin=`http://127.0.0.1:${original.port}`;
const source=new PrismaClient({datasourceUrl:original.databaseUrl});const before=await source.game.count();const name=`wikirace_restore_${randomUUID().replaceAll("-","")}`;const restoreUrl=new URL(original.databaseUrl);restoreUrl.pathname=`/${name}`;
const output=resolve(".jes/local/ewp-006/operator-restore",String(Date.now()));await mkdir(output,{recursive:true,mode:0o700});await writeFile(resolve(output,"config-before.json"),originalText,{mode:0o600});
let created=false;let marker;let switching=false;const commands=[];
function run(binary,args,env={}){const result=spawnSync(binary,args,{encoding:"utf8",env:{...process.env,...env}});commands.push({binary,args,status:result.status,stdout:result.stdout,stderr:result.stderr});if(result.status!==0)throw new Error(`${binary} failed: ${result.stderr||result.stdout||result.error}`);return result;}
async function managedInstance(){const owner=JSON.parse(await readFile(".local/api-owner.json","utf8"));const response=await fetch(`${origin}/health`,{signal:AbortSignal.timeout(3000)});const health=await response.json();assert.equal(health.instanceId,owner.instanceId);return health.instanceId;}
try{
  const beforeInstance=await managedInstance();
  const response=await fetch(`${origin}/games`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:"Temporary backup verification"})});assert.equal(response.status,201);marker=await response.json();
  const archive=resolve(output,"operator-verification.dump");run("pg_dump",["--dbname",original.databaseUrl,"--schema","public","--format=custom","--file",archive]);await chmod(archive,0o600);
  // The uniquely created target already has an empty public schema. Clean
  // only this new target so the archive can recreate that schema exactly.
  await source.$executeRawUnsafe(`CREATE DATABASE "${name}"`);created=true;run("pg_restore",["--dbname",restoreUrl.href,"--clean","--if-exists","--exit-on-error","--no-owner","--no-privileges",archive]);
  switching=true;run("npm",["run","local:stop"]);run("npm",["run","setup:local"],{WIKIRACE_DATABASE_NAME:name});run("npm",["run","local:start"]);assert.notEqual(await managedInstance(),beforeInstance);
  const selected=JSON.parse(await readFile(configPath,"utf8"));assert.equal(selected.databaseName,name);assert.equal(new URL(selected.databaseUrl).pathname,`/${name}`);
  const restored=await fetch(`${origin}/games/${marker.gameId}/state?playerId=${marker.playerId}`,{headers:{authorization:`Bearer ${marker.playerToken}`}});assert.equal(restored.status,200);const state=await restored.json();assert.equal(state.board.id,marker.board.id);assert.equal(state.board.squares.length,25);assert.equal(state.hostPlayerId,marker.playerId);
  const started=await fetch(`${origin}/games/${marker.gameId}/start`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${marker.playerToken}`},body:JSON.stringify({playerId:marker.playerId})});assert.equal(started.status,200);assert.equal((await started.json()).status,"ACTIVE");assert.equal((await source.game.findUniqueOrThrow({where:{id:marker.gameId}})).status,"WAITING","Source database must remain unchanged by restored host actions");
  run("npm",["run","local:stop"]);await writeFile(configPath,originalText,{mode:0o600});run("npm",["run","local:start"]);switching=false;await managedInstance();
  const originalState=await fetch(`${origin}/games/${marker.gameId}/state?playerId=${marker.playerId}`,{headers:{authorization:`Bearer ${marker.playerToken}`}});assert.equal((await originalState.json()).status,"WAITING");
  await source.game.delete({where:{id:marker.gameId}});marker=undefined;assert.equal(await source.game.count(),before);
  await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,profile:"actual managed local operator API cut over to restored clone and back to unchanged original database",archiveSha256:createHash("sha256").update(await readFile(archive)).digest("hex"),sameApiOrigin:origin,restoredSavedSessionAuthenticated:true,restoredHostAction:true,sourceUnaffected:true,originalProfileRestored:true,originalGameCount:before,finalGameCount:await source.game.count(),serviceLeftRunning:true},null,2));console.log(`Operator restore verification passed: ${output}`);
}finally{
  if(switching){run("npm",["run","local:stop"]);await writeFile(configPath,originalText,{mode:0o600});run("npm",["run","local:start"]);}
  if(marker)await source.game.delete({where:{id:marker.gameId}});
  if(created)await source.$executeRawUnsafe(`DROP DATABASE "${name}"`);
  await source.$disconnect();await writeFile(resolve(output,"commands.json"),JSON.stringify(commands,null,2));
}
