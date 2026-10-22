import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, type BrowserContext, type Page } from "@playwright/test";
import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/db/prisma.js";

const app = buildApp();
const extensionPath = resolve("apps/extension/dist");
const output = resolve(".jes/local/ewp-012/browser", String(Date.now()));
let origin: string;
let dropPath = "";
let committed: any;
let dropped = 0;
let heldPath = "";
let heldArrived: (() => void) | undefined;
let releaseHeld: (() => void) | undefined;
let holdResponse: Promise<void> | undefined;
app.addHook("onSend", async (request, reply, payload) => {
  if (request.method === "POST" && request.url === dropPath && reply.statusCode < 300) {
    committed = JSON.parse(String(payload)); dropped++; reply.raw.destroy();
  }
  if(request.method === "GET" && request.url === heldPath && holdResponse) { heldArrived?.(); await holdResponse; }
  return payload;
});
before(async () => { await mkdir(output, { recursive: true }); console.log(`Host-controls browser evidence: ${output}`); origin = await app.listen({ port: 0, host: "127.0.0.1" }); });
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
async function post(p: any, path: string, body: object = {}) {
  const response=await app.inject({method:"POST",url:`/games/${p.gameId}${path}`,headers:{authorization:`Bearer ${p.playerToken}`},payload:{playerId:p.playerId,...body}});
  assert.equal(response.statusCode,200,response.body);return response.json();
}
async function makePair(mode: string, profiles: string[]) {
  const host=await launch(profiles[0]);const guest=await launch(profiles[1]);await configure(host);await configure(guest);
  await host.page.locator("#player-name").fill("Lobby Captain");await host.page.locator("#game-mode").selectOption(mode);await host.page.locator("#start").click();
  await expect(host.page.locator("#set-ready")).toBeVisible();const initial=await snapshot(host);
  await guest.page.locator("#player-name").fill("<b>Lobby Guest</b>");await guest.page.locator("#join-game-id").fill(initial.gameId);await guest.page.locator("#join-game-btn").click();
  await expect(host.page.locator(".remove-player")).toHaveCount(1);return {host,guest,initial};
}

for(const mode of ["NORMAL","LOCKOUT"])test(`${mode}: host locks invitations and removes a lobby member with clear synchronized feedback`,{timeout:90000},async()=>{
  const profiles=[await mkdtemp(resolve(".local/wr-control-host-")),await mkdtemp(resolve(".local/wr-control-guest-"))];let host:Player|undefined;let guest:Player|undefined;
  try {
    ({host,guest}=await makePair(mode,profiles));const initial=await snapshot(host);const guestId=(await snapshot(guest)).playerId;
    await expect(guest.page.locator("#join-lock")).toBeHidden();await expect(guest.page.locator(".remove-player")).toHaveCount(0);
    const spectator=await host.context.newPage();await spectator.goto(`${origin}/spectate/${initial.gameId}`);
    const invitation=await host.context.newPage();await invitation.goto(`${origin}/join/${initial.gameId}`);await expect(invitation.locator("#copy-invitation")).toBeEnabled();
    await host.page.locator("#set-ready").click();await expect(host.page.locator("#set-ready")).toHaveAttribute("aria-pressed","true");
    await host.page.locator("#join-lock").click();await expect(host.page.locator("#join-lock")).toHaveText("Reopen Joining");
    await expect(guest.page.locator("#joining-access")).toContainText("Joining locked");await expect(spectator.locator("#joining-access")).toContainText("Joining locked");
    await invitation.reload();await expect(invitation.locator("#invite-title")).toHaveText("Joining is locked.");await expect(invitation.locator("#copy-invitation")).toBeDisabled();
    host.page.once("dialog",dialog=>dialog.dismiss());await host.page.locator(".remove-player").click();
    assert.equal(await prisma.player.count({where:{gameId:initial.gameId,leftAt:null}}),2,"Cancel preserves membership");
    host.page.once("dialog",dialog=>dialog.accept());await host.page.locator(".remove-player").click();
    await expect(guest.page.locator("#status")).toContainText("host removed you");await expect(guest.page.locator("#forget-game")).toBeVisible();
    await expect(guest.page.locator("#set-ready")).toBeHidden();await expect(guest.page.locator("#team-controls")).toBeHidden();await expect(guest.page.locator("#lobby-hint")).toBeHidden();await expect(guest.page.locator("#session-unavailable-note")).toBeVisible();await expect(host.page.locator("#start-match")).toBeEnabled();
    await expect(host.page.locator("#player-roster")).toContainText("<b>Lobby Guest</b> · removed");await expect(host.page.locator("#player-roster b")).toHaveCount(0);
    await expect(spectator.locator("#notice")).toContainText("1/1 ready");
    await host.page.setViewportSize({width:568,height:850});await host.page.goto(`chrome-extension://${host.extensionId}/popup.html`);
    await expect(host.page.locator("#start-match")).toBeEnabled();assert.equal(await host.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await host.page.screenshot({path:resolve(output,`${mode.toLowerCase()}-locked-lobby.png`),fullPage:true});await guest.page.screenshot({path:resolve(output,`${mode.toLowerCase()}-removed-player.png`),fullPage:true});
    await guest.context.close();guest=await launch(profiles[1]);await expect(guest.page.locator("#status")).toContainText("host removed you");assert.equal((await snapshot(guest)).playerId,guestId);
    await guest.page.locator("#forget-game").click();await guest.page.locator("#join-game-id").fill(initial.gameId);await guest.page.locator("#join-game-btn").click();
    await expect(guest.page.locator("#status")).toContainText("Joining is locked");assert.equal((await snapshot(guest)).pendingAdmission,undefined);assert.equal(await prisma.player.count({where:{gameId:initial.gameId}}),2);
    await host.page.locator("#join-lock").click();await expect(host.page.locator("#join-lock")).toHaveText("Lock Joining");await guest.page.locator("#join-game-btn").click();
    await expect(guest.page.locator("#set-ready")).toBeVisible();assert.notEqual((await snapshot(guest)).playerId,guestId,"Removal is not a ban on future anonymous memberships");
    await expect(host.page.locator("#start-match")).toBeDisabled();await guest.page.locator("#set-ready").click();await expect(host.page.locator("#start-match")).toBeEnabled();
    await host.page.locator("#start-match").click();await expect(host.page.locator(".remove-player")).toHaveCount(0);
    await host.page.locator("#join-lock").click();await expect(guest.page.locator("#joining-access")).toContainText("Joining locked");
    await host.page.locator("#end-game").click();await expect(guest.page.locator("#join-lock")).toHaveText("Reopen Joining");
    await guest.page.locator("#join-lock").click();await expect(spectator.locator("#joining-access")).toContainText("Joining open");
    assert.equal(host.errors.length+guest.errors.length,0,[...host.errors,...guest.errors].join("\n"));
    await writeFile(resolve(output,`${mode.toLowerCase()}-result.json`),JSON.stringify({passed:true,mode,profile:"actual Chromium extension profiles, invitation and spectator with real PostgreSQL/HTTP/WebSockets",hostOnlyControls:true,removalConfirmationCancelAndAccept:true,revocationSurvivesRestart:true,joinLockAndReopen:true,hostTransferDuringPlay:true,removedRowsRetained:true,noBanClaim:true,compactPopupFits:true},null,2));
  } finally {await host?.context.close();await guest?.context.close();for(const profile of profiles)await rm(profile,{recursive:true,force:true});}
});

test("a revoked session cannot be revived by an earlier in-flight state response",{timeout:60000},async()=>{
  const profiles=[await mkdtemp(resolve(".local/wr-revoke-host-")),await mkdtemp(resolve(".local/wr-revoke-guest-"))];let host:Player|undefined;let guest:Player|undefined;
  try {
    ({host,guest}=await makePair("NORMAL",profiles));const initial=await snapshot(guest);
    heldPath=`/games/${initial.gameId}/state?playerId=${initial.playerId}`;
    const arrived=new Promise<void>(resolve=>{heldArrived=resolve;});holdResponse=new Promise<void>(resolve=>{releaseHeld=resolve;});
    const oldResponse=guest.page.evaluate(()=>chrome.runtime.sendMessage({type:"SYNC_GAME_STATE"}));await arrived;
    host.page.once("dialog",dialog=>dialog.accept());await host.page.locator(".remove-player").click();
    await expect(host.page.locator(".remove-player")).toHaveCount(0);
    const denied=await guest.page.evaluate(()=>chrome.runtime.sendMessage({type:"SET_READY",isReady:true}));
    assert.equal(denied.invalidSession,true);assert.match(denied.error,/host removed you/);
    heldPath="";releaseHeld!();await oldResponse;
    const current=await snapshot(guest);assert.equal(current.invalidSession,true);assert.equal(current.connection,"offline");
    await expect(guest.page.locator("#set-ready")).toBeHidden();await expect(guest.page.locator("#status")).toContainText("host removed you");
    assert.equal((await prisma.player.findUniqueOrThrow({where:{id:initial.playerId}})).isReady,false);
    await writeFile(resolve(output,"revoked-stale-response.json"),JSON.stringify({passed:true,realOldResponseHeldBeforeRemoval:true,serverRejectsRevokedMutation:true,lateResponseCannotRestoreSession:true},null,2));
  } finally {heldPath="";releaseHeld?.();holdResponse=undefined;await host?.context.close();await guest?.context.close();for(const profile of profiles)await rm(profile,{recursive:true,force:true});}
});

test("committed lock and removal responses recover after browser restart without duplicate revisions",{timeout:60000},async()=>{
  const profile=await mkdtemp(resolve(".local/wr-host-action-recovery-"));let host:Player|undefined;
  try {
    host=await launch(profile);await configure(host);await host.page.locator("#start").click();await expect(host.page.locator("#join-lock")).toBeVisible();const initial=await snapshot(host);
    const guest=(await app.inject({method:"POST",url:`/games/${initial.gameId}/players`,payload:{displayName:"Recovery target"}})).json();await expect(host.page.locator(".remove-player")).toHaveCount(1);
    dropPath=`/games/${initial.gameId}/join-lock`;await host.page.locator("#join-lock").click();await expect.poll(()=>dropped).toBeGreaterThan(0);
    await expect(host.page.locator("body")).not.toHaveAttribute("aria-busy","true",{timeout:15000});dropPath="";
    await host.context.close();host=await launch(profile);await expect(host.page.locator("#join-lock")).toHaveText("Reopen Joining");
    dropPath=`/games/${initial.gameId}/players/${guest.playerId}/remove`;host.page.once("dialog",dialog=>dialog.accept());await host.page.locator(".remove-player").click();
    await expect.poll(async()=>(await prisma.player.findUniqueOrThrow({where:{id:guest.playerId}})).removedByHost).toBe(true);
    await expect(host.page.locator("body")).not.toHaveAttribute("aria-busy","true",{timeout:15000});dropPath="";
    await host.context.close();host=await launch(profile);await expect(host.page.locator("#player-roster")).toContainText("Recovery target · removed");
    const before=await snapshot(host);assert.equal(before.revision,3);assert.equal(before.isJoinLocked,true);
    const replay=await host.page.evaluate(async(targetPlayerId)=>{
      await chrome.runtime.sendMessage({type:"SET_JOIN_LOCK",isJoinLocked:true});return chrome.runtime.sendMessage({type:"REMOVE_PLAYER",targetPlayerId});
    },guest.playerId);
    assert.equal(replay.revision,3);assert.equal(replay.playerId,initial.playerId);assert.equal(replay.playerToken,undefined);
    await writeFile(resolve(output,"response-loss.json"),JSON.stringify({passed:true,droppedCommittedResponses:dropped,lockAndRemovalSurvivedRestart:true,desiredStateAndRemovalRetriesIdempotent:true},null,2));
  } finally {dropPath="";await host?.context.close();await rm(profile,{recursive:true,force:true});}
});

test("previous-round players see rematch locks, can join after reopening and reconnect through a later lock",{timeout:60000},async()=>{
  const profiles=[await mkdtemp(resolve(".local/wr-locked-rematch-host-")),await mkdtemp(resolve(".local/wr-locked-rematch-guest-"))];let host:Player|undefined;let guest:Player|undefined;
  try {
    ({host,guest}=await makePair("LOCKOUT",profiles));await host.page.locator("#host-end").click();await expect(host.page.locator("#rematch")).toBeVisible();
    await host.page.locator("#rematch").click();await expect(host.page.locator("#join-lock")).toBeVisible();await expect(host.page.locator("#join-lock")).toHaveText("Lock Joining");const next=await snapshot(host);
    await host.page.locator("#join-lock").click();await expect(guest.page.locator("#rematch-hint")).toContainText("Joining the next round is locked");await expect(guest.page.locator("#rematch")).toHaveText("Recover Rematch");
    await guest.page.locator("#rematch").click();await expect(guest.page.locator("#status")).toContainText("Joining is locked");assert.equal((await snapshot(guest)).pendingRematch,false);
    await host.page.locator("#join-lock").click();await expect(guest.page.locator("#rematch")).toHaveText("Join Rematch");await guest.page.locator("#rematch").click();
    await expect(guest.page.locator("#set-ready")).toBeVisible();assert.equal((await snapshot(guest)).gameId,next.gameId);
    await guest.page.locator("#set-ready").click();await expect(guest.page.locator("#set-ready")).toHaveAttribute("aria-pressed","true");
    await host.page.locator("#join-lock").click();await expect(guest.page.locator("#joining-access")).toContainText("Joining locked");const playerId=(await snapshot(guest)).playerId;
    await guest.context.close();guest=await launch(profiles[1]);await expect(guest.page.locator("#set-ready")).toHaveAttribute("aria-pressed","true");assert.equal((await snapshot(guest)).playerId,playerId);
    await writeFile(resolve(output,"rematch-lock.json"),JSON.stringify({passed:true,previousRoundNotified:true,newOptInBlocked:true,reopenAllowsOptIn:true,existingIdentityAndReadinessSurviveLockedRestart:true},null,2));
  } finally {await host?.context.close();await guest?.context.close();for(const profile of profiles)await rm(profile,{recursive:true,force:true});}
});
