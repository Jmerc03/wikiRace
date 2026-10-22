import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, type BrowserContext, type Page } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
const app = buildApp(); const output = resolve(".jes/local/ewp-013/browser", String(Date.now()));
let origin: string; let optionsFailure = false; let dropCreate = false; let committed: any; let createPosts = 0;
app.addHook("onRequest", async request => { if (request.method === "POST" && request.url === "/games") createPosts++; });
app.addHook("onSend", async (request, reply, payload) => {
  if (request.url === "/games/board-options" && optionsFailure) return JSON.stringify({ error: "Unavailable" });
  if (request.url === "/games" && request.method === "POST" && reply.statusCode === 201 && dropCreate) { committed = JSON.parse(String(payload)); reply.raw.destroy(); }
  return payload;
});
before(async () => { await mkdir(output, { recursive: true }); console.log(`Custom-board browser evidence: ${output}`); origin = await app.listen({ port: 0, host: "127.0.0.1" }); });
after(async () => { await app.close(); await prisma.$disconnect(); });
type Player = { context: BrowserContext; page: Page; extensionId: string; errors: string[] };
async function launch(profile: string): Promise<Player> {
  const extensionPath = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, { channel: "chromium", headless: true, args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`], viewport: { width: 1100, height: 950 } });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2]; const page = await context.newPage(); const errors: string[] = [];
  context.on("page", p => p.on("pageerror", e => errors.push(e.message))); page.on("pageerror", e => errors.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/popup.html?view=board`); return { context, page, extensionId, errors };
}
async function configure(p: Player, server = origin) {
  await p.page.locator("#server-settings summary").click(); await p.page.locator("#api-origin").fill(server); await p.page.locator("#save-server").click(); await expect(p.page.locator("#connection")).toContainText(server);
}
const snapshot = (p: Player): Promise<any> => p.page.evaluate(() => chrome.runtime.sendMessage({ type: "GET_GAME_STATE" }));
for (const mode of ["NORMAL", "LOCKOUT"]) test(`${mode}: custom mix and variety remain shared through lobby, restart and rematch`, { timeout: 60000 }, async () => {
  const profiles = [await mkdtemp(resolve(".local/wr-board-host-")), await mkdtemp(resolve(".local/wr-board-guest-"))]; let host: Player | undefined; let guest: Player | undefined;
  try {
    host = await launch(profiles[0]); guest = await launch(profiles[1]); await configure(host); await configure(guest);
    await host.page.locator("#game-mode").selectOption(mode); await host.page.locator("#difficulty").selectOption("HARD"); await host.page.locator("#topic-limit").selectOption("1");
    await expect(host.page.locator("#board-setup-error")).toContainText("up to 11"); await expect(host.page.locator("#start")).toBeDisabled();
    await host.page.locator("#article-count").selectOption("11"); await expect(host.page.locator("#start")).toBeEnabled();
    await host.page.screenshot({ path: resolve(output, `${mode.toLowerCase()}-setup.png`), fullPage: true });
    await host.page.locator("#start").click(); await expect(host.page.locator("#set-ready")).toBeVisible();
    const initial = await snapshot(host); const config = { difficulty: "HARD", vitalArticleTileCount: 11, genericTileCount: 14, maxTilesPerTopic: 1 };
    assert.deepEqual(initial.boardConfig, config); await expect(host.page.locator("#board-settings")).toContainText("11 named articles · 14 flexible objectives · Hard articles · Up to 1 per topic");
    await guest.page.locator("#join-game-id").fill(initial.gameId); await guest.page.locator("#join-game-btn").click(); await expect(guest.page.locator("#board-settings")).toContainText("11 named articles");
    const spectator = await host.context.newPage(); await spectator.goto(`${origin}/spectate/${initial.gameId}`); await expect(spectator.locator("#board-settings")).toContainText("Hard articles · Up to 1 per topic");
    const invite = await host.context.newPage(); await invite.goto(`${origin}/join/${initial.gameId}`); await expect(invite.locator("#invite-board-settings")).toContainText("11 named articles");
    await spectator.screenshot({ path: resolve(output, `${mode.toLowerCase()}-spectator.png`), fullPage: true });
    const compact = await host.context.newPage(); await compact.setViewportSize({ width: 540, height: 700 }); await compact.goto(`chrome-extension://${host.extensionId}/popup.html`); await expect(compact.locator("#board-settings")).toContainText("11 named articles");
    assert.ok(await compact.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await compact.screenshot({ path: resolve(output, `${mode.toLowerCase()}-compact.png`), fullPage: true });
    await guest.context.close(); guest = await launch(profiles[1]); await expect(guest.page.locator("#board-settings")).toContainText("11 named articles"); assert.deepEqual((await snapshot(guest)).boardConfig, config);
    await host.page.locator("#set-ready").click(); await guest.page.locator("#set-ready").click(); await expect(host.page.locator("#start-match")).toBeEnabled(); await host.page.locator("#start-match").click(); await expect(guest.page.locator("#status")).toContainText("Match active");
    await host.page.locator("#host-end").click(); await expect(host.page.locator("#rematch")).toBeVisible(); await host.page.locator("#rematch").click(); await expect(host.page.locator("#set-ready")).toBeVisible();
    const next = await snapshot(host); assert.notEqual(next.gameId, initial.gameId); assert.notEqual(next.board.id, initial.board.id); assert.deepEqual(next.boardConfig, config);
    await expect(guest.page.locator("#rematch")).toHaveText("Join Rematch"); await guest.page.locator("#rematch").click(); await expect(guest.page.locator("#set-ready")).toBeVisible(); assert.deepEqual((await snapshot(guest)).boardConfig, config);
    assert.equal(host.errors.length + guest.errors.length, 0, [...host.errors, ...guest.errors].join("\n"));
    await writeFile(resolve(output, `${mode.toLowerCase()}-result.json`), JSON.stringify({ passed: true, mode, config, invalidMixBlocked: true, sharedSettings: true, restart: true, rematch: true, compactFits: true }, null, 2));
  } finally { await host?.context.close(); await guest?.context.close(); for (const profile of profiles) await rm(profile, { recursive: true, force: true }); }
});

test("all-flexible and all-article boards are complete, and resetting restores the original defaults", { timeout: 60000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-board-extremes-")); let p: Player | undefined;
  try {
    p = await launch(profile); await configure(p);
    await p.page.locator("#article-count").selectOption("0"); await expect(p.page.locator("#difficulty")).toBeDisabled(); await expect(p.page.locator("#topic-limit")).toBeDisabled();
    await expect(p.page.locator("#board-setup-hint")).toContainText("do not apply");
    await p.page.locator("#reset-board-setup").click(); await expect(p.page.locator("#article-count")).toHaveValue("15"); await expect(p.page.locator("#difficulty")).toHaveValue("MIXED"); await expect(p.page.locator("#topic-limit")).toHaveValue("3");
    for (const count of [0, 25]) {
      await p.page.locator("#article-count").selectOption(String(count)); await p.page.locator("#start").click(); await expect(p.page.locator("#set-ready")).toBeVisible();
      const state = await snapshot(p); assert.equal(state.board.squares.length, 25); assert.equal(state.board.squares.filter((s: any) => s.type === "VISIT_ARTICLE").length, count);
      await p.page.locator("#end-game").click(); await expect(p.page.locator("#article-count")).toBeVisible();
    }
  } finally { await p?.context.close(); await rm(profile, { recursive: true, force: true }); }
});

test("unavailable options block only creation and can be reloaded without losing selected values", { timeout: 45000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-board-options-")); let p: Player | undefined;
  try {
    optionsFailure = true; p = await launch(profile); await configure(p); await expect(p.page.locator("#retry-board-options")).toBeVisible();
    await expect(p.page.locator("#start")).toBeDisabled(); await expect(p.page.locator("#join-game-btn")).toBeEnabled();
    const before = createPosts; await p.page.locator("#article-count").selectOption("7"); await p.page.locator("#topic-limit").selectOption("1");
    assert.equal(createPosts, before); optionsFailure = false; await p.page.locator("#retry-board-options").click(); await expect(p.page.locator("#start")).toBeEnabled();
    await expect(p.page.locator("#article-count")).toHaveValue("7"); await expect(p.page.locator("#topic-limit")).toHaveValue("1");
    const compact = await p.context.newPage(); await compact.setViewportSize({ width: 540, height: 700 }); await compact.goto(`chrome-extension://${p.extensionId}/popup.html`); await expect(compact.locator("#start")).toBeEnabled();
    assert.ok(await compact.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await compact.screenshot({ path: resolve(output, "setup-compact.png"), fullPage: true });
  } finally { optionsFailure = false; await p?.context.close(); await rm(profile, { recursive: true, force: true }); }
});

test("a lost custom-create response recovers the exact settings and board after browser restart", { timeout: 60000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-board-recovery-")); let p: Player | undefined;
  try {
    p = await launch(profile); await configure(p); await p.page.locator("#article-count").selectOption("22"); await p.page.locator("#topic-limit").selectOption("2"); await p.page.locator("#difficulty").selectOption("EASY");
    dropCreate = true; await p.page.locator("#start").click(); await expect(p.page.locator("#retry-admission")).toBeVisible({ timeout: 15000 });
    const saved = committed; assert.equal(saved.boardConfig.vitalArticleTileCount, 22);
    await p.context.close(); dropCreate = false; p = await launch(profile); await expect(p.page.locator("#retry-admission")).toBeVisible();
    await expect(p.page.locator("#article-count")).toHaveValue("22"); await expect(p.page.locator("#topic-limit")).toHaveValue("2"); await expect(p.page.locator("#difficulty")).toHaveValue("EASY");
    await expect(p.page.locator("#article-count")).toBeDisabled(); await p.page.locator("#retry-admission").click(); await expect(p.page.locator("#set-ready")).toBeVisible();
    const recovered = await snapshot(p); assert.equal(recovered.gameId, saved.gameId); assert.equal(recovered.playerId, saved.playerId); assert.deepEqual(recovered.board, saved.board); assert.deepEqual(recovered.boardConfig, saved.boardConfig);
    assert.equal(await prisma.player.count({ where: { gameId: saved.gameId } }), 1);
    await writeFile(resolve(output, "recovery-result.json"), JSON.stringify({ passed: true, droppedCommittedResponse: true, exactBoardRecovered: true, pendingCustomSettingsShownAfterRestart: true }, null, 2));
  } finally { dropCreate = false; await p?.context.close(); await rm(profile, { recursive: true, force: true }); }
});

test("late options from the previous server cannot enable creation on a server with unavailable options; joining still works", { timeout: 45000 }, async () => {
  const previous = buildApp(); let release: (() => void) | undefined; let arrived: (() => void) | undefined;
  const held = new Promise<void>(resolve => { release = resolve; }); const requested = new Promise<void>(resolve => { arrived = resolve; });
  previous.addHook("onSend", async (request, _reply, payload) => { if (request.url === "/games/board-options") { arrived!(); await held; } return payload; });
  const oldOrigin = await previous.listen({ port: 0, host: "127.0.0.1" });
  const profile = await mkdtemp(resolve(".local/wr-board-server-change-")); let p: Player | undefined;
  try {
    p = await launch(profile); await configure(p, oldOrigin); await requested;
    await expect(p.page.locator("#start")).toBeDisabled(); optionsFailure = true;
    await p.page.locator("#api-origin").fill(origin); await p.page.locator("#save-server").click(); await expect(p.page.locator("#connection")).toContainText(origin);
    await expect(p.page.locator("#retry-board-options")).toBeVisible();
    const delivered = p.context.waitForEvent("requestfinished", { predicate: request => request.url() === `${oldOrigin}/games/board-options` });
    release!(); await delivered;
    await p.page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    // The queued old success must not replace the new server's error.
    await expect(p.page.locator("#board-setup-error")).toContainText("invalid board options"); await expect(p.page.locator("#start")).toBeDisabled();
    const host = (await app.inject({ method: "POST", url: "/games", payload: { displayName: "Join despite options outage" } })).json();
    await p.page.locator("#join-game-id").fill(host.gameId); await p.page.locator("#join-game-btn").click(); await expect(p.page.locator("#set-ready")).toBeVisible();
    assert.equal((await snapshot(p)).gameId, host.gameId); assert.equal((await snapshot(p)).apiOrigin, origin);
    await writeFile(resolve(output, "server-options-isolation.json"), JSON.stringify({ passed: true, delayedPriorServerIgnored: true, creationBlockedOnInvalidOptions: true, joiningIndependentOfSetupOptions: true }, null, 2));
  } finally { release?.(); optionsFailure = false; await p?.context.close(); await previous.close(); await rm(profile, { recursive: true, force: true }); }
});
