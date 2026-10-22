import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, type BrowserContext, type Page } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const app = buildApp();
const extensionPath = resolve("apps/extension/dist");
const output = resolve(".jes/local/ewp-010/browser", String(Date.now()));
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
before(async () => { await mkdir(output, { recursive: true }); console.log(`Results/rematch browser evidence: ${output}`); origin = await app.listen({ port: 0, host: "127.0.0.1" }); });
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
  await context.route("https://en.wikipedia.org/wiki/Fixture_*", async route => {
    const position = new URL(route.request().url()).pathname.split("_").at(-1);
    await route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body><h1 id="firstHeading">Fixture ${position}</h1><div id="mw-content-text"><a href="/wiki/Fixture_1">Next article</a></div><div id="mw-normal-catlinks"><ul><li><a>Science</a></li></ul></div></body></html>` });
  });
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
async function fixtures(gameId: string) {
  const squares = await prisma.boardSquare.findMany({ where: { board: { gameId } } });
  for (const square of squares) await prisma.boardSquare.update({ where: { id: square.id }, data: {
    type: "VISIT_ARTICLE", label: `Visit Fixture ${square.position}`, condition: { title: `Fixture ${square.position}` },
  } });
}

for (const mode of ["NORMAL", "LOCKOUT"] as const) test(`${mode}: real extensions and spectator show results/articles and enter the same fresh rematch`, { timeout: 120000 }, async () => {
  const profiles = [await mkdtemp(resolve(".local/wr-results-host-")), await mkdtemp(resolve(".local/wr-results-guest-"))];
  let host: Player | undefined; let guest: Player | undefined;
  try {
    host = await launch(profiles[0]); guest = await launch(profiles[1]);
    await configure(host); await configure(guest);
    await host.page.locator("#player-name").fill("Results Host"); await host.page.locator("#game-mode").selectOption(mode);
    await host.page.locator("#start").click(); await expect(host.page.locator("#status")).toContainText("Mark Ready");
    const original = await snapshot(host); await fixtures(original.gameId);
    await guest.page.locator("#player-name").fill("Results Guest"); await guest.page.locator("#join-game-id").fill(original.gameId);
    await guest.page.locator("#join-game-btn").click(); await expect(guest.page.locator("#status")).toContainText("Mark Ready");
    if (mode === "LOCKOUT") {
      await host.page.locator("#team-name").fill("Curious team"); await host.page.locator("#create-team-btn").click();
      await expect(guest.page.locator("#team-select")).toContainText("Curious team");
      await host.page.locator("#join-team-btn").click(); await guest.page.locator("#join-team-btn").click();
      await expect(host.page.locator("#team-rosters")).toContainText("Results Guest");
    }
    await host.page.locator("#set-ready").click(); await guest.page.locator("#set-ready").click(); await host.page.locator("#start-match").click(); await expect(guest.page.locator("#status")).toContainText("Match active");
    const articles = [await host.context.newPage(), await guest.context.newPage()];
    if (mode === "NORMAL") {
      await articles[1].goto("https://en.wikipedia.org/wiki/Fixture_10");
      await expect(guest.page.locator("#progress")).toContainText("1/25");
    }
    for (let position = 0; position < (mode === "NORMAL" ? 5 : 13); position++) {
      await articles[mode === "NORMAL" ? 0 : position % 2].goto(`https://en.wikipedia.org/wiki/Fixture_${position}`);
      await expect.poll(async () => (await snapshot(host!)).completedSquareIds.length).toBe(position + 1);
    }
    const outcome = mode === "NORMAL" ? "Results Host won by bingo" : "Curious team won by majority";
    for (const p of [host, guest]) {
      await expect(p.page.locator("#match-results")).toBeVisible();
      await expect(p.page.locator("#results-summary")).toHaveText(outcome);
      await expect(p.page.locator("#results-duration")).toContainText("Match duration");
      await expect(p.page.locator(".result-row").first()).toContainText("Winner");
    }
    await expect(host.page.locator("#history-count")).toContainText(mode === "NORMAL" ? "5 squares" : "13 squares");
    await host.page.locator(".evidence-button").first().click();
    await expect(host.page.locator("#article-dialog")).toBeVisible();
    await expect(host.page.locator("#article-link a")).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Fixture_0");
    await expect(host.page.locator("#article-scorer")).toContainText("Results Host");
    await host.page.screenshot({ path: resolve(output, `${mode.toLowerCase()}-article.png`), fullPage: true });
    await host.page.keyboard.press("Escape"); await expect(host.page.locator("#article-dialog")).not.toBeVisible();
    await host.page.screenshot({ path: resolve(output, `${mode.toLowerCase()}-results.png`), fullPage: true });
    const spectator = await guest.context.newPage(); await spectator.goto(`${origin}/spectate/${original.gameId}`);
    await expect(spectator.locator("#results-title")).toHaveText(outcome);
    await expect(spectator.locator(".score-card").first()).toContainText("Winner");
    if (mode === "NORMAL") {
      await spectator.locator("#follow-player").selectOption((await snapshot(guest)).playerId);
      await expect(spectator.locator(".evidence-button")).toHaveCount(1);
      await spectator.locator(".evidence-button").click();
      await expect(spectator.locator("#article-link a")).toHaveText("Fixture 10");
      await spectator.locator("#close-article").click();
    }
    await spectator.screenshot({ path: resolve(output, `${mode.toLowerCase()}-spectator.png`), fullPage: true });
    const savedEvidence = (await snapshot(host)).squareEvidence;
    await host.page.locator("#rematch").click(); await expect(host.page.locator("#status")).toContainText("Mark Ready");
    const next = await snapshot(host);
    assert.notEqual(next.gameId, original.gameId); assert.equal(next.previousGameId, original.gameId);
    assert.equal(next.completedSquareIds.length, 0); assert.equal(next.squareEvidence.length, 0);
    for (const type of ["REMATCH", "END_MATCH", "LEAVE_GAME", "FORGET_GAME"]) {
      const stale = await host.page.evaluate(({ type, gameId }) => chrome.runtime.sendMessage({ type, expectedGameId: gameId }), { type, gameId: original.gameId });
      assert.match(stale.error, /previous match/); assert.equal(stale.gameId, next.gameId); assert.equal(stale.status, "WAITING");
      assert.equal(stale.pendingRematch, false);
    }
    await host.page.locator("#refresh").click();
    await expect(guest.page.locator("#rematch")).toHaveText("Join Rematch");
    await expect(spectator.locator("#next-round")).toHaveAttribute("href", `/spectate/${next.gameId}`);
    await guest.page.locator("#rematch").click(); await expect(guest.page.locator("#status")).toContainText("Mark Ready");
    await expect.poll(async () => (await snapshot(host!)).playerCount).toBe(2);
    assert.equal((await snapshot(guest)).gameId, next.gameId);
    assert.equal((await snapshot(guest)).playerName, "Results Guest");
    if (mode === "LOCKOUT") {
      await expect(guest.page.locator("#current-team")).toContainText("Curious team");
      assert.equal((await snapshot(host)).teams[0].players.length, 2);
    }
    await expect(host.page.locator("#match-results")).toBeHidden(); await expect(host.page.locator("#previous-results")).toBeVisible();
    const old = await guest.context.request.get(`${origin}/games/${original.gameId}/spectator?playerId=${original.playerId}`);
    const oldState = await old.json(); assert.deepEqual(oldState.squareEvidence, savedEvidence); assert.equal(oldState.status, "FINISHED");
    await host.page.screenshot({ path: resolve(output, `${mode.toLowerCase()}-rematch.png`), fullPage: true });
    await guest.context.close(); guest = await launch(profiles[1]);
    await expect(guest.page.locator("#status")).toContainText("Mark Ready"); assert.equal((await snapshot(guest)).gameId, next.gameId);
    await host.page.locator("#set-ready").click(); await guest.page.locator("#set-ready").click(); await host.page.locator("#start-match").click(); await expect(guest.page.locator("#status")).toContainText("Match active");
    assert.equal(host.errors.length + guest.errors.length, 0, [...host.errors, ...guest.errors].join("\n"));
    await writeFile(resolve(output, `${mode.toLowerCase()}-result.json`), JSON.stringify({ passed: true, profile: "two actual Chromium extensions and spectator; synthetic Wikipedia article DOM; real PostgreSQL/HTTP/WebSockets", results: true, articleEvidence: true, freshRematch: true, preservedPreviousResults: true, newSessionSurvivedRestart: true, teamCarryover: mode === "LOCKOUT" }, null, 2));
  } finally { await host?.context.close(); await guest?.context.close(); for (const profile of profiles) await rm(profile, { recursive: true, force: true }); }
});

test("a committed rematch response lost before delivery recovers the same membership after browser restart", { timeout: 90000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-rematch-recovery-")); let host: Player | undefined;
  try {
    host = await launch(profile); await configure(host); await host.page.locator("#start").click();
    await expect(host.page.locator("#status")).toContainText("Mark Ready"); const source = await snapshot(host);
    await host.page.locator("#host-end").click(); await expect(host.page.locator("#match-results")).toBeVisible();
    dropPath = `/games/${source.gameId}/rematch`; committed = null;
    await host.page.locator("#rematch").click(); await expect(host.page.locator("#retry-rematch")).toBeVisible({ timeout: 15000 });
    assert.ok(committed?.playerId); const created = { gameId: committed.gameId, playerId: committed.playerId };
    assert.equal((await snapshot(host)).gameId, source.gameId); assert.equal((await snapshot(host)).pendingRematch, true);
    assert.ok(!JSON.stringify(await snapshot(host)).includes(committed.playerToken));
    const blocked = await host.page.evaluate(() => chrome.runtime.sendMessage({ type: "LEAVE_GAME" }));
    assert.match(blocked.error, /Retry the rematch/);
    await host.page.screenshot({ path: resolve(output, "rematch-pending.png"), fullPage: true });
    await host.context.close(); host = undefined; dropPath = "";
    host = await launch(profile); await expect(host.page.locator("#retry-rematch")).toBeVisible();
    await host.page.locator("#retry-rematch").click(); await expect(host.page.locator("#status")).toContainText("Mark Ready");
    const recovered = await snapshot(host); assert.equal(recovered.gameId, created.gameId); assert.equal(recovered.playerId, created.playerId);
    assert.equal(recovered.pendingRematch, false); assert.equal(await prisma.player.count({ where: { gameId: created.gameId } }), 1);
    assert.equal(await prisma.game.count({ where: { rematchOfGameId: source.gameId } }), 1);
    assert.equal((await prisma.game.findUniqueOrThrow({ where: { id: created.gameId } })).revision, 0);
    await expect.poll(async () => (await snapshot(host!)).connection).toBe("live");
    assert.equal(host.errors.length, 0, host.errors.join("\n"));
    await writeFile(resolve(output, "recovery-result.json"), JSON.stringify({ passed: true, droppedCommittedResponses: dropped, originalSessionRetainedUntilSuccess: true, pendingSurvivedRestart: true, oneLobby: true, oneMembership: true, noCredentialInPopupState: true }, null, 2));
  } finally { dropPath = ""; await host?.context.close(); await rm(profile, { recursive: true, force: true }); }
});

test("article dialogs and final standings render names literally and refuse unsafe legacy links", { timeout: 60000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-results-safe-")); let host: Player | undefined;
  try {
    host = await launch(profile); await configure(host); await host.page.locator("#player-name").fill("<img src=x onerror=alert(1)>");
    await host.page.locator("#start").click(); await expect(host.page.locator("#status")).toContainText("Mark Ready");
    const initial = await snapshot(host); await fixtures(initial.gameId); await host.page.locator("#set-ready").click(); await host.page.locator("#start-match").click();
    const article = await host.context.newPage(); await article.goto("https://en.wikipedia.org/wiki/Fixture_0");
    await expect(host.page.locator(".evidence-button")).toHaveCount(1); await host.page.locator("#host-end").click();
    const completion = await prisma.squareCompletion.findFirstOrThrow({ where: { gameId: initial.gameId, playerId: initial.playerId } });
    await prisma.pageVisitEvent.update({ where: { id: completion.pageVisitEventId }, data: { title: "<script>window.compromised=true</script>", url: "javascript:window.compromised=true" } });
    // This legacy-data fixture changes immutable evidence outside normal routes.
    // Advance revision so an earlier in-flight snapshot cannot replace it.
    await prisma.game.update({ where: { id: initial.gameId }, data: { revision: { increment: 1 } } });
    await host.page.locator("#refresh").click(); await host.page.locator(".evidence-button").click();
    await expect(host.page.locator("#article-link")).toContainText("<script>window.compromised=true</script>");
    await expect(host.page.locator("#article-link a")).toHaveCount(0); await expect(host.page.locator(".result-name")).toHaveText("<img src=x onerror=alert(1)>");
    assert.equal(await host.page.evaluate(() => (window as any).compromised), undefined);
    await expect(host.page.locator("#results-standings img")).toHaveCount(0); await host.page.keyboard.press("Escape");
    const viewer = await host.context.newPage(); await viewer.goto(`${origin}/spectate/${initial.gameId}`); await viewer.locator(".evidence-button").click();
    await expect(viewer.locator("#article-link")).toContainText("<script>window.compromised=true</script>"); await expect(viewer.locator("#article-link a")).toHaveCount(0);
    assert.equal(await viewer.evaluate(() => (window as any).compromised), undefined);
    await viewer.keyboard.press("Escape"); await expect(viewer.locator("#article-dialog")).not.toBeVisible();
    await host.page.setViewportSize({ width: 568, height: 850 }); await host.page.goto(`chrome-extension://${host.extensionId}/popup.html`);
    await expect(host.page.locator("#match-results")).toBeVisible(); await host.page.screenshot({ path: resolve(output, "popup-results-safe-text.png"), fullPage: true });
    assert.equal(await host.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Popup should not overflow horizontally");
    assert.equal(host.errors.length, 0, host.errors.join("\n"));
  } finally { await host?.context.close(); await rm(profile, { recursive: true, force: true }); }
});

test("a guest recovers an acknowledged-on-server rematch join after the host starts the next round", { timeout: 60000 }, async () => {
  const profile = await mkdtemp(resolve(".local/wr-rematch-guest-recovery-")); let guest: Player | undefined;
  const host = (await app.inject({ method: "POST", url: "/games", payload: { mode: "LOCKOUT", displayName: "Recovery captain" } })).json();
  const hostPost = async (path: string, body: object = {}) => {
    const response = await app.inject({ method: "POST", url: `/games/${host.gameId}${path}`, headers: { authorization: `Bearer ${host.playerToken}` }, payload: { playerId: host.playerId, ...body } });
    assert.equal(response.statusCode, 200, response.body); return response.json();
  };
  try {
    guest = await launch(profile); await configure(guest); await guest.page.locator("#player-name").fill("Recovering guest");
    await guest.page.locator("#join-game-id").fill(host.gameId); await guest.page.locator("#join-game-btn").click();
    await expect(guest.page.locator("#status")).toContainText("Mark Ready");
    const team = await hostPost("/teams", { name: "Recovery team" }); await hostPost(`/teams/${team.id}/join`);
    await expect(guest.page.locator("#team-select")).toContainText("Recovery team"); await guest.page.locator("#join-team-btn").click();
    await expect(guest.page.locator("#current-team")).toContainText("Recovery team");
    await hostPost("/end"); const nextHost = await hostPost("/rematch");
    await expect(guest.page.locator("#rematch")).toHaveText("Join Rematch");
    dropPath = `/games/${host.gameId}/rematch`; committed = null;
    await guest.page.locator("#rematch").click(); await expect(guest.page.locator("#retry-rematch")).toBeVisible({ timeout: 15000 });
    assert.ok(committed?.playerId); const nextGuestId = committed.playerId;
    dropPath = ""; await guest.context.close(); guest = undefined;
    // These already-admitted identities explicitly ready via the API before
    // exercising recovery after start; a lost rematch reply never auto-readies.
    for (const player of [nextHost, committed]) {
      const ready = await app.inject({method:"POST",url:`/games/${player.gameId}/ready`,headers:{authorization:`Bearer ${player.playerToken}`},payload:{playerId:player.playerId,isReady:true}});
      assert.equal(ready.statusCode,200,ready.body);
    }
    const started = await app.inject({ method: "POST", url: `/games/${nextHost.gameId}/start`, headers: { authorization: `Bearer ${nextHost.playerToken}` }, payload: { playerId: nextHost.playerId } });
    assert.equal(started.statusCode, 200);
    guest = await launch(profile); await expect(guest.page.locator("#retry-rematch")).toBeVisible();
    // Explicitly staying in the old round must not strand an already-created
    // membership when the next round has closed to new opt-ins.
    guest.page.once("dialog", dialog => dialog.accept()); await guest.page.locator("#forget-rematch").click();
    await expect(guest.page.locator("#pending-rematch")).toBeHidden();
    await expect(guest.page.locator("#rematch")).toHaveText("Recover Rematch");
    await guest.page.locator("#rematch").click(); await expect(guest.page.locator("#status")).toContainText("Match active");
    const recovered = await snapshot(guest); assert.equal(recovered.gameId, nextHost.gameId); assert.equal(recovered.playerId, nextGuestId);
    await expect(guest.page.locator("#current-team")).toContainText("Recovery team");
    assert.equal(await prisma.player.count({ where: { gameId: nextHost.gameId } }), 2);
    assert.equal(guest.errors.length, 0, guest.errors.join("\n"));
    await writeFile(resolve(output, "guest-recovery-result.json"), JSON.stringify({ passed: true, responseLostAfterCommit: true, pendingSurvivedRestart: true, recoveredAfterNextRoundStarted: true, recoveryAfterExplicitStayInPreviousMatch: true, preservedTeam: true, exactMembershipRecovered: true }, null, 2));
  } finally { dropPath = ""; await guest?.context.close(); await rm(profile, { recursive: true, force: true }); }
});
