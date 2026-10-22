import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer as createHttpsServer } from "node:https";
import { request as httpRequest } from "node:http";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, type BrowserContext } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
after(async () => { await prisma.$disconnect(); });

test("hosted beta build uses its declared HTTPS server, minimal permissions, privacy and real multiplayer", { timeout: 120000 }, async () => {
  const temp = await mkdtemp(resolve(".local/wr-beta-"));
  const output = resolve(".jes/local/ewp-016/browser"); await mkdir(output, { recursive: true });
  const assets = resolve(`${output}/store-assets`); await mkdir(assets, { recursive: true });
  const cert = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-keyout", `${temp}/key.pem`, "-out", `${temp}/cert.pem`, "-subj", "/CN=beta.example.test"], { stdio: "ignore" });
  assert.equal(cert.status, 0);
  let backend = "";
  const proxy = createHttpsServer({ key: await readFile(`${temp}/key.pem`), cert: await readFile(`${temp}/cert.pem`) }, (request, reply) => {
    const upstream = httpRequest(`${backend}${request.url}`, { method: request.method, headers: request.headers }, response => {
      reply.writeHead(response.statusCode!, response.headers); response.pipe(reply);
    });
    upstream.on("error", () => { reply.writeHead(502); reply.end(); }); request.pipe(upstream);
  });
  proxy.on("upgrade", (request, client, head) => {
    const upstream = httpRequest(`${backend}${request.url}`, { headers: request.headers });
    upstream.on("upgrade", (response, socket, upstreamHead) => {
      client.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n\r\n`);
      if (head.length) socket.write(head); if (upstreamHead.length) client.write(upstreamHead);
      client.pipe(socket); socket.pipe(client);
      client.on("error", () => socket.destroy()); socket.on("error", () => client.destroy());
      client.on("close", () => socket.destroy()); socket.on("close", () => client.destroy());
    });
    upstream.on("error", () => client.destroy()); upstream.end();
  });
  proxy.listen(0, "127.0.0.1"); await once(proxy, "listening");
  const origin = `https://beta.example.test:${(proxy.address() as { port: number }).port}`;
  const beta = { publicOrigin: origin, supportEmail: "jaxmerc03@gmail.com", operatorName: "WikiRace", trustProxyHops: 0, maxGames: 200, retentionDays: 30 };
  const app = buildApp({ beta, retention: false });
  const contexts: BrowserContext[] = [];
  try {
    backend = await app.listen({ port: 0, host: "127.0.0.1" });
    const build = spawnSync(process.execPath, ["build.mjs"], { cwd: resolve("apps/extension"), env: { ...process.env, WIKIRACE_EXTENSION_TARGET: "beta", WIKIRACE_PUBLIC_ORIGIN: origin }, encoding: "utf8" });
    assert.equal(build.status, 0, build.stderr);
    const extension = resolve("apps/extension/dist-beta");
    const manifest = JSON.parse(await readFile(`${extension}/manifest.json`, "utf8"));
    assert.deepEqual(manifest.permissions, ["storage", "alarms"]);
    assert.deepEqual(manifest.host_permissions, ["https://en.wikipedia.org/*", `${origin}/*`]);
    assert.equal(manifest.optional_host_permissions, undefined);
    const launch = async (name: string) => {
      const context = await chromium.launchPersistentContext(`${temp}/${name}`, { channel: "chromium", headless: true, viewport: { width: 1280, height: 800 },
        args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, "--ignore-certificate-errors", "--no-proxy-server", "--host-resolver-rules=MAP beta.example.test 127.0.0.1"] });
      contexts.push(context);
      const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
      const id = worker.url().split("/")[2]; const page = await context.newPage();
      await page.goto(`chrome-extension://${id}/popup.html?view=board`);
      await expect(page.locator("#connection")).toContainText(origin);
      await expect(page.locator("#server-settings")).toBeHidden();
      return { context, page, id };
    };
    const host = await launch("host"); const guest = await launch("guest");
    await host.page.locator("#player-name").fill("Aurora");
    await host.page.locator("#start").click();
    await expect(host.page.locator("#status")).toContainText("Mark Ready");
    const initial = await host.page.evaluate(() => chrome.runtime.sendMessage({ type: "GET_GAME_STATE" }));
    // Stable, recognizable article names for the synthetic store demonstration.
    // A later join triggers the normal state refresh; production generation is unchanged.
    const demoArticles = ["Earth", "Moon", "Mars", "Saturn", "Ocean", "Mountain", "Volcano", "Sunflower", "Symphony", "Photography", "Great Wall of China", "Paris", "Telescope", "Chess", "Compass"];
    for (const [i, square] of initial.board.squares.filter((s: any) => s.type === "VISIT_ARTICLE").entries()) {
      square.condition = { title: demoArticles[i] }; square.label = `Visit ${demoArticles[i]}`;
      await prisma.boardSquare.update({ where: { id: square.id }, data: { condition: square.condition, label: square.label } });
    }
    await guest.page.locator("#player-name").fill("Atlas");
    await guest.page.locator("#join-game-id").fill(`${origin}/join/${initial.gameId}`);
    await guest.page.locator("#join-game-btn").click();
    await expect(guest.page.locator("#status")).toContainText("Mark Ready");
    await expect.poll(async () => (await host.page.evaluate(() => chrome.runtime.sendMessage({ type: "GET_GAME_STATE" }))).playerCount).toBe(2);
    await host.page.screenshot({ path: `${output}/beta-lobby.png` });
    await host.page.locator("#set-ready").click(); await guest.page.locator("#set-ready").click();
    await host.page.locator("#start-match").click(); await expect(guest.page.locator("#status")).toContainText("Match active");
    const square = initial.board.squares.find((s: any) => s.type === "VISIT_ARTICLE"); assert.ok(square);
    const title = square.condition.title;
    const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
    await host.context.route(articleUrl, route => route.fulfill({ contentType: "text/html", body: `<html><h1 id="firstHeading">${title.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</h1><div id="mw-content-text"><a href="/wiki/Earth">Earth</a></div></html>` }));
    const article = await host.context.newPage(); await article.goto(articleUrl);
    await expect.poll(async () => (await host.page.evaluate(() => chrome.runtime.sendMessage({ type: "GET_GAME_STATE" }))).completedSquareIds.length).toBeGreaterThan(0);
    assert.equal((await guest.page.evaluate(() => chrome.runtime.sendMessage({ type: "GET_GAME_STATE" }))).completedSquareIds.length, 0);
    const saved = await prisma.pageVisitEvent.findMany({ where: { gameId: initial.gameId } });
    assert.equal(saved.length, 1); assert.deepEqual(saved[0].links, []);
    const viewer = await host.context.newPage(); await viewer.goto(`${origin}/overlay/${initial.gameId}?playerId=${initial.playerId}`);
    await expect(viewer.locator("#board .tile")).toHaveCount(25);
    await viewer.screenshot({ path: `${assets}/01-live-game.png` });
    await host.page.locator("#board").evaluate(element => element.scrollIntoView({ block: "start" }));
    await host.page.screenshot({ path: `${assets}/02-player-board.png` });
    const newPage = host.context.waitForEvent("page"); await host.page.locator("#privacy-policy").click();
    const policy = await newPage; await policy.waitForLoadState();
    await expect(policy.locator("body")).toContainText("jaxmerc03@gmail.com");
    await policy.screenshot({ path: `${output}/privacy.png`, fullPage: true });
    await host.page.locator("#host-end").click();
    await expect.poll(async () => (await host.page.evaluate(() => chrome.runtime.sendMessage({ type: "GET_GAME_STATE" }))).status).toBe("FINISHED");
    await host.page.screenshot({ path: `${output}/beta-results.png` });
  } finally {
    for (const context of contexts) await context.close();
    await app.close(); await new Promise<void>(resolve => proxy.close(() => resolve()));
    await rm(temp, { recursive: true, force: true });
  }
});
