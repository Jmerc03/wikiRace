import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect, type BrowserContext, type Page } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";
const output = resolve(".jes/local/ewp-014/browser", String(Date.now()));
let app = buildApp(); let origin: string; let dropPath = ""; let committed: any; let drops = 0; let oldServer = false; let creates = 0;
async function listen(port = 0) {
  app.addHook("onRequest", async request => { if (request.method === "POST" && request.url === "/games") creates++; });
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url === "/ready" && oldServer) { const data = JSON.parse(String(payload)); data.capabilities = data.capabilities.filter((c: string) => c !== "timed-rounds-v1"); return JSON.stringify(data); }
    if (request.method === "POST" && request.url === dropPath && reply.statusCode < 300) { committed = JSON.parse(String(payload)); drops++; reply.raw.destroy(); }
    return payload;
  });
  origin = await app.listen({ host: "127.0.0.1", port });
}
before(async () => { await mkdir(output, { recursive: true }); console.log(`Timed-round browser evidence: ${output}`); await listen(); });
after(async () => { await app.close(); await prisma.$disconnect(); });
type Player = { context: BrowserContext; page: Page; extensionId: string; errors: string[] };
async function launch(profile: string): Promise<Player> {
  const path = resolve("apps/extension/dist");
  const context = await chromium.launchPersistentContext(profile, { channel: "chromium", headless: true, args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`], viewport: { width: 1100, height: 950 } });
  // Only the client wall clock is skewed. Countdown must follow server metadata.
  await context.addInitScript(() => { const now = Date.now.bind(Date); Date.now = () => now() + 12 * 3600000; });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker"); const extensionId = worker.url().split("/")[2]; const page = await context.newPage(); const errors: string[] = [];
  context.on("page", p => p.on("pageerror", e => errors.push(e.message))); page.on("pageerror", e => errors.push(e.message));
  await page.goto(`chrome-extension://${extensionId}/popup.html?view=board`); return { context, page, extensionId, errors };
}
async function configure(p: Player) { await p.page.locator("#server-settings summary").click(); await p.page.locator("#api-origin").fill(origin); await p.page.locator("#save-server").click(); await expect(p.page.locator("#connection")).toContainText(origin); }
const snapshot = (p: Player): Promise<any> => p.page.evaluate(() => chrome.runtime.sendMessage({ type: "GET_GAME_STATE" }));
async function create(p: Player, limit = "60", mode = "NORMAL") { await configure(p); await p.page.locator("#round-limit").selectOption(limit); await p.page.locator("#game-mode").selectOption(mode); await p.page.locator("#start").click(); await expect(p.page.locator("#set-ready")).toBeVisible(); return snapshot(p); }
async function start(p: Player) { await p.page.locator("#set-ready").click(); await expect(p.page.locator("#start-match")).toBeEnabled(); await p.page.locator("#start-match").click(); await expect(p.page.locator("#status")).toContainText("Match active"); return snapshot(p); }
async function shorten(p: Player, milliseconds: number) {
  const state = await snapshot(p); const expiresAt = new Date(Date.now() + milliseconds);
  await prisma.game.update({ where: { id: state.gameId }, data: { startedAt: new Date(expiresAt.getTime() - state.timeLimitSeconds * 1000), expiresAt, revision: { increment: 1 } } });
  await p.page.locator("#refresh").click(); return expiresAt;
}
for (const mode of ["NORMAL", "LOCKOUT"]) test(`${mode}: shared countdown survives client clock skew, expires without a winner and carries the limit into rematch`, { timeout: 100000 }, async () => {
  const profiles = [await mkdtemp(resolve(".local/wr-timer-host-")), await mkdtemp(resolve(".local/wr-timer-guest-"))]; let host: Player | undefined; let guest: Player | undefined;
  try {
    host = await launch(profiles[0]); guest = await launch(profiles[1]); const initial = await create(host, "60", mode); await configure(guest);
    await expect(host.page.locator("#round-timer")).toContainText("1-minute round · Starts with the match"); assert.equal(initial.expiresAt, null);
    await guest.page.locator("#join-game-id").fill(initial.gameId); await guest.page.locator("#join-game-btn").click(); await expect(guest.page.locator("#set-ready")).toBeVisible();
    const spectator = await host.context.newPage(); await spectator.goto(`${origin}/spectate/${initial.gameId}`); await expect(spectator.locator("#round-timer")).toContainText("Starts with the match");
    const invite = await host.context.newPage(); await invite.goto(`${origin}/join/${initial.gameId}`); await expect(invite.locator("#invite-timer")).toHaveText("1-minute round");
    await guest.page.locator("#set-ready").click(); const active = await start(host); assert.equal(Date.parse(active.expiresAt) - Date.parse(active.startedAt), 60000);
    await expect(host.page.locator("#round-timer")).toHaveText(/Time left · (1:00|0:5\d)/); await expect(guest.page.locator("#round-timer")).toHaveText(/Time left · (1:00|0:5\d)/); await expect(spectator.locator("#round-timer")).toHaveText(/Time left · (1:00|0:5\d)/);
    const overlay = await host.context.newPage(); await overlay.setViewportSize({ width: 1280, height: 900 }); await overlay.goto(`${origin}/overlay/${initial.gameId}`); await expect(overlay.locator("#round-timer")).toContainText("Time left");
    assert.ok(await overlay.evaluate(() => document.documentElement.scrollHeight <= innerHeight)); await overlay.screenshot({ path: resolve(output, `${mode.toLowerCase()}-overlay-countdown.png`) });
    const compact = await host.context.newPage(); await compact.setViewportSize({ width: 540, height: 700 }); await compact.goto(`chrome-extension://${host.extensionId}/popup.html`); await expect(compact.locator("#round-timer")).toContainText("Time left"); await compact.screenshot({ path: resolve(output, `${mode.toLowerCase()}-compact.png`), fullPage: true });
    assert.ok(await compact.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    let expectedDeadline = active.expiresAt;
    if (mode === "LOCKOUT") { expectedDeadline = (await shorten(host, 3500)).toISOString(); await guest.page.locator("#refresh").click(); await spectator.reload(); }
    // NORMAL uses the actual unmodified one-minute timer. LOCKOUT accelerates
    // only the persisted deadline fixture to exercise the other mode quickly.
    await expect(host.page.locator("#results-summary")).toHaveText("Time’s up — no winner", { timeout: 75000 });
    await expect(guest.page.locator("#results-summary")).toHaveText("Time’s up — no winner"); await expect(spectator.locator("#results-title")).toHaveText("Time’s up — no winner");
    const ended = await snapshot(host); assert.equal(ended.finishedAt, expectedDeadline); assert.equal(ended.winner, false); assert.equal(ended.completedSquareIds.length, 0);
    await host.page.screenshot({ path: resolve(output, `${mode.toLowerCase()}-expired.png`), fullPage: true });
    await host.page.locator("#rematch").click(); await expect(host.page.locator("#set-ready")).toBeVisible(); const next = await snapshot(host); assert.equal(next.timeLimitSeconds, 60); assert.equal(next.expiresAt, null); assert.notEqual(next.gameId, initial.gameId);
    await expect(guest.page.locator("#rematch")).toHaveText("Join Rematch"); await guest.page.locator("#rematch").click(); await expect(guest.page.locator("#round-timer")).toContainText("Starts with the match");
    assert.equal(host.errors.length + guest.errors.length, 0, [...host.errors, ...guest.errors].join("\n"));
    await writeFile(resolve(output, `${mode.toLowerCase()}-result.json`), JSON.stringify({ passed: true, mode, configuredSeconds: 60, actualUnmodifiedMinute: mode === "NORMAL", acceleratedDatabaseDeadline: mode === "LOCKOUT", clientClockSkewHours: 12, sharedCountdown: true, noWinnerOnExpiry: true, rematchFreshClock: true, overlayFits: true, compactFits: true }, null, 2));
  } finally { await host?.context.close(); await guest?.context.close(); for (const profile of profiles) await rm(profile, { recursive: true, force: true }); }
});

test("lost timed-create and start responses recover their exact duration and deadline after browser restart", { timeout: 60000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-timer-recovery-")); let p: Player | undefined;
  try {
    p = await launch(profile); await configure(p); await p.page.locator("#round-limit").selectOption("300"); dropPath = "/games";
    await p.page.locator("#start").click(); await expect(p.page.locator("#retry-admission")).toBeVisible({ timeout: 15000 }); const saved = committed;
    await p.context.close(); dropPath = ""; p = await launch(profile); await expect(p.page.locator("#round-limit")).toHaveValue("300"); await expect(p.page.locator("#round-limit")).toBeDisabled();
    await p.page.locator("#retry-admission").click(); await expect(p.page.locator("#set-ready")).toBeVisible(); assert.equal((await snapshot(p)).gameId, saved.gameId);
    await p.page.locator("#set-ready").click(); dropPath = `/games/${saved.gameId}/start`; const before = drops;
    await p.page.locator("#start-match").click(); await expect.poll(() => drops).toBeGreaterThan(before); const started = committed;
    await expect(p.page.locator("body")).not.toHaveAttribute("aria-busy", "true", { timeout: 15000 }); await p.context.close(); dropPath = "";
    p = await launch(profile); await expect(p.page.locator("#status")).toContainText("Match active"); const restored = await snapshot(p); assert.equal(restored.expiresAt, started.expiresAt); assert.equal(restored.timeLimitSeconds, 300);
    const replay = await p.page.evaluate(() => chrome.runtime.sendMessage({ type: "START_MATCH" })); assert.equal(replay.expiresAt, started.expiresAt); assert.equal(replay.startedAt, started.startedAt); assert.equal(replay.revision, started.revision);
    await writeFile(resolve(output, "response-loss.json"), JSON.stringify({ passed: true, pendingDurationRestored: true, originalDeadlineRestored: true, startRetryDoesNotExtend: true }, null, 2));
  } finally { dropPath = ""; await p?.context.close(); await rm(profile, { recursive: true, force: true }); }
});

test("API outage through the deadline shows unconfirmed expiry and startup catches up without extending time", { timeout: 60000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-timer-api-restart-")); let p: Player | undefined; let stopped = false;
  const port = Number(new URL(origin).port);
  try {
    p = await launch(profile); const initial = await create(p); await start(p); const expiresAt = await shorten(p, 3000);
    await app.close(); stopped = true; await delay(3500);
    assert.equal((await prisma.game.findUniqueOrThrow({ where: { id: initial.gameId } })).status, "ACTIVE", "No other test server may sweep this fixture while its API is stopped");
    await expect(p.page.locator("#round-timer")).toContainText("Reconnect to confirm"); await expect(p.page.locator("#match-results")).toBeHidden();
    await p.page.screenshot({ path: resolve(output, "offline-unconfirmed.png"), fullPage: true });
    app = buildApp(); await listen(port); stopped = false;
    await expect(p.page.locator("#results-summary")).toHaveText("Time’s up — no winner", { timeout: 20000 }); const recovered = await snapshot(p); assert.equal(recovered.finishedAt, expiresAt.toISOString()); assert.equal(recovered.playerId, initial.playerId);
    await writeFile(resolve(output, "api-restart.json"), JSON.stringify({ passed: true, offlineZeroDoesNotInventFinalResult: true, startupExpiresOverdueRound: true, identityAndDeadlinePreserved: true }, null, 2));
  } finally { if (stopped) { app = buildApp(); await listen(port); } await p?.context.close(); await rm(profile, { recursive: true, force: true }); }
});

test("an older server cannot silently turn a timed request into an untimed round", { timeout: 45000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-timer-capability-")); let p: Player | undefined;
  try {
    p = await launch(profile); await configure(p); await p.page.locator("#round-limit").selectOption("60"); oldServer = true; const before = creates;
    await p.page.locator("#start").click(); await expect(p.page.locator("#status")).toContainText("Update the game server before creating a timed round"); assert.equal(creates, before);
    await expect(p.page.locator("#round-limit")).toBeDisabled(); oldServer = false; await p.page.locator("#retry-admission").click(); await expect(p.page.locator("#set-ready")).toBeVisible(); assert.equal((await snapshot(p)).timeLimitSeconds, 60);
  } finally { oldServer = false; await p?.context.close(); await rm(profile, { recursive: true, force: true }); }
});
