import { spawnSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root=fileURLToPath(new URL("../",import.meta.url));
const output=resolve(root,".jes/local/ewp-004/operator",String(Date.now()));
await mkdir(output,{recursive:true});
const config=JSON.parse(await readFile(resolve(root,".local/runtime.json"),"utf8"));
const requireApi=createRequire(new URL("../apps/api/package.json",import.meta.url));
const {PrismaClient}=requireApi("@prisma/client");
const db=new PrismaClient({datasourceUrl:config.databaseUrl});
const origin=`http://127.0.0.1:${config.port}`;
const records=[];
function run(...args){const result=spawnSync(process.execPath,[resolve(root,"scripts/local.mjs"),...args],{cwd:root,encoding:"utf8"});records.push({command:['node','scripts/local.mjs',...args],status:result.status,stdout:result.stdout,stderr:result.stderr});assert.equal(result.status,0,result.stderr || result.stdout);}
let gameId;
try{
  const count=await db.game.count();
  run("start");run("start");
  const created=await fetch(`${origin}/games`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:"Local startup verification"})});
  assert.equal(created.status,201);const session=await created.json();gameId=session.gameId;
  const originalOwner=JSON.parse(await readFile(resolve(root,".local/api-owner.json"),"utf8"));
  await db.$disconnect();
  run("stop","--database");
  run("stop","--database");
  run("start");
  const newOwner=JSON.parse(await readFile(resolve(root,".local/api-owner.json"),"utf8"));
  assert.notEqual(newOwner.instanceId,originalOwner.instanceId);
  const restored=await fetch(`${origin}/games/${session.gameId}/state?playerId=${session.playerId}`,{headers:{authorization:`Bearer ${session.playerToken}`}});
  assert.equal(restored.status,200);const state=await restored.json();
  assert.equal(state.playerId,session.playerId);assert.equal(state.status,"WAITING");assert.equal(state.board.squares.length,25);
  assert.equal(await db.game.count(),count+1);
  // Delete only the exact game created by this verification run.
  await db.game.delete({where:{id:gameId}});gameId=undefined;
  assert.equal(await db.game.count(),count);
  run("status");
  await writeFile(resolve(output,"result.json"),JSON.stringify({profile:"actual local Mac Node/PostgreSQL service",idempotentStartStop:true,fullDatabaseAndApiRestart:true,sessionAndBoardPreserved:true,existingGameCountPreserved:true,serviceLeftRunning:true,records},null,2));
  console.log(`Operator verification passed. Evidence: ${output}`);
}finally{
  if(gameId){try{await db.game.delete({where:{id:gameId}});}catch{/* Preserve the precise failed run for recovery; no broad cleanup. */}}
  await db.$disconnect();
  await writeFile(resolve(output,"commands.json"),JSON.stringify(records,null,2));
}
