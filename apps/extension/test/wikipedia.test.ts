import { test } from "node:test";
import assert from "node:assert/strict";
import { isArticleUrl, normalizeApiOrigin } from "../src/wikipedia.js";

test("article filtering accepts real article paths and rejects namespaces and lookalike origins", () => {
  for(const url of ["https://en.wikipedia.org/wiki/Science", "https://en.wikipedia.org/wiki/Star_Trek:_Voyager#Cast", "https://en.wikipedia.org/wiki/%C3%89mile_Zola"]) assert.equal(isArticleUrl(url),true,url);
  for(const url of ["https://en.wikipedia.org.evil.example/wiki/Science", "https://en.wikipedia.org/wiki/Category:Science", "https://en.wikipedia.org/wiki/Main_Page", "https://en.wikipedia.org/wiki/Special:Random", "https://en.wikipedia.org/wiki/", "https://en.wikipedia.org/wiki/%ZZ", "https://user@en.wikipedia.org/wiki/Science", "https://de.wikipedia.org/wiki/Wissenschaft", "http://en.wikipedia.org/wiki/Science"]) assert.equal(isArticleUrl(url),false,url);
});
test("server configuration normalizes origins and rejects paths or embedded credentials", () => {
  assert.equal(normalizeApiOrigin(" http://localhost:4000/ "),"http://localhost:4000");
  assert.equal(normalizeApiOrigin("https://game.example"),"https://game.example");
  for(const value of ["file:///tmp/game", "javascript:alert(1)", "https://user:pass@game.example", "https://game.example/api", "https://game.example/?token=x", "not a URL"]) assert.throws(()=>normalizeApiOrigin(value));
});
