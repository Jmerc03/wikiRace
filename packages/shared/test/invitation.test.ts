import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGameInvitation, gameInvitationUrl, isLocalOnlyOrigin } from "../src/invitation.js";
const id="12345678-1234-4234-8234-123456789abc";
test("invitations preserve the explicit game and origin while bare IDs use the selected server",()=>{
  assert.deepEqual(parseGameInvitation(` ${id.toUpperCase()} `,"http://localhost:4000/"),{gameId:id,apiOrigin:"http://localhost:4000"});
  assert.deepEqual(parseGameInvitation(`https://races.example:8443/join/${id}/`,"http://localhost:4000"),{gameId:id,apiOrigin:"https://races.example:8443"});
  assert.deepEqual(parseGameInvitation(`https://races.example/spectate/${id}?playerId=${id}`,"http://localhost:4000"),{gameId:id,apiOrigin:"https://races.example"});
});
test("invitation parsing rejects credential-bearing, unrelated and ambiguous links",()=>{
  for(const input of [`https://user:secret@races.example/join/${id}`,`https://races.example/join/${id}?token=secret`,`https://races.example/join/${id}#secret`,`https://races.example/unrelated/${id}`,`https://races.example/join/${id}/more`,`https://races.example/spectate/${id}?playerId=${id}&playerId=${id}`,`https://races.example/join/${id}?playerId=${id}`,`ftp://races.example/join/${id}`,`javascript:alert(1)`,"not-a-game",`https://races.example/join/%31${id.slice(1)}`]) assert.throws(()=>parseGameInvitation(input,"http://localhost:4000"),undefined,input);
});
test("generated invitations include only normalized origin and game ID",()=>{
  const url=gameInvitationUrl("http://localhost:4000/",id.toUpperCase());assert.equal(url,`http://localhost:4000/join/${id}`);assert.throws(()=>gameInvitationUrl("https://user:secret@races.example",id));assert.throws(()=>gameInvitationUrl("https://races.example","bad"));
});
test("local-only connection hints identify loopback addresses without labeling private LAN as loopback",()=>{
  for(const origin of ["http://localhost:4000","http://127.0.0.2:4000","http://[::1]:4000","http://0.0.0.0:4000"])assert.equal(isLocalOnlyOrigin(origin),true);
  for(const origin of ["http://192.168.1.22:4000","https://races.example"])assert.equal(isLocalOnlyOrigin(origin),false);
});
