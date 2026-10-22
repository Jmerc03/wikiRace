import type { BoardGenerationConfig, BoardSetupOptions, GameStateResponse, PlayerSessionResponse } from "@bingo/shared";
import { createServerClock, readPresence, type PresenceSnapshot } from "@bingo/shared";
import type { ExtensionState, ConnectionStatus } from "./client-types.js";
import { isArticleUrl, normalizeApiOrigin } from "./wikipedia.js";
import { BETA_BUILD, DEFAULT_API_ORIGIN } from "./build-config.js";

type Session = { gameId: string; playerId: string; playerToken: string };
type PendingAdmission = { kind: "create" | "join"; key: string; apiOrigin: string; path: string; body: unknown; displayName?: string; gameId?: string };
let pendingAdmission: PendingAdmission | null = null;
let pendingRematch = false;
let session: Session | null = null;
let state: GameStateResponse | null = null;
let apiOrigin = DEFAULT_API_ORIGIN;
let serverClock = createServerClock();
let connection: ConnectionStatus = "offline";
let lastError: string | undefined;
let invalidSession = false;
let generation = 0;
let ws: WebSocket | null = null;
let presence: PresenceSnapshot | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let socketWatchdog: ReturnType<typeof setInterval> | undefined;
let retryAttempt = 0;
let syncFlight: { generation: number; again: boolean; promise: Promise<ExtensionState> } | null = null;
let mutationQueue: Promise<unknown> = Promise.resolve();

const ready = chrome.storage.local.get(["gameId", "playerId", "playerToken", "apiOrigin", "pendingAdmission", "pendingRematch"]).then(saved => {
  if (BETA_BUILD && saved.apiOrigin && saved.apiOrigin !== DEFAULT_API_ORIGIN) {
    // Never forward an old server's credential to the beta server.
    lastError = "This beta uses a different server. Your previous server session has not been transferred.";
    return;
  }
  if (typeof saved.apiOrigin === "string") {
    try { apiOrigin = normalizeApiOrigin(saved.apiOrigin); } catch { /* Retain safe default for invalid old settings. */ }
  }
  if (typeof saved.gameId === "string" && typeof saved.playerId === "string") {
    session = { gameId: saved.gameId, playerId: saved.playerId, playerToken: typeof saved.playerToken === "string" ? saved.playerToken : "" };
    if (!session.playerToken) { invalidSession = true; lastError = "This older session has no private token. Forget it and join again."; }
    pendingRematch = saved.pendingRematch === session.gameId;
    if (pendingRematch) lastError = "Rematch entry is unfinished. Retry to recover your place in the next lobby.";
  }
  if (!session && saved.pendingAdmission && typeof saved.pendingAdmission === "object") {
    const pending = saved.pendingAdmission as PendingAdmission;
    if (["create", "join"].includes(pending.kind) && /^[A-Za-z0-9_-]{43}$/.test(pending.key) && typeof pending.path === "string") {
      try {
        pending.apiOrigin = normalizeApiOrigin(pending.apiOrigin);
        if (BETA_BUILD && pending.apiOrigin !== DEFAULT_API_ORIGIN) throw new Error("Foreign beta server");
        pendingAdmission = pending;
        apiOrigin = pending.apiOrigin;
        lastError = "Lobby entry is unfinished. Retry to recover the same player.";
      } catch { /* Invalid old storage cannot select an arbitrary server. */ }
    }
  }
});

class ApiError extends Error {
  constructor(message: string, public status = 0, public definitive = false) { super(message); }
}
function snapshot(): ExtensionState {
  return { ...(state ?? {}), gameId: session?.gameId ?? null, playerId: session?.playerId ?? null,
    board: state?.board ?? null, completedSquareIds: state?.completedSquareIds ?? [],
    apiOrigin, connection, error: lastError, invalidSession, pendingRematch, serverTime: serverClock.now(),
    presence: connection === "live" ? presence : null,
    ...(pendingAdmission ? { pendingAdmission: { kind: pendingAdmission.kind, displayName: pendingAdmission.displayName, gameId: pendingAdmission.gameId,
      ...(pendingAdmission.kind === "create" ? { boardConfig: (pendingAdmission.body as { boardConfig?: BoardGenerationConfig })?.boardConfig,
        timeLimitSeconds: (pendingAdmission.body as { timeLimitSeconds?: number | null })?.timeLimitSeconds } : {}) } } : {}) };
}
async function notifyPopup() {
  try { await chrome.runtime.sendMessage({ type: "GAME_STATE_UPDATED" }); } catch { /* Popup is closed. */ }
}
function reportError(error: unknown) {
  lastError = error instanceof Error ? error.message : "Something went wrong. Please try again.";
  if (session && error instanceof ApiError && [401,404].includes(error.status)) {
    invalidSession = true;
    disconnectWebSocket();
  }
  if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) connection = "offline";
  void notifyPopup();
  return snapshot();
}
async function request<T>(path: string, body?: unknown, identity: Session | null = session, admissionKey?: string): Promise<T> {
  const requestOrigin = apiOrigin;
  let response: Response;
  try {
    response = await fetch(`${requestOrigin}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(identity?.playerToken ? { Authorization: `Bearer ${identity.playerToken}` } : {}), ...(admissionKey ? { "Idempotency-Key": admissionKey } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError("Cannot reach the game server. Your session is saved; check the server address and retry.");
  }
  let result: any;
  if (requestOrigin === apiOrigin) serverClock.sync(Number(response.headers.get("X-WikiRace-Time")));
  try { result = await response.json(); } catch { throw new ApiError("The server returned an unreadable response.", response.status); }
  if (!response.ok) {
    const details = result.details?.map((item: any) => item.message).join("; ");
    throw new ApiError(details || result.error || `Request failed (${response.status})`, response.status, true);
  }
  return result as T;
}
function applyState(next: GameStateResponse, expectedGeneration: number) {
  if (invalidSession || expectedGeneration !== generation || next.gameId !== session?.gameId) return;
  if (state && next.revision < state.revision) return;
  state = next;
  lastError = undefined;
  invalidSession = false;
}
async function syncGameState(): Promise<ExtensionState> {
  await ready;
  if (!session || invalidSession) return snapshot();
  if (syncFlight?.generation === generation) { syncFlight.again = true; return syncFlight.promise; }
  const expectedGeneration = generation;
  const identity = session;
  const flight = { generation: expectedGeneration, again: false, promise: Promise.resolve(snapshot()) };
  flight.promise = (async () => {
    do {
      flight.again = false;
      const next = await request<GameStateResponse>(`/games/${identity.gameId}/state?playerId=${identity.playerId}`, undefined, identity);
      applyState(next, expectedGeneration);
    } while (flight.again && generation === expectedGeneration);
    if (generation === expectedGeneration) connectWebSocket();
    return snapshot();
  })().catch(error => generation === expectedGeneration ? reportError(error) : snapshot()).finally(() => { if (syncFlight === flight) syncFlight = null; });
  syncFlight = flight;
  return flight.promise;
}
function disconnectWebSocket() {
  presence = null;
  clearInterval(socketWatchdog); socketWatchdog = undefined;
  clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
  if (ws) { const old = ws; ws = null; old.onclose = null; old.onmessage = null; old.onerror = null; old.close(); }
  connection = "offline";
}
function connectWebSocket() {
  if (!session || invalidSession) return;
  const url = `${apiOrigin.replace(/^http/, "ws")}/ws/${session.gameId}`;
  if (ws?.url === url && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    if (ws.readyState === WebSocket.OPEN) connection = "live";
    return;
  }
  disconnectWebSocket();
  const expectedGeneration = generation;
  const identity = session;
  const socket = new WebSocket(url);
  ws = socket;
  let lastMessage = performance.now();
  socketWatchdog = setInterval(() => {
    if (ws === socket && socket.readyState === WebSocket.OPEN && performance.now() - lastMessage > 45000) {
      presence = null; connection = "reconnecting"; void notifyPopup(); socket.close();
    }
  }, 5000);
  connection = retryAttempt ? "reconnecting" : "connecting";
  socket.onopen = () => {
    if (ws !== socket) return;
    connection = "live";
    retryAttempt = 0;
    void syncGameState().then(notifyPopup);
  };
  socket.onmessage = event => {
    if (ws !== socket || generation !== expectedGeneration) return;
    lastMessage = performance.now();
    try {
      const message = JSON.parse(event.data);
      if (message.type === "GAME_STATE_UPDATED") void syncGameState().then(notifyPopup);
      if (message.type === "CONNECTED" && message.gameId === identity.gameId && message.capabilities?.includes("player-presence-v1")) {
        socket.send(JSON.stringify({ type: "AUTHENTICATE_PRESENCE", playerId: identity.playerId, playerToken: identity.playerToken }));
      }
      const update = readPresence(message, identity.gameId);
      if (update && JSON.stringify(update) !== JSON.stringify(presence)) { presence = update; void notifyPopup(); }
    } catch { /* An invalid realtime message must not destroy a saved session. */ }
  };
  socket.onerror = () => socket.close();
  socket.onclose = () => {
    if (ws !== socket) return;
    clearInterval(socketWatchdog); socketWatchdog = undefined;
    ws = null;
    presence = null;
    connection = "reconnecting";
    void notifyPopup();
    const delay = Math.min(15000, 500 * 2 ** Math.min(retryAttempt++, 5));
    reconnectTimer = setTimeout(() => {
      if (generation === expectedGeneration && session && !invalidSession) {
        connectWebSocket();
        void syncGameState();
      }
    }, delay);
  };
}
async function installSession(result: PlayerSessionResponse) {
  if (!result.gameId || !result.playerId || !result.playerToken || !result.board) throw new ApiError("The server did not return a complete player session.");
  const identity = { gameId: result.gameId, playerId: result.playerId, playerToken: result.playerToken };
  // Persist identity and resolve the pending key together before exposing success.
  await chrome.storage.local.set({ ...identity, apiOrigin, pendingAdmission: null, pendingRematch: null });
  pendingAdmission = null;
  pendingRematch = false;
  generation++;
  disconnectWebSocket();
  session = identity;
  // Keep the one-time token only in session storage, never in state sent to UI.
  const { playerToken: _token, ...publicState } = result;
  state = publicState;
  lastError = undefined;
  invalidSession = false;
  connectWebSocket();
  return snapshot();
}
async function forgetSession() {
  generation++;
  disconnectWebSocket();
  session = null;
  state = null;
  lastError = undefined;
  invalidSession = false;
  retryAttempt = 0;
  await chrome.storage.local.remove(["gameId", "playerId", "playerToken"]);
  return snapshot();
}
async function sendCurrentTabPageVisit() {
  if (!session || state?.status !== "ACTIVE") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !isArticleUrl(tab.url)) return;
  try { await sendPageVisit(await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_DATA" })); }
  catch { /* The page may predate extension loading; a reload attaches the content script. */ }
}
async function sendPageVisit(data: any) {
  await ready;
  if (!session || invalidSession || !data || typeof data.url !== "string" || !isArticleUrl(data.url)) return snapshot();
  if (!state) await syncGameState();
  if (state?.status !== "ACTIVE") return snapshot();
  const identity = session;
  const expectedGeneration = generation;
  try {
    const next = await request<GameStateResponse>(`/games/${identity.gameId}/events/page-visit`, { ...data, playerId: identity.playerId }, identity);
    applyState(next, expectedGeneration);
    await notifyPopup();
    return snapshot();
  } catch (error) { return generation === expectedGeneration ? reportError(error) : snapshot(); }
}
async function clearPendingAdmission() {
  await chrome.storage.local.remove("pendingAdmission");
  pendingAdmission = null;
}
async function retryAdmission() {
  if (!pendingAdmission) throw new Error("There is no pending lobby entry.");
  const pending = pendingAdmission;
  if (apiOrigin !== pending.apiOrigin) throw new Error("Return to the original server to recover this entry.");
  try {
    const readiness = await request<{ capabilities?: string[] }>("/ready", undefined, null);
    if (!readiness.capabilities?.includes("recoverable-admission-v1")) throw new ApiError("This server needs an update before it can recover lobby entries. Ask the host to update it, then retry.");
    if (pending.kind === "create" && (pending.body as { timeLimitSeconds?: number | null })?.timeLimitSeconds != null && !readiness.capabilities?.includes("timed-rounds-v1"))
      throw new ApiError("Update the game server before creating a timed round, then retry this saved entry.");
    const result = await request<PlayerSessionResponse>(pending.path, pending.body, null, pending.key);
    if (result.playerToken !== pending.key) throw new ApiError("This server does not support recoverable entry. Update the server before retrying.");
    return await installSession(result);
  } catch (error) {
    if (error instanceof ApiError && error.definitive && [400, 401, 403, 404, 409].includes(error.status)) await clearPendingAdmission();
    throw error;
  }
}

async function retryRematch() {
  if (!session) throw new Error("There is no previous player session to recover a rematch.");
  if (!pendingRematch) {
    await chrome.storage.local.set({ pendingRematch: session.gameId });
    pendingRematch = true;
  }
  try {
    const readiness = await request<{ capabilities?: string[] }>("/ready", undefined, null);
    if (!readiness.capabilities?.includes("rematch-v1")) throw new Error("Update the server before opening a rematch.");
    const result = await request<PlayerSessionResponse>(`/games/${session.gameId}/rematch`, { playerId: session.playerId });
    return await installSession(result);
  } catch (error) {
    if (error instanceof ApiError && error.definitive && [400, 401, 403, 404, 409].includes(error.status)) {
      await chrome.storage.local.remove("pendingRematch");
      pendingRematch = false;
    }
    throw error;
  }
}

async function handleMutation(message: any): Promise<ExtensionState> {
  await ready;
  if (typeof message.expectedGameId === "string" && message.expectedGameId !== session?.gameId) {
    throw new ApiError("This action belongs to a previous match. Refresh the board and try again.", 409, true);
  }
  if (message.type === "RETRY_REMATCH") {
    if (!pendingRematch) throw new Error("There is no pending rematch entry.");
    return retryRematch();
  }
  if (message.type === "FORGET_REMATCH") {
    await chrome.storage.local.remove("pendingRematch");
    pendingRematch = false;
    lastError = undefined;
    return snapshot();
  }
  if (pendingRematch) throw new Error("Retry the rematch or choose Stay in Previous Match before changing games.");
  if (message.type === "RETRY_ADMISSION") return retryAdmission();
  if (message.type === "FORGET_ADMISSION") {
    await clearPendingAdmission();
    lastError = undefined;
    return snapshot();
  }
  if (pendingAdmission) throw new Error("Recover or forget the pending lobby entry before changing games or servers.");
  if (message.type === "FORGET_GAME") return forgetSession();
  if (message.type === "SET_API_ORIGIN") {
    if (session) throw new Error("Leave your current game before changing servers.");
    const candidate = normalizeApiOrigin(message.apiOrigin);
    if (BETA_BUILD && candidate !== DEFAULT_API_ORIGIN) throw new Error("This beta uses the hosted WikiRace server.");
    if (!await chrome.permissions.contains({ origins: [`${candidate}/*`] })) throw new Error("Grant access to this server before saving it.");
    apiOrigin = candidate;
    serverClock = createServerClock();
    await chrome.storage.local.set({ apiOrigin });
    lastError = undefined;
    return snapshot();
  }
  if (message.type === "START_GAME" || message.type === "JOIN_GAME") {
    if (session) throw new Error("Leave your current game before creating or joining another.");
    if (message.type === "JOIN_GAME" && message.apiOrigin !== undefined) {
      const candidate = normalizeApiOrigin(message.apiOrigin);
      if (BETA_BUILD && candidate !== DEFAULT_API_ORIGIN) throw new Error("This invitation belongs to a different server than this beta.");
      if (!await chrome.permissions.contains({ origins: [`${candidate}/*`] })) throw new Error("Grant access to this invitation’s server before joining.");
      await chrome.storage.local.set({ apiOrigin: candidate });
      apiOrigin = candidate;
      serverClock = createServerClock();
    }
    const kind = message.type === "START_GAME" ? "create" : "join";
    const gameId = kind === "join" ? String(message.gameId).trim() : undefined;
    const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const pending: PendingAdmission = JSON.parse(JSON.stringify({
      kind, key, apiOrigin, gameId, displayName: message.displayName,
      path: kind === "create" ? "/games" : `/games/${encodeURIComponent(gameId!)}/players`,
      body: kind === "create" ? { mode: message.mode, boardConfig: message.boardConfig, displayName: message.displayName, timeLimitSeconds: message.timeLimitSeconds } : { displayName: message.displayName },
    }));
    await chrome.storage.local.set({ pendingAdmission: pending, apiOrigin });
    pendingAdmission = pending;
    return retryAdmission();
  }
  if (!session) throw new Error("Create or join a game first.");
  if (message.type === "CLEAR_GAME" || message.type === "LEAVE_GAME") {
    await request(`/games/${session.gameId}/players/${session.playerId}/leave`, {});
    return forgetSession();
  }
  if (invalidSession) throw new Error("Forget this unavailable session and join again.");
  const expectedGeneration = generation;
  const playerId = session.playerId;
  const base = `/games/${session.gameId}`;
  switch (message.type) {
    case "REMATCH": return retryRematch();
    case "SET_READY": applyState(await request<GameStateResponse>(`${base}/ready`, { playerId, isReady: message.isReady }), expectedGeneration); break;
    case "SET_JOIN_LOCK": applyState(await request<GameStateResponse>(`${base}/join-lock`, { playerId, isJoinLocked: message.isJoinLocked }), expectedGeneration); break;
    case "REMOVE_PLAYER": applyState(await request<GameStateResponse>(`${base}/players/${encodeURIComponent(message.targetPlayerId)}/remove`, { playerId }), expectedGeneration); break;
    case "START_MATCH": applyState(await request<GameStateResponse>(`${base}/start`, { playerId }), expectedGeneration); await sendCurrentTabPageVisit(); break;
    case "END_MATCH": applyState(await request<GameStateResponse>(`${base}/end`, { playerId }), expectedGeneration); break;
    case "CREATE_TEAM": await request(`${base}/teams`, { playerId, name: message.name }); break;
    case "JOIN_TEAM": await request(`${base}/teams/${encodeURIComponent(message.teamId)}/join`, { playerId }); break;
    case "LEAVE_TEAM": await request(`${base}/teams/leave`, { playerId }); break;
    default: throw new Error("Unknown game action.");
  }
  return syncGameState();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GAME_STATE_UPDATED") return false;
  if (message.type === "PAGE_VISIT") {
    // Only our Wikipedia content script may submit automatic page observations.
    if (!sender.tab || !sender.url || !isArticleUrl(sender.url)) return false;
    void sendPageVisit(message.data).then(sendResponse);
    return true;
  }
  // Content scripts are not allowed to create games, change identity or invoke
  // host controls. Only extension pages can issue those commands.
  if (sender.tab && !sender.url?.startsWith(chrome.runtime.getURL(""))) return false;
  if (message.type === "GET_GAME_STATE") { void ready.then(() => snapshot()).then(sendResponse); return true; }
  if (message.type === "GET_BOARD_OPTIONS") {
    void ready.then(async () => {
      const origin = apiOrigin;
      try { return { apiOrigin: origin, options: await request<BoardSetupOptions>("/games/board-options", undefined, null) }; }
      catch { return { apiOrigin: origin, error: "Cannot load board options. Check the server address and connection, and make sure the host has updated the server." }; }
    }).then(sendResponse);
    return true;
  }
  if (message.type === "SYNC_GAME_STATE") { void syncGameState().then(sendResponse); return true; }
  mutationQueue = mutationQueue.then(() => handleMutation(message)).catch(reportError);
  void mutationQueue.then(sendResponse);
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "wikirace-recover") void ready.then(async () => {
    if (session && !invalidSession) { await syncGameState(); connectWebSocket(); }
  });
});
void chrome.alarms.create("wikirace-recover", { periodInMinutes: 1 });
void ready.then(() => { if (session && !invalidSession) void syncGameState(); });
