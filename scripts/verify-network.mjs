import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { createServer } from "node:net";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { WebSocket } from "ws";

const root=resolve(import.meta.dirname,"..");
const output=resolve(root,".jes/local/ewp-008/network",String(Date.now()));await mkdir(output,{recursive:true});
const original=JSON.parse(await readFile(resolve(root,".local/runtime.json"),"utf8"));
if(original.dbMode!=="native")throw new Error("This qualification requires the owned native PostgreSQL profile.");
const address=Object.values(networkInterfaces()).flat().find(item=>item&&!item.internal&&item.family==="IPv4"&&/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(item.address))?.address;
if(!address)throw new Error("No private IPv4 interface is available for the local-interface qualification.");
const reservation=createServer();reservation.listen(0,"127.0.0.1");await once(reservation,"listening");const port=reservation.address().port;await new Promise(done=>reservation.close(done));
const name=`wikirace_network_${Date.now()}_${randomBytes(4).toString("hex")}`;const records=[];
const requireApi=createRequire(resolve(root,"apps/api/package.json"));const {PrismaClient}=requireApi("@prisma/client");
const source=new PrismaClient({datasourceUrl:original.databaseUrl});let target;let socket;let switched=false;let created=false;let restored=false;
const originalCount=await source.game.count();
function run(command,args,env={},expected=0){const r=spawnSync(command,args,{cwd:root,encoding:"utf8",env:{...process.env,...env}});records.push({command:[command,...args],configuration:env,status:r.status,stdout:r.stdout,stderr:r.stderr});assert.equal(r.status,expected,r.stderr||r.stdout);return r;}
const local=command=>run(process.execPath,["scripts/local.mjs",command]);
const setup=(databaseName,apiHost,apiPort)=>run(process.platform==="win32"?"npm.cmd":"npm",["run","setup:local"],{WIKIRACE_DB_MODE:original.dbMode,WIKIRACE_DB_PORT:String(original.dbPort),WIKIRACE_DATABASE_NAME:databaseName,WIKIRACE_API_PORT:String(apiPort),WIKIRACE_API_HOST:apiHost});
const request=async(path,body,session)=>{const r=await fetch(`http://${address}:${port}${path}`,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...(session?{Authorization:`Bearer ${session.playerToken}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(5000)});assert.ok(r.ok,`Network request failed (${r.status})`);return r.json();};
try {
  // A running binding change must be rejected before rewriting the saved profile.
  const before=await readFile(resolve(root,".local/runtime.json"),"utf8");
  run(process.platform==="win32"?"npm.cmd":"npm",["run","setup:local"],{WIKIRACE_API_HOST:(original.apiHost??"127.0.0.1")==="127.0.0.1"?"0.0.0.0":"127.0.0.1"},1);
  assert.equal(await readFile(resolve(root,".local/runtime.json"),"utf8"),before);
  local("stop");switched=true;created=true;setup(name,"0.0.0.0",port);local("start");
  const status=JSON.parse(local("status").stdout);assert.equal(status.ready,true);assert.equal(status.profileMatches,true);assert.equal(status.apiHost,"0.0.0.0");assert.ok(status.connectionAddresses.includes(`http://${address}:${port}`));
  const ready=await request("/ready");assert.ok(ready.capabilities.includes("recoverable-admission-v1"));
  const host=await request("/games",{displayName:"Local-interface host"});const guest=await request(`/games/${host.gameId}/players`,{displayName:"Local-interface guest"});
  for(const player of [host,guest])await request(`/games/${host.gameId}/ready`,{playerId:player.playerId,isReady:true},player);
  socket=new WebSocket(`ws://${address}:${port}/ws/${host.gameId}`);await Promise.race([once(socket,"open"),new Promise((_,reject)=>setTimeout(()=>reject(new Error("Network WebSocket timeout")),5000).unref())]);
  const update=new Promise(resolve=>socket.on("message",data=>{if(JSON.parse(String(data)).type==="GAME_STATE_UPDATED")resolve();}));await request(`/games/${host.gameId}/start`,{playerId:host.playerId},host);await update;
  assert.equal((await request(`/games/${host.gameId}/state?playerId=${guest.playerId}`,undefined,guest)).status,"ACTIVE");
  const inviteResponse=await fetch(`http://${address}:${port}/join/${host.gameId}`,{signal:AbortSignal.timeout(5000)});assert.equal(inviteResponse.status,200);
  target=new PrismaClient({datasourceUrl:`postgresql://wikirace@127.0.0.1:${original.dbPort}/${name}`});
  const listen=await target.$queryRawUnsafe("SHOW listen_addresses");assert.equal(listen[0].listen_addresses,"127.0.0.1");
  await writeFile(resolve(output,"checks.json"),JSON.stringify({profile:"same Mac through its observed private IPv4 interface; not a second machine",address,port,apiReady:true,networkHttpAndWebSocket:true,explicitBinding:true,databaseStillLoopbackOnly:true,runningBindingChangeRejected:true,sourceGameCountBefore:originalCount},null,2));
} finally {
  socket?.terminate();await target?.$disconnect();
  if(switched){local("stop");setup(original.databaseName??new URL(original.databaseUrl).pathname.slice(1),original.apiHost??"127.0.0.1",original.port);local("start");restored=true;}
  if(created&&restored)await source.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}"`);
  assert.equal(await source.game.count(),originalCount);await source.$disconnect();await writeFile(resolve(output,"commands.json"),JSON.stringify(records,null,2));
}
const result={passed:true,profile:"same-host private-interface HTTP/WebSocket and managed profile rollback",originalProfileRestored:restored,originalGameCountPreserved:true,temporaryDatabaseRemoved:true,operatorServiceLeftReady:true,secondMachineQualified:false};await writeFile(resolve(output,"result.json"),JSON.stringify(result,null,2));console.log(`Network operator verification passed: ${output}`);
