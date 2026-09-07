import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
let config=null;
try{config=JSON.parse(await readFile(new URL("../.local/runtime.json",import.meta.url),"utf8"));}catch(error){if(error.code!=="ENOENT")throw error;}
const env={...process.env};
if(config){env.DATABASE_URL??=config.databaseUrl;env.PORT??=String(config.port);}
const child=spawn(process.execPath,["--watch","--import","tsx","src/server.ts"],{cwd:fileURLToPath(new URL("../apps/api",import.meta.url)),stdio:"inherit",env});
child.on("error",error=>{console.error(error.message);process.exitCode=1;});
child.on("exit",code=>{process.exitCode=code??0;});
