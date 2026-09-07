import type { GameStateResponse, PlayerSessionResponse } from "@bingo/shared";
import type { ExtensionState, ConnectionStatus } from "./client-types.js";
import { isArticleUrl, normalizeApiOrigin } from "./wikipedia.js";

type Session = { gameId: string; playerId: string; playerToken: string };
let session: Session | null = null;
let state: GameStateResponse | null = null;
let apiOrigin = "http://localhost:4000";
let connection: ConnectionStatus = "offline";
let lastError: string | undefined;
let invalidSession = false;
let generation = 0;
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let retryAttempt = 0;
let syncFlight: { generation: number; again: boolean; promise: Promise<ExtensionState> } | null = null;
let mutationQueue: Promise<unknown> = Promise.resolve();

const ready = chrome.storage.local.get(["gameId", "playerId", "playerToken", "apiOrigin"]).then(saved => {
  if (typeof saved.apiOrigin === "string") {
    try { apiOrigin = normalizeApiOrigin(saved.apiOrigin); } catch { /* Retain safe default for invalid old settings. */ }
  }
  if (typeof saved.gameId === "string" && typeof saved.playerId === "string") {
    session = { gameId: saved.gameId, playerId: saved.playerId, playerToken: typeof saved.playerToken === "string" ? saved.playerToken : "" };
    if (!session.playerToken) { invalidSession = true; lastError = "This older session has no private token. Forget it and join again."; }
  }
});

class ApiError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}
function snapshot(): ExtensionState {
  return { ...(state ?? {}), gameId: session?.gameId ?? null, playerId: session?.playerId ?? null,
    board: state?.board ?? null, completedSquareIds: state?.completedSquareIds ?? [],
    apiOrigin, connection, error: lastError, invalidSession };
}
async function notifyPopup() {
  try { await chrome.runtime.sendMessage({ type: "GAME_STATE_UPDATED" }); } catch { /* Popup is closed. */ }
}
function reportError(error: unknown) {
  lastError = error instanceof Error ? error.message : "Something went wrong. Please try again.";
  if (error instanceof ApiError && [401,404].includes(error.status)) invalidSession = true;
  if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) connection = "offline";
  void notifyPopup();
  return snapshot();
}
async function request<T>(path: string, body?: unknown, identity: Session | null = session): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiOrigin}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(identity?.playerToken ? { Authorization: `Bearer ${identity.playerToken}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError("Cannot reach the game server. Your session is saved; check the server address and retry.");
  }
  let result: any;
  try { result = await response.json(); } catch { throw new ApiError("The server returned an unreadable response.", response.status); }
  if (!response.ok) {
    const details = result.details?.map((item: any) => item.message).join("; ");
    throw new ApiError(details || result.error || `Request failed (${response.status})`, response.status);
  }
  return result as T;
}
function applyState(next: GameStateResponse, expectedGeneration: number) {
  if (expectedGeneration !== generation || next.gameId !== session?.gameId) return;
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
  const socket = new WebSocket(url);
  ws = socket;
  connection = retryAttempt ? "reconnecting" : "connecting";
  socket.onopen = () => {
    if (ws !== socket) return;
    connection = "live";
    retryAttempt = 0;
    void syncGameState().then(notifyPopup);
  };
  socket.onmessage = event => {
    if (ws !== socket || generation !== expectedGeneration) return;
    try {
      const message = JSON.parse(event.data);
      if (message.type === "GAME_STATE_UPDATED") void syncGameState().then(notifyPopup);
    } catch { /* An invalid realtime message must not destroy a saved session. */ }
  };
  socket.onerror = () => socket.close();
  socket.onclose = () => {
    if (ws !== socket) return;
    ws = null;
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
  generation++;
  disconnectWebSocket();
  session = { gameId: result.gameId, playerId: result.playerId, playerToken: result.playerToken };
  // Keep the one-time token only in session storage, never in state sent to UI.
  const { playerToken: _token, ...publicState } = result;
  state = publicState;
  lastError = undefined;
  invalidSession = false;
  await chrome.storage.local.set(session);
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
async function handleMutation(message: any): Promise<ExtensionState> {
  await ready;
  if (message.type === "FORGET_GAME") return forgetSession();
  if (message.type === "SET_API_ORIGIN") {
    if (session) throw new Error("Leave your current game before changing servers.");
    const candidate = normalizeApiOrigin(message.apiOrigin);
    if (!await chrome.permissions.contains({ origins: [`${candidate}/*`] })) throw new Error("Grant access to this server before saving it.");
    apiOrigin = candidate;
    await chrome.storage.local.set({ apiOrigin });
    lastError = undefined;
    return snapshot();
  }
  if (message.type === "START_GAME" || message.type === "JOIN_GAME") {
    if (session) throw new Error("Leave your current game before creating or joining another.");
    const result = message.type === "START_GAME"
      ? await request<PlayerSessionResponse>("/games", { mode: message.mode, boardConfig: message.boardConfig, displayName: message.displayName }, null)
      : await request<PlayerSessionResponse>(`/games/${encodeURIComponent(String(message.gameId).trim())}/players`, { displayName: message.displayName }, null);
    return installSession(result);
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
