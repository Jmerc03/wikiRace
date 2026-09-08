import { readFile, writeFile, mkdir, chmod, rename } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const config=JSON.parse(await readFile(resolve(".local/runtime.json"),"utf8"));const database=new URL(config.databaseUrl);
const backupRoot=resolve(".local/backups");await mkdir(backupRoot,{recursive:true,mode:0o700});
const createdAt=new Date().toISOString();const output=resolve(backupRoot,createdAt.replaceAll(":","-")+"-"+randomUUID().slice(0,8));await mkdir(output,{mode:0o700});
const partial=resolve(output,"wikirace.dump.partial");const archive=resolve(output,"wikirace.dump");
function run(binary,args){const result=spawnSync(binary,args,{encoding:"utf8"});if(result.status!==0)throw new Error(`${binary} failed: ${result.stderr||result.error||result.stdout}`);return result.stdout.trim();}
try{
  const pgDumpVersion=run("pg_dump",["--version"]);
  run("pg_dump",["--dbname",config.databaseUrl,"--schema","public","--format=custom","--file",partial]);await chmod(partial,0o600);
  run("pg_restore",["--list",partial]);await rename(partial,archive);
  const sha256=createHash("sha256").update(await readFile(archive)).digest("hex");
  await writeFile(resolve(output,"manifest.json"),JSON.stringify({complete:true,createdAt,archive:"wikirace.dump",sha256,pgDumpVersion,source:{host:database.hostname,port:database.port,database:database.pathname.slice(1),schema:"public"}},null,2)+"\n",{mode:0o600});
  console.log(`Backup ready: ${archive}\nSHA-256: ${sha256}\nRestore instructions: ${resolve("docs/BACKUP_RESTORE.md")}`);
}catch(error){await writeFile(resolve(output,"failure.json"),JSON.stringify({complete:false,createdAt,error:String(error)},null,2),{mode:0o600});throw error;}
