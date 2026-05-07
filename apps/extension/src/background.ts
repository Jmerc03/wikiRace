let gameId: string | null = null;
let playerId: string | null = null;
let playerName: string | null = null;
let currentBoard: any = null;
let completedSquareIds = new Set<string>();
let ws: WebSocket | null = null;

let currentMode: string | null = null;
let currentStatus: string | null = null;
let currentBoardConfig: unknown = null;
let currentPlayerCount: number | null = null;
type BackgroundPlayerSummary = {
  id: string;
  displayName: string;
};

let currentPlayers: BackgroundPlayerSummary[] = [];
let currentSquareClaims: unknown[] = [];
let currentWinner = false;
let currentWinningLine: number[] | null = null;
let currentWinningLineType: string | null = null;

type SavedGameState = {
  gameId?: string;
  playerId?: string;
};

async function loadSavedGameState() {
  const saved = (await chrome.storage.local.get([
    "gameId",
    "playerId",
  ])) as SavedGameState;

  gameId = saved.gameId ?? null;
  playerId = saved.playerId ?? null;
}

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  if (message.type === "START_GAME") {
    void startGame(message.mode, message.boardConfig, message.displayName).then(
      sendResponse,
    );
    return true;
  }

  if (message.type === "SYNC_GAME_STATE") {
    void syncGameState().then(sendResponse);
    return true;
  }

  if (message.type === "GET_GAME_STATE") {
    void syncGameState().then(sendResponse);
    return true;
  }

  if (message.type === "JOIN_GAME") {
    void joinGame(message.gameId, message.displayName).then(sendResponse);
    return true;
  }

  if (message.type === "CLEAR_GAME") {
    void clearGame().then(sendResponse);
    return true;
  }

  if (message.type === "PAGE_VISIT") {
    void sendPageVisit(message.data);
    return false;
  }

  return false;
});

async function startGame(
  mode = "NORMAL",
  boardConfig?: unknown,
  displayName?: string,
) {
  const res = await fetch("http://localhost:4000/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      boardConfig,
      displayName,
    }),
  });

  const game = await res.json();

  gameId = game.id;
  currentBoard = game.board;
  playerId = game.players?.[0]?.id ?? null;
  playerName = game.players?.[0]?.displayName ?? null;
  completedSquareIds = new Set<string>();
  currentMode = game.mode ?? null;
  currentStatus = game.status ?? null;
  currentBoardConfig = game.boardConfig ?? null;
  currentPlayerCount = game.players?.length ?? null;
  currentPlayers = (game.players ?? []) as BackgroundPlayerSummary[];
  currentSquareClaims = [];
  currentWinner = game.winner ?? false;
  currentWinningLine = game.winningLine ?? null;
  currentWinningLineType = game.winningLineType ?? null;

  await chrome.storage.local.set({
    gameId,
    playerId,
  });

  if (gameId) {
    connectWebSocket(gameId);
  }

  console.log("Game started:", game);

  await sendCurrentTabPageVisit();

  return {
    gameId,
    playerId,
    playerCount: currentPlayerCount,
    players: currentPlayers,
    mode: currentMode,
    status: currentStatus,
    boardConfig: currentBoardConfig,
    board: currentBoard,
    completedSquareIds: Array.from(completedSquareIds),
    squareClaims: currentSquareClaims,
    winner: currentWinner,
    winningLine: currentWinningLine,
    winningLineType: currentWinningLineType,
  };
}

async function syncGameState() {
  if (!gameId || !playerId) {
    await loadSavedGameState();
  }

  if (!gameId || !playerId) {
    currentBoard = null;
    completedSquareIds = new Set<string>();
    currentMode = null;
    currentStatus = null;
    currentBoardConfig = null;
    currentPlayerCount = null;
    currentPlayers = [];
    currentSquareClaims = [];
    currentWinner = false;
    currentWinningLine = null;
    currentWinningLineType = null;

    return {
      gameId: null,
      playerId: null,
      board: null,
      completedSquareIds: [],
      squareClaims: [],
      winningLine: null,
      winningLineType: null,
    };
  }

  const res = await fetch(
    `http://localhost:4000/games/${gameId}/state?playerId=${playerId}`,
  );

  const state = await res.json();

  if (!res.ok) {
    gameId = null;
    playerId = null;
    currentBoard = null;
    currentMode = null;
    currentStatus = null;
    currentBoardConfig = null;
    currentPlayerCount = null;
    currentPlayers = [];
    completedSquareIds = new Set<string>();
    currentSquareClaims = [];
    currentWinner = false;
    currentWinningLine = null;
    currentWinningLineType = null;
    await chrome.storage.local.clear();

    return {
      gameId: null,
      playerId: null,
      board: null,
      completedSquareIds: [],
      squareClaims: [],
      error: state.error ?? "Failed to load game state",
      winningLine: null,
      winningLineType: null,
    };
  }

  currentBoard = state.board;
  completedSquareIds = new Set<string>(state.completedSquareIds ?? []);
  currentMode = state.mode ?? null;
  currentStatus = state.status ?? null;
  currentBoardConfig = state.boardConfig ?? null;
  currentPlayerCount = state.playerCount ?? null;
  currentPlayers = (state.players ?? []) as BackgroundPlayerSummary[];
  playerName =
    currentPlayers.find((player) => player.id === playerId)?.displayName ??
    playerName;
  currentSquareClaims = state.squareClaims ?? [];
  currentWinner = state.winner ?? false;
  currentWinningLine = state.winningLine ?? null;
  currentWinningLineType = state.winningLineType ?? null;

  if (gameId) {
    connectWebSocket(gameId);
  }

  return {
    gameId,
    playerId,
    mode: currentMode,
    status: currentStatus,
    boardConfig: currentBoardConfig,
    playerCount: currentPlayerCount,
    playerName,
    players: currentPlayers,
    board: currentBoard,
    completedSquareIds: Array.from(completedSquareIds),
    squareClaims: currentSquareClaims,
    winner: currentWinner,
    winningLine: currentWinningLine,
    winningLineType: currentWinningLineType,
  };
}

async function joinGame(joinGameId: string, displayName?: string) {
  const res = await fetch(`http://localhost:4000/games/${joinGameId}/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });

  const state = await res.json();

  if (!res.ok) {
    return {
      gameId: null,
      playerId: null,
      playerName: null,
      playerCount: null,
      board: null,
      completedSquareIds: [],
      squareClaims: [],
      winner: false,
      winningLine: null,
      winningLineType: null,
      error: state.error ?? "Failed to join game",
    };
  }

  gameId = state.gameId;
  playerId = state.playerId;
  playerName = state.playerName ?? null;
  currentBoard = state.board;
  completedSquareIds = new Set<string>(state.completedSquareIds ?? []);
  currentMode = state.mode ?? null;
  currentStatus = state.status ?? null;
  currentBoardConfig = state.boardConfig ?? null;
  currentPlayerCount = state.playerCount ?? null;
  currentPlayers = (state.players ?? []) as BackgroundPlayerSummary[];
  currentSquareClaims = state.squareClaims ?? [];
  currentWinner = state.winner ?? false;
  currentWinningLine = state.winningLine ?? null;
  currentWinningLineType = state.winningLineType ?? null;

  await chrome.storage.local.set({
    gameId,
    playerId,
  });

  if (gameId) {
    connectWebSocket(gameId);
  }

  return {
    gameId,
    playerId,
    playerName,
    playerCount: currentPlayerCount,
    players: currentPlayers,
    mode: currentMode,
    status: currentStatus,
    boardConfig: currentBoardConfig,
    board: currentBoard,
    completedSquareIds: Array.from(completedSquareIds),
    squareClaims: currentSquareClaims,
    winner: currentWinner,
    winningLine: currentWinningLine,
    winningLineType: currentWinningLineType,
  };
}

async function sendPageVisit(data: unknown) {
  if (!gameId || !playerId) {
    await loadSavedGameState();
  }

  if (!gameId || !playerId) return;

  const res = await fetch(
    `http://localhost:4000/games/${gameId}/events/page-visit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId,
        ...(data as object),
      }),
    },
  );

  const result = await res.json();

  if (result.board) {
    currentBoard = result.board;
  }

  currentMode = result.mode ?? currentMode;
  currentStatus = result.status ?? currentStatus;
  currentBoardConfig = result.boardConfig ?? currentBoardConfig;
  currentPlayerCount = result.playerCount ?? currentPlayerCount;
  currentPlayers = (result.players ??
    currentPlayers) as BackgroundPlayerSummary[];
  playerName =
    currentPlayers.find((player) => player.id === playerId)?.displayName ??
    playerName;
  currentSquareClaims = result.squareClaims ?? currentSquareClaims;
  currentWinner = result.winner ?? currentWinner;
  currentWinningLine = result.winningLine ?? currentWinningLine;
  currentWinningLineType = result.winningLineType ?? currentWinningLineType;

  for (const square of result.completedSquares ?? []) {
    completedSquareIds.add(square.id);
  }

  try {
    await chrome.runtime.sendMessage({
      type: "GAME_STATE_UPDATED",
    });
  } catch {
    // No popup is currently open to receive the update.
  }

  console.log("Page visit result:", result);
}

async function clearGame() {
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    ws.close();
    ws = null;
  }

  gameId = null;
  playerId = null;
  currentBoard = null;
  completedSquareIds = new Set<string>();
  currentMode = null;
  currentStatus = null;
  currentBoardConfig = null;
  currentPlayerCount = null;
  currentPlayers = [];
  currentSquareClaims = [];
  currentWinner = false;
  currentWinningLine = null;
  currentWinningLineType = null;

  await chrome.storage.local.remove(["gameId", "playerId"]);
  await chrome.storage.local.clear();

  return {
    gameId: null,
    playerId: null,
    playerName: null,
    playerCount: null,
    players: currentPlayers,
    board: null,
    completedSquareIds: [],
    squareClaims: [],
    winner: false,
    winningLine: null,
    winningLineType: null,
  };
}

async function sendCurrentTabPageVisit() {
  if (!gameId) return;

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab.id || !tab.url?.includes("wikipedia.org")) {
    console.log("Active tab is not a Wikipedia page.");
    return;
  }

  try {
    const pageData = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_PAGE_DATA",
    });

    await sendPageVisit(pageData);
  } catch (err) {
    console.log(
      "Could not get page data from tab. Reload the Wikipedia page and try again.",
      err,
    );
  }
}

function connectWebSocket(activeGameId: string) {
  if (ws) {
    ws.close();
  }

  ws = new WebSocket(`ws://localhost:4000/ws/${activeGameId}`);

  ws.onopen = () => {
    console.log("WebSocket connected");
  };

  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    if (message.type !== "GAME_STATE_UPDATED") {
      return;
    }

    completedSquareIds = new Set<string>(message.data.completedSquareIds ?? []);
    currentBoard = message.data.board ?? currentBoard;
    currentMode = message.data.mode ?? currentMode;
    currentStatus = message.data.status ?? currentStatus;
    currentBoardConfig = message.data.boardConfig ?? currentBoardConfig;
    currentPlayerCount = message.data.playerCount ?? currentPlayerCount;
    currentPlayers = (message.data.players ??
      currentPlayers) as BackgroundPlayerSummary[];
    playerName =
      currentPlayers.find((player) => player.id === playerId)?.displayName ??
      playerName;
    currentSquareClaims = message.data.squareClaims ?? currentSquareClaims;
    currentWinner = message.data.winner ?? currentWinner;
    currentWinningLine = message.data.winningLine ?? currentWinningLine;
    currentWinningLineType =
      message.data.winningLineType ?? currentWinningLineType;

    try {
      await chrome.runtime.sendMessage({
        type: "GAME_STATE_UPDATED",
      });
    } catch {
      // Popup is closed.
    }
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected");
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
}
