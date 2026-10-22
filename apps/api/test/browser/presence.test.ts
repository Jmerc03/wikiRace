import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, type BrowserContext, type Page } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const output = resolve(".jes/local/ewp-015/browser", String(Date.now()));
let app = buildApp(); let origin: string; let legacy = false; let mutedGame = ""; let authenticationFrames = 0;
async function listen(port = 0) {
  app.addHook("onReady", async () => {
    app.websocketServer.on("connection", (socket, request) => {
      const send = socket.send.bind(socket);
      socket.send = ((data: any, ...args: any[]) => {
        if (mutedGame && request.url?.endsWith(mutedGame) && typeof data === "string" && ["HEARTBEAT", "PRESENCE_UPDATED", "GAME_STATE_UPDATED"].includes(JSON.parse(data).type)) return;
        if (legacy && typeof data === "string") {
          const value = JSON.parse(data);
          if (value.type === "CONNECTED") { delete value.capabilities; data = JSON.stringify(value); }
        }
        return (send as any)(data, ...args);
      }) as typeof socket.send;
      socket.on("message", data => { if (JSON.parse(String(data)).type === "AUTHENTICATE_PRESENCE") authenticationFrames++; });
    });
  });
  origin = await app.listen({ port, host: "127.0.0.1" });
}
before(async () => { await mkdir(output, { recursive: true }); console.log(`Presence browser evidence: ${output}`); await listen(); });
after(async () => { await app.close(); await prisma.$disconnect(); });
type Player = { context: BrowserContext; page: Page; extensionId: string; errors: string[] };
async function launch(profile: string): Promise<Player> {
  const path = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, { channel: "chromium", headless: true, args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`], viewport: { width: 1100, height: 950 } });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2]; const page = await context.newPage(); const errors: string[] = [];
  context.on("page", p => p.on("pageerror", e => errors.push(e.message))); page.on("pageerror", e => errors.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/popup.html?view=board`); return { context, page, extensionId, errors };
}
async function configure(p: Player) { await p.page.locator("#server-settings summary").click(); await p.page.locator("#api-origin").fill(origin); await p.page.locator("#save-server").click(); await expect(p.page.locator("#connection")).toContainText(origin); }
const snapshot = (p: Player): Promise<any> => p.page.evaluate(() => chrome.runtime.sendMessage({ type: "GET_GAME_STATE" }));
const badge = (page: Page, id: string, spectator = false) => page.locator(`${spectator ? '#connection-roster' : '#player-roster'} [data-player-id="${id}"] .player-presence`);
async function create(p: Player, mode = "NORMAL") { await configure(p); await p.page.locator("#player-name").fill("Connection Host"); await p.page.locator("#game-mode").selectOption(mode); await p.page.locator("#start").click(); await expect(p.page.locator("#set-ready")).toBeVisible(); return snapshot(p); }

for (const mode of ["NORMAL", "LOCKOUT"]) test(`${mode}: presence follows browser restart, grace and rematch without changing readiness`, { timeout: 90000 }, async () => {
  const profiles = [await mkdtemp(resolve(".local/wr-presence-host-")), await mkdtemp(resolve(".local/wr-presence-guest-"))]; let host: Player | undefined; let guest: Player | undefined;
  try {
    host = await launch(profiles[0]); guest = await launch(profiles[1]); const initial = await create(host, mode); await configure(guest);
    await guest.page.locator("#player-name").fill("<b>Connection Guest</b>"); await guest.page.locator("#join-game-id").fill(initial.gameId); await guest.page.locator("#join-game-btn").click();
    await expect(guest.page.locator("#set-ready")).toBeVisible(); const joined = await snapshot(guest);
    await expect(badge(host.page, joined.playerId)).toHaveText("Online"); await expect(badge(guest.page, initial.playerId)).toHaveText("Online");
    if (mode === "LOCKOUT") {
      await host.page.locator("#team-name").fill("Connected Crew"); await host.page.locator("#create-team-btn").click();
      await expect(guest.page.locator("#team-select")).toContainText("Connected Crew"); await guest.page.locator("#join-team-btn").click();
      const state = await snapshot(host); await host.page.locator("#team-select").selectOption(state.teams[0].id); await host.page.locator("#join-team-btn").click();
    }
    await host.page.locator("#set-ready").click(); await guest.page.locator("#set-ready").click(); await expect(host.page.locator("#start-match")).toBeEnabled();
    const unchanged = await snapshot(host);
    const spectator = await host.context.newPage(); await spectator.goto(`${origin}/spectate/${initial.gameId}`); await spectator.locator("#player-connections summary").click();
    await expect(badge(spectator, joined.playerId, true)).toHaveText("Online"); await expect(spectator.locator("#connection-roster b")).toHaveCount(0);
    const overlay = await host.context.newPage(); await overlay.setViewportSize({ width: 1280, height: 900 }); await overlay.goto(`${origin}/overlay/${initial.gameId}`);
    if (mode === "LOCKOUT") await expect(overlay.locator(".score-presence")).toContainText("2/2 online");
    else await expect(overlay.locator(".score-presence.online")).toHaveCount(2);
    const extra = await guest.context.newPage(); await extra.goto(`chrome-extension://${guest.extensionId}/popup.html?view=board`); await extra.close();
    await expect(badge(host.page, joined.playerId)).toHaveText("Online");
    await guest.context.close(); await expect(badge(host.page, joined.playerId)).toHaveText("Reconnecting");
    await expect(badge(spectator, joined.playerId, true)).toHaveText("Reconnecting");
    await host.page.screenshot({ path: resolve(output, `${mode.toLowerCase()}-reconnecting.png`), fullPage: true });
    await expect(badge(host.page, joined.playerId)).toHaveText("Offline", { timeout: 15000 });
    await expect(host.page.locator("#start-match")).toBeEnabled();
    assert.equal((await snapshot(host)).revision, unchanged.revision);
    assert.equal((await prisma.player.findUniqueOrThrow({ where: { id: joined.playerId } })).isReady, true);
    guest = await launch(profiles[1]); await expect(badge(host.page, joined.playerId)).toHaveText("Online");
    assert.equal((await snapshot(guest)).playerId, joined.playerId); await expect(guest.page.locator("#set-ready")).toHaveAttribute("aria-pressed", "true");
    await host.page.setViewportSize({ width: 540, height: 800 }); await host.page.goto(`chrome-extension://${host.extensionId}/popup.html`);
    await expect(badge(host.page, joined.playerId)).toHaveText("Online");
    assert.ok(await host.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await host.page.screenshot({ path: resolve(output, `${mode.toLowerCase()}-compact.png`), fullPage: true });
    await spectator.setViewportSize({ width: 390, height: 844 }); assert.ok(await spectator.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await spectator.screenshot({ path: resolve(output, `${mode.toLowerCase()}-spectator.png`), fullPage: true });
    assert.ok(await overlay.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
    await overlay.screenshot({ path: resolve(output, `${mode.toLowerCase()}-overlay.png`) });
    await host.page.locator("#start-match").click(); await expect(guest.page.locator("#status")).toContainText("Match active");
    await host.page.locator("#host-end").click(); await expect(host.page.locator("#rematch")).toBeVisible(); await host.page.locator("#rematch").click();
    await expect(host.page.locator("#set-ready")).toBeVisible(); const next = await snapshot(host);
    await expect(guest.page.locator("#rematch")).toHaveText("Join Rematch"); await guest.page.locator("#rematch").click();
    await expect(guest.page.locator("#set-ready")).toBeVisible(); const nextGuest = await snapshot(guest);
    await expect(badge(host.page, nextGuest.playerId)).toHaveText("Online");
    for (const socket of app.websocketServer.clients) socket.send(JSON.stringify({ type: "PRESENCE_UPDATED", gameId: initial.gameId, players: [{ playerId: joined.playerId, status: "online" }] }));
    assert.equal((await snapshot(host)).presence.gameId, next.gameId);
    assert.ok(!(await snapshot(host)).presence.players.some((p: any) => p.playerId === joined.playerId));
    host.page.once("dialog", dialog => dialog.accept()); await host.page.locator(".remove-player").click();
    await expect(guest.page.locator("#status")).toContainText("host removed you");
    await expect(host.page.locator(`#player-roster [data-player-id="${nextGuest.playerId}"] .player-presence`)).toHaveCount(0);
    assert.equal((await snapshot(host)).presence.players.some((p: any) => p.playerId === nextGuest.playerId), false);
    assert.equal(host.errors.length + guest.errors.length, 0, [...host.errors, ...guest.errors].join("\n"));
    await writeFile(resolve(output, `${mode.toLowerCase()}-result.json`), JSON.stringify({ passed: true, mode, actualTenSecondGrace: true, persistedIdentityAndReadiness: true, noPresenceRevisions: true, multiplePopupTabs: true, spectatorDoesNotEnroll: true, safeNames: true, compactMobileOverlayFit: true, freshRematchPresence: true, rejectsOldGamePresence: true, removalRevokesPresence: true }, null, 2));
  } finally { await host?.context.close(); await guest?.context.close(); for (const profile of profiles) await rm(profile, { recursive: true, force: true }); }
});

test("API outage clears observed presence and restart authenticates the saved membership again", { timeout: 60000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-presence-outage-")); let host: Player | undefined;
  try {
    host = await launch(profile); const initial = await create(host); await expect(badge(host.page, initial.playerId)).toHaveText("Online");
    const spectator = await host.context.newPage(); await spectator.goto(`${origin}/spectate/${initial.gameId}`); await spectator.locator("#player-connections summary").click(); await expect(badge(spectator, initial.playerId, true)).toHaveText("Online");
    const before = await prisma.game.findUniqueOrThrow({ where: { id: initial.gameId } }); const port = Number(new URL(origin).port);
    await app.close(); await expect(badge(host.page, initial.playerId)).toHaveText("Connection unknown"); await expect(badge(spectator, initial.playerId, true)).toHaveText("Connection unknown");
    await host.page.screenshot({ path: resolve(output, "api-offline-unknown.png"), fullPage: true });
    app = buildApp(); await listen(port);
    await expect(badge(host.page, initial.playerId)).toHaveText("Online", { timeout: 20000 }); await expect(badge(spectator, initial.playerId, true)).toHaveText("Online", { timeout: 20000 });
    const recovered = await snapshot(host); assert.equal(recovered.playerId, initial.playerId); assert.equal(recovered.playerToken, undefined);
    assert.deepEqual(await prisma.game.findUniqueOrThrow({ where: { id: initial.gameId } }), before);
    await writeFile(resolve(output, "restart-result.json"), JSON.stringify({ passed: true, outageMakesPresenceUnknown: true, restartAuthenticatesAgain: true, savedIdentityAndGameRowsUnchanged: true }, null, 2));
  } finally { await host?.context.close(); await rm(profile, { recursive: true, force: true }); }
});

test("older socket protocol remains playable and shows unknown instead of false offline", { timeout: 60000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-presence-legacy-")); let host: Player | undefined;
  legacy = true; const initialAuthFrames = authenticationFrames;
  try {
    host = await launch(profile); const initial = await create(host); await expect(host.page.locator("#connection")).toContainText("Live updates connected");
    await expect(badge(host.page, initial.playerId)).toHaveText("Connection unknown");
    const spectator = await host.context.newPage(); await spectator.goto(`${origin}/spectate/${initial.gameId}`); await spectator.locator("#player-connections summary").click(); await expect(badge(spectator, initial.playerId, true)).toHaveText("Connection unknown");
    await host.page.locator("#set-ready").click(); await expect(host.page.locator("#start-match")).toBeEnabled(); await host.page.locator("#start-match").click(); await expect(host.page.locator("#status")).toContainText("Match active");
    assert.equal(authenticationFrames, initialAuthFrames, "No private auth frame is sent without advertised support");
    await writeFile(resolve(output, "legacy-result.json"), JSON.stringify({ passed: true, strippedPresenceCapability: true, noAuthenticationFrame: true, existingGameFlowWorks: true, unknownLabel: true }, null, 2));
  } finally { legacy = false; await host?.context.close(); await rm(profile, { recursive: true, force: true }); }
});


test("an open but silent update stream clears stale Online labels before reconnecting", { timeout: 75000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-presence-stale-")); let host: Player | undefined;
  try {
    host = await launch(profile); const initial = await create(host); await expect(badge(host.page, initial.playerId)).toHaveText("Online");
    const spectator = await host.context.newPage(); await spectator.goto(`${origin}/spectate/${initial.gameId}`); await spectator.locator("#player-connections summary").click(); await expect(badge(spectator, initial.playerId, true)).toHaveText("Online");
    const before = await prisma.game.findUniqueOrThrow({ where: { id: initial.gameId } });
    // Keep TCP/native pong and HTTP healthy, but stop application update frames.
    const started = Date.now(); mutedGame = initial.gameId;
    await expect(badge(host.page, initial.playerId)).toHaveText("Connection unknown", { timeout: 55000 });
    await expect(badge(spectator, initial.playerId, true)).toHaveText("Connection unknown");
    assert.ok(Date.now() - started >= 44000, "Exercise the real freshness deadline");
    mutedGame = ""; for (const socket of app.websocketServer.clients) socket.terminate();
    await expect(badge(host.page, initial.playerId)).toHaveText("Online", { timeout: 20000 }); await expect(badge(spectator, initial.playerId, true)).toHaveText("Online");
    assert.deepEqual(await prisma.game.findUniqueOrThrow({ where: { id: initial.gameId } }), before);
    await writeFile(resolve(output, "stale-stream-result.json"), JSON.stringify({ passed: true, actualFreshnessTimeout: true, healthyHttpAndNativePong: true, stalePresenceCleared: true, reconnectRecovered: true, rowsUnchanged: true }, null, 2));
  } finally { mutedGame = ""; await host?.context.close(); await rm(profile, { recursive: true, force: true }); }
});
