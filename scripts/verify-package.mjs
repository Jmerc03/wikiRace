import { spawnSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const results=[];
for(const timezone of ["UTC","America/Los_Angeles","Asia/Tokyo"]){
  const result=spawnSync(process.execPath,["scripts/package-extension.mjs"],{env:{...process.env,TZ:timezone},encoding:"utf8"});assert.equal(result.status,0,result.stderr);
  const bytes=await readFile("apps/api/public/downloads/wikirace-extension.zip");results.push({timezone,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
}
assert.equal(new Set(results.map(result=>result.sha256)).size,1,"Extension packaging must be reproducible across time zones");
const output=resolve(".jes/local/ewp-005/package",String(Date.now()));await mkdir(output,{recursive:true});await writeFile(resolve(output,"result.json"),JSON.stringify({passed:true,results},null,2));console.log(`Package reproducibility verified: ${output}`);
