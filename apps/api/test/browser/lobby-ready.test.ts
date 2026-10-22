import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, type BrowserContext, type Page } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const app = buildApp();
const extensionPath = resolve("apps/extension/dist");
const output = resolve(".jes/local/ewp-011/browser", String(Date.now()));
let origin: string;
let dropPath = "";
let committed: any;
let dropped = 0;
app.addHook("onSend", async (request, reply, payload) => {
  if (request.method === "POST" && request.url === dropPath && reply.statusCode < 300) {
    committed = JSON.parse(String(payload)); dropped++; reply.raw.destroy();
  }
  return payload;
});
before(async () => { await mkdir(output, { recursive: true }); console.log(`Ready-check browser evidence: ${output}`); origin = await app.listen({ port: 0, host: "127.0.0.1" }); });
after(async () => { await app.close(); await prisma.$disconnect(); });

type Player = { context: BrowserContext; page: Page; extensionId: string; errors: string[] };
async function launch(profile: string): Promise<Player> {
  const context = await chromium.launchPersistentContext(profile, { channel: "chromium", headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`], viewport: { width: 1100, height: 950 } });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2];
  const page = await context.newPage(); const errors: string[] = [];
  context.on("page", p => p.on("pageerror", error => errors.push(error.message)));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`chrome-extension://${extensionId}/popup.html?view=board`);
  return { context, page, extensionId, errors };
}
async function configure(player: Player) {
  await player.page.locator("#server-settings summary").click();
  await player.page.locator("#api-origin").fill(origin);
  await player.page.locator("#save-server").click();
  await expect(player.page.locator("#connection")).toContainText(origin);
}
async function snapshot(p: Player): Promise<any> { return p.page.evaluate(() => chrome.runtime.sendMessage({ type: "GET_GAME_STATE" })); }
for (const mode of ["NORMAL", "LOCKOUT"] as const) test(`${mode}: lobby readiness synchronizes, persists and follows roster changes`, { timeout: 120000 }, async () => {
  const profiles = [await mkdtemp(resolve(".local/wr-ready-host-")), await mkdtemp(resolve(".local/wr-ready-guest-"))];
  let host: Player | undefined; let guest: Player | undefined;
  try {
    host = await launch(profiles[0]); guest = await launch(profiles[1]); await configure(host); await configure(guest);
    await host.page.locator("#player-name").fill("Ready Host"); await host.page.locator("#game-mode").selectOption(mode);
    await host.page.locator("#start").click(); await expect(host.page.locator("#set-ready")).toBeVisible();
    const original = await snapshot(host); await expect(host.page.locator("#start-match")).toBeDisabled();
    await guest.page.locator("#player-name").fill("<b>Ready guest</b>"); await guest.page.locator("#join-game-id").fill(original.gameId);
    await guest.page.locator("#join-game-btn").click(); await expect(guest.page.locator("#set-ready")).toHaveAttribute("aria-pressed", "false");
    await expect(host.page.locator("#lobby-hint")).toContainText("0/2 ready");
    await expect(guest.page.locator("#start-match")).toBeHidden();
    const spectator = await host.context.newPage(); await spectator.goto(`${origin}/spectate/${original.gameId}`);
    await expect(spectator.locator("#notice")).toContainText("0/2 ready");
    await expect(spectator.locator("#lobby-readiness")).toContainText("<b>Ready guest</b> · Not Ready");
    await expect(spectator.locator("#lobby-readiness b")).toHaveCount(0);
    await guest.page.locator("#set-ready").click();
    await expect(host.page.locator("#lobby-hint")).toContainText("1/2 ready"); await expect(host.page.locator("#start-match")).toBeDisabled();
    await host.page.locator("#set-ready").click();
    await expect(host.page.locator("#start-match")).toBeEnabled(); await expect(spectator.locator("#notice")).toContainText("2/2 ready");
    await guest.page.locator("#set-ready").click();
    await expect(host.page.locator("#start-match")).toBeDisabled(); await expect(spectator.locator("#notice")).toContainText("1/2 ready");
    await guest.page.locator("#set-ready").click(); await expect(host.page.locator("#start-match")).toBeEnabled();
    if (mode === "LOCKOUT") {
      await host.page.locator("#team-name").fill("Ready crew"); await host.page.locator("#create-team-btn").click();
      await expect(guest.page.locator("#team-select")).toContainText("Ready crew"); await guest.page.locator("#join-team-btn").click();
      await expect(guest.page.locator("#set-ready")).toHaveAttribute("aria-pressed", "false");
      await expect(host.page.locator("#start-match")).toBeDisabled(); await expect(host.page.locator("#set-ready")).toHaveAttribute("aria-pressed", "true");
      await guest.page.locator("#set-ready").click(); await expect(host.page.locator("#start-match")).toBeEnabled();
      await guest.page.locator("#leave-team-btn").click(); await expect(guest.page.locator("#set-ready")).toHaveAttribute("aria-pressed", "false");
      await guest.page.locator("#set-ready").click(); await expect(host.page.locator("#start-match")).toBeEnabled();
    }
    const identity = await snapshot(guest); await guest.context.close(); guest = await launch(profiles[1]);
    await expect(guest.page.locator("#set-ready")).toHaveAttribute("aria-pressed", "true");
    assert.equal((await snapshot(guest)).playerId, identity.playerId);
    const joined = await app.inject({ method: "POST", url: `/games/${original.gameId}/players`, payload: { displayName: "Late lobby arrival" } });
    assert.equal(joined.statusCode, 200); const late = joined.json();
    await expect(host.page.locator("#lobby-hint")).toContainText("2/3 ready"); await expect(host.page.locator("#start-match")).toBeDisabled();
    await host.page.setViewportSize({ width: 568, height: 850 }); await host.page.goto(`chrome-extension://${host.extensionId}/popup.html`);
    await expect(host.page.locator("#lobby-hint")).toContainText("2/3 ready");
    assert.equal(await host.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await host.page.screenshot({ path: resolve(output, `${mode.toLowerCase()}-lobby-popup.png`), fullPage: true });
    await spectator.setViewportSize({ width: 390, height: 844 });
    assert.equal(await spectator.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await spectator.screenshot({ path: resolve(output, `${mode.toLowerCase()}-lobby-spectator.png`), fullPage: true });
    const departed = await app.inject({ method: "POST", url: `/games/${original.gameId}/players/${late.playerId}/leave`, headers: { authorization: `Bearer ${late.playerToken}` }, payload: {} });
    assert.equal(departed.statusCode, 200); await expect(host.page.locator("#start-match")).toBeEnabled();
    await host.page.locator("#end-game").click();
    await expect(guest.page.locator("#start-match")).toBeVisible(); await expect(guest.page.locator("#start-match")).toBeEnabled();
    await expect(guest.page.locator("#lobby-hint")).toContainText("1/1 ready");
    await guest.page.locator("#start-match").click(); await expect(guest.page.locator("#status")).toContainText("Match active");
    await expect(guest.page.locator("#set-ready")).toBeHidden(); await expect(spectator.locator("#lobby-readiness")).toBeHidden();
    assert.equal(host.errors.length + guest.errors.length, 0, [...host.errors, ...guest.errors].join("\n"));
    await writeFile(resolve(output, `${mode.toLowerCase()}-result.json`), JSON.stringify({ passed: true, mode, profile: "actual Chromium extensions/spectator and PostgreSQL/HTTP/WebSockets", gateEnforced: true, togglesSynchronized: true, persistedAcrossBrowserRestart: true, lateJoinAndDeparture: true, hostTransfer: true, teamReset: mode === "LOCKOUT", safeNames: true, popupAndMobileFit: true }, null, 2));
  } finally { await host?.context.close(); await guest?.context.close(); for (const profile of profiles) await rm(profile, { recursive: true, force: true }); }
});

test("a committed readiness response lost in transit recovers without toggling or duplicating changes", { timeout: 60000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-ready-recovery-")); let host: Player | undefined;
  try {
    host = await launch(profile); await configure(host); await host.page.locator("#start").click();
    await expect(host.page.locator("#set-ready")).toBeVisible(); const original = await snapshot(host);
    dropPath = `/games/${original.gameId}/ready`; committed = null;
    await host.page.locator("#set-ready").click();
    await expect.poll(async () => (await prisma.player.findUniqueOrThrow({ where: { id: original.playerId } })).isReady).toBe(true);
    await expect.poll(() => dropped).toBeGreaterThan(0);
    await expect(host.page.locator("body")).not.toHaveAttribute("aria-busy", "true", { timeout: 15000 });
    dropPath = ""; await host.context.close(); host = await launch(profile);
    await expect(host.page.locator("#set-ready")).toHaveAttribute("aria-pressed", "true");
    await expect(host.page.locator("#start-match")).toBeEnabled(); const recovered = await snapshot(host);
    assert.equal(recovered.gameId, original.gameId); assert.equal(recovered.playerId, original.playerId); assert.equal(recovered.revision, 1);
    const replay = await host.page.evaluate(() => chrome.runtime.sendMessage({ type: "SET_READY", isReady: true }));
    assert.equal(replay.revision, 1); assert.equal(replay.players.find((p: any) => p.id === replay.playerId).isReady, true);
    assert.equal(replay.playerToken, undefined); assert.equal(await prisma.player.count({ where: { gameId: original.gameId } }), 1);
    await host.page.locator("#set-ready").click(); await expect(host.page.locator("#set-ready")).toHaveAttribute("aria-pressed", "false");
    await expect(host.page.locator("#start-match")).toBeDisabled();
    await expect.poll(async () => (await snapshot(host!)).revision).toBe(2);
    await host.page.screenshot({ path: resolve(output, "readiness-recovered.png"), fullPage: true });
    assert.equal(host.errors.length, 0, host.errors.join("\n"));
    await writeFile(resolve(output, "recovery-result.json"), JSON.stringify({ passed: true, committedResponseLost: true, browserRestartRecovery: true, desiredStateRetryIsIdempotent: true, originalIdentityPreserved: true }, null, 2));
  } finally { dropPath = ""; await host?.context.close(); await rm(profile, { recursive: true, force: true }); }
});
