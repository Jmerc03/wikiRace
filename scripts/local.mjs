import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, access, realpath, rm } from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { createConnection } from "node:net";
import { networkInterfaces } from "node:os";

const root=fileURLToPath(new URL("../",import.meta.url));
const local=resolve(root,".local");
const data=resolve(local,"postgres");
const configPath=resolve(local,"runtime.json");
const ownerPath=resolve(local,"api-owner.json");
const requireApi=createRequire(new URL("../apps/api/package.json",import.meta.url));
const command=process.argv[2] ?? "status";
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
async function json(path){try{return JSON.parse(await readFile(path,"utf8"));}catch(error){if(error.code==="ENOENT")return null;throw error;}}
function run(binary,args,options={}) {
  const result=spawnSync(binary,args,{cwd:root,stdio:"inherit",...options});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`${binary} failed (${result.status})`);
  return result;
}
function available(binary){const result=spawnSync(binary,["--version"],{stdio:"ignore"});return !result.error&&result.status===0;}
async function occupied(port){return new Promise(done=>{const socket=createConnection({host:"127.0.0.1",port});socket.setTimeout(700);socket.once("connect",()=>{socket.destroy();done(true);});socket.once("error",()=>{socket.destroy();done(false);});socket.once("timeout",()=>{socket.destroy();done(false);});});}
async function health(origin){try{const response=await fetch(`${origin}/health`,{signal:AbortSignal.timeout(1200)});return response.ok?await response.json():null;}catch{return null;}}
async function ready(origin){try{return (await fetch(`${origin}/ready`,{signal:AbortSignal.timeout(3000)})).ok;}catch{return false;}}
function configurationKey(config){return createHash("sha256").update(JSON.stringify([config.dbMode,config.dbPort,config.port,config.databaseUrl,...((config.apiHost??"127.0.0.1")==="127.0.0.1"?[]:[config.apiHost])])).digest("hex");}
async function loadConfig(){const config=await json(configPath);if(!config)throw new Error("Run npm run setup:local first.");return config;}
function origin(config){return `http://127.0.0.1:${config.port}`;}
function connectionAddresses(config){
  if((config.apiHost??"127.0.0.1")!=="0.0.0.0")return [];
  return [...new Set(Object.values(networkInterfaces()).flat().filter(item=>item&&!item.internal&&item.family==="IPv4"&&/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(item.address)).map(item=>`http://${item.address}:${config.port}`))];
}
async function setup(){
  await mkdir(local,{recursive:true});
  const saved=await json(configPath);
  const dbPort=Number(process.env.WIKIRACE_DB_PORT ?? saved?.dbPort ?? 55432);
  const port=Number(process.env.WIKIRACE_API_PORT ?? saved?.port ?? 4000);
  const apiHost=process.env.WIKIRACE_API_HOST ?? saved?.apiHost ?? "127.0.0.1";
  if(!["127.0.0.1","0.0.0.0"].includes(apiHost))throw new Error("WIKIRACE_API_HOST must be 127.0.0.1 (this computer) or 0.0.0.0 (trusted network).");
  const databaseName=process.env.WIKIRACE_DATABASE_NAME ?? saved?.databaseName ?? (saved?.databaseUrl ? new URL(saved.databaseUrl).pathname.slice(1) : "wikirace");
  if(databaseName.length>63 || !/^wikirace(?:_[a-z0-9]+)*$/.test(databaseName))throw new Error("Use wikirace or a lowercase wikirace_ database name with letters, digits and underscores (maximum 63 characters).");
  if(![dbPort,port].every(value=>Number.isInteger(value)&&value>1023&&value<65536))throw new Error("Choose ports from 1024 through 65535.");
  const dbMode=process.env.WIKIRACE_DB_MODE ?? saved?.dbMode ?? (available("pg_ctl")?"native":"docker");
  const owner=await json(ownerPath);
  const changingProfile=saved&&(dbMode!==saved.dbMode||dbPort!==saved.dbPort||port!==saved.port||apiHost!==(saved.apiHost??"127.0.0.1")||databaseName!==new URL(saved.databaseUrl).pathname.slice(1));
  if(changingProfile&&owner&&(await health(owner.origin))?.instanceId===owner.instanceId)throw new Error("Stop the managed API with npm run local:stop before changing its database, ports or network binding. The current profile was preserved.");
  if(dbMode==="native"){
    if(!["pg_ctl","initdb","psql","createdb"].every(available))throw new Error("PostgreSQL command-line tools must be on PATH, or select WIKIRACE_DB_MODE=docker.");
    try{await access(resolve(data,"PG_VERSION"));}catch{await mkdir(data,{recursive:true});run("initdb",["-D",data,"-U","wikirace","--auth=trust","--no-locale","--encoding=UTF8"]);}
    const running=spawnSync("pg_ctl",["-D",data,"status"],{stdio:"ignore"}).status===0;
    if(!running){
      if(await occupied(dbPort))throw new Error(`Port ${dbPort} is occupied by another database/service; no data was changed.`);
      run("pg_ctl",["-D",data,"-l",resolve(local,"postgres-server.log"),"-o",`-h 127.0.0.1 -p ${dbPort}`,"start"]);
    }
    const args=["-h","127.0.0.1","-p",String(dbPort),"-U","wikirace","-d","postgres","-tA"];
    const directory=run("psql",[...args,"-c","SHOW data_directory"],{encoding:"utf8",stdio:"pipe"}).stdout.trim();
    if(await realpath(directory)!==await realpath(data))throw new Error("The selected port belongs to another database; refusing to initialize it.");
    const exists=run("psql",[...args,"-c",`SELECT 1 FROM pg_database WHERE datname='${databaseName}'`],{encoding:"utf8",stdio:"pipe"}).stdout.trim();
    if(exists!=="1")run("createdb",["-h","127.0.0.1","-p",String(dbPort),"-U","wikirace",databaseName]);
  }else if(dbMode==="docker"){
    if(dbPort!==55432)throw new Error("Docker local mode uses port 55432 from compose.local.yml.");
    if(!available("docker"))throw new Error("Install PostgreSQL tools or start Docker Desktop, then retry.");
    run("docker",["compose","-f","compose.local.yml","up","-d","--wait","postgres"]);
  }else throw new Error("WIKIRACE_DB_MODE must be native or docker.");
  const config={dbMode,dbPort,port,apiHost,databaseName,databaseUrl:`postgresql://wikirace@127.0.0.1:${dbPort}/${databaseName}`};
  const env={...process.env,DATABASE_URL:config.databaseUrl};
  for(const args of [["generate"],["migrate","deploy"]])run(process.execPath,[requireApi.resolve("prisma/build/index.js"),...args],{cwd:resolve(root,"apps/api"),env});
  await writeFile(configPath,JSON.stringify(config,null,2)+"\n",{mode:0o600});
  const npmCli=process.env.npm_execpath;
  if(!npmCli)throw new Error("Run this setup through npm run setup:local.");
  run(process.execPath,[npmCli,"run","build"],{env});
  console.log(`Local setup complete. Start with npm run local:start. Database data: ${data}`);
}
async function start(){
  const config=await loadConfig();const url=origin(config);const owner=await json(ownerPath);
  if(config.dbMode==="native"&&spawnSync("pg_ctl",["-D",data,"status"],{stdio:"ignore"}).status!==0){
    if(await occupied(config.dbPort))throw new Error(`Database port ${config.dbPort} belongs to another process; no process was changed.`);
    run("pg_ctl",["-D",data,"-l",resolve(local,"postgres-server.log"),"-o",`-h 127.0.0.1 -p ${config.dbPort}`,"start"]);
  }else if(config.dbMode==="docker")run("docker",["compose","-f","compose.local.yml","up","-d","--wait","postgres"]);
  if(await occupied(config.port)){
    const current=await health(url);
    if(owner&&current?.instanceId===owner.instanceId){
      if(owner.configurationKey&&owner.configurationKey!==configurationKey(config))throw new Error("The running API uses a different saved profile. Stop it before starting this profile.");
      if(!await ready(url))throw new Error("The WikiRace process is running but its database is not ready. Check setup/migrations and the API log.");
      console.log(`WikiRace is already running and ready: ${url}`);return;
    }
    throw new Error(`Port ${config.port} is occupied by another process. No process was stopped.`);
  }
  const server=resolve(root,"apps/api/dist/server.js");await access(server);
  const instanceId=randomUUID();const log=openSync(resolve(local,"api.log"),"a");
  const child=spawn(process.execPath,[server,`--wikirace-instance=${instanceId}`],{cwd:resolve(root,"apps/api"),detached:true,stdio:["ignore",log,log],env:{...process.env,DATABASE_URL:config.databaseUrl,HOST:config.apiHost??"127.0.0.1",PORT:String(config.port),WIKIRACE_INSTANCE_ID:instanceId}});
  closeSync(log);
  child.on("error",error=>{console.error(error.message);process.exitCode=1;});child.unref();
  await writeFile(ownerPath,JSON.stringify({pid:child.pid,instanceId,origin:url,configurationKey:configurationKey(config),startedAt:new Date().toISOString()},null,2)+"\n");
  for(let attempt=0;attempt<50;attempt++){
    if((await health(url))?.instanceId===instanceId){
      const ready=await fetch(`${url}/ready`,{signal:AbortSignal.timeout(3000)});
      if(!ready.ok)throw new Error(`API started but database is unavailable. See ${resolve(local,"api.log")}`);
      console.log(`WikiRace ready: ${url}\nAPI PID: ${child.pid}\nLoad extension: ${resolve(root,"apps/extension/dist")}`);
      if(connectionAddresses(config).length)console.log(`Trusted-network address candidates (other computers must be able to reach one): ${connectionAddresses(config).join(", ")}`);return;
    }
    await sleep(200);
  }
  throw new Error(`API did not become ready. See ${resolve(local,"api.log")}`);
}
async function stop(){
  const config=await loadConfig();const owner=await json(ownerPath);
  if(owner){
    const current=await health(owner.origin);
    if(current?.instanceId===owner.instanceId){
      process.kill(owner.pid,"SIGTERM");
      const ownedPort=Number(new URL(owner.origin).port);
      for(let i=0;i<50;i++){if(!await occupied(ownedPort))break;await sleep(100);}
      if(await occupied(ownedPort))throw new Error("API is still stopping; retry status. No force kill was issued.");
      await rm(ownerPath);console.log("WikiRace API stopped. Game data preserved.");
    }else{
      try{process.kill(owner.pid,0);throw new Error("The recorded PID cannot be verified as this WikiRace instance; no process was stopped.");}
      catch(error){if(error.code!=="ESRCH")throw error;await rm(ownerPath);console.log("Recorded API process has already stopped.");}
    }
  }else console.log("No managed WikiRace API process is recorded.");
  if(process.argv.includes("--database")){
    if(config.dbMode==="native"){
      if(spawnSync("pg_ctl",["-D",data,"status"],{stdio:"ignore"}).status===0)run("pg_ctl",["-D",data,"stop","-m","fast"]);
    }
    else run("docker",["compose","-f","compose.local.yml","stop","postgres"]);
  }
}
async function status(){const config=await loadConfig();const owner=await json(ownerPath);const result=await health(origin(config));const running=Boolean(owner&&result?.instanceId===owner.instanceId);console.log(JSON.stringify({origin:origin(config),running,ready:running&&await ready(origin(config)),profileMatches:running&&(!owner.configurationKey||owner.configurationKey===configurationKey(config)),pid:owner?.pid??null,apiHost:config.apiHost??"127.0.0.1",connectionAddresses:connectionAddresses(config),dbMode:config.dbMode,dbPort:config.dbPort,databaseName:new URL(config.databaseUrl).pathname.slice(1)},null,2));}
try{if(command==="setup")await setup();else if(command==="start")await start();else if(command==="stop")await stop();else if(command==="status")await status();else throw new Error("Use setup, start, stop, or status.");}
catch(error){console.error(error.message);process.exitCode=1;}
