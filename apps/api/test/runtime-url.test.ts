import { test } from "node:test";
import assert from "node:assert/strict";
import { runtimeDatabaseUrl } from "../src/db/runtime-url.js";

test("runtime database defaults bound connect, pool and stalled-query waits while preserving schema",()=>{
  const url=new URL(runtimeDatabaseUrl("postgresql://player:example-password@127.0.0.1:55432/wikirace?schema=isolated"));
  assert.equal(url.searchParams.get("connect_timeout"),"3");assert.equal(url.searchParams.get("pool_timeout"),"5");assert.equal(url.searchParams.get("socket_timeout"),"5");assert.equal(url.searchParams.get("schema"),"isolated");assert.equal(url.password,"example-password");
});
test("explicit operator timeout settings and other connection parameters remain intact",()=>{
  const url=new URL(runtimeDatabaseUrl("postgres://player@localhost/wikirace?socket_timeout=12&pool_timeout=0&connect_timeout=7&connection_limit=4"));
  assert.equal(url.searchParams.get("socket_timeout"),"12");assert.equal(url.searchParams.get("pool_timeout"),"0");assert.equal(url.searchParams.get("connect_timeout"),"7");assert.equal(url.searchParams.get("connection_limit"),"4");
});
test("invalid database configuration fails clearly without echoing a credential-bearing URL",()=>{
  for(const input of [undefined,"not a URL","https://example.invalid","postgresql://u:p@localhost/db?socket_timeout=-1","postgresql://u:p@localhost/db?pool_timeout=forever"])assert.throws(()=>runtimeDatabaseUrl(input),error=>error instanceof Error&&!error.message.includes("u:p"));
});
test("a beta pool default bounds connections without replacing an explicit operator limit", () => {
  assert.equal(new URL(runtimeDatabaseUrl("postgresql://user@localhost/db", 5)).searchParams.get("connection_limit"), "5");
  assert.equal(new URL(runtimeDatabaseUrl("postgresql://user@localhost/db?connection_limit=3", 5)).searchParams.get("connection_limit"), "3");
});
