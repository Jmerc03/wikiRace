let gameId: string | null = null;
let playerId: string | null = null;
let currentBoard: any = null;
let completedSquareIds = new Set<string>();

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
    void startGame(message.boardConfig).then(sendResponse);
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

  if (message.type === "PAGE_VISIT") {
    void sendPageVisit(message.data);
    return false;
  }

  return false;
});

async function startGame(boardConfig?: unknown) {
  const res = await fetch("http://localhost:4000/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "NORMAL",
      boardConfig,
    }),
  });

  const game = await res.json();

  gameId = game.id;
  currentBoard = game.board;
  playerId = game.players?.[0]?.id ?? null;
  completedSquareIds = new Set<string>();

  await chrome.storage.local.set({
    gameId,
    playerId,
  });

  console.log("Game started:", game);

  await sendCurrentTabPageVisit();

  return {
    gameId,
    board: currentBoard,
    completedSquareIds: Array.from(completedSquareIds),
  };
}

async function syncGameState() {
  if (!gameId || !playerId) {
    await loadSavedGameState();
  }

  if (!gameId || !playerId) {
    return {
      gameId: null,
      playerId: null,
      board: null,
      completedSquareIds: [],
    };
  }

  const res = await fetch(
    `http://localhost:4000/games/${gameId}/state?playerId=${playerId}`,
  );

  const state = await res.json();

  if (!res.ok) {
    return {
      gameId: null,
      playerId: null,
      board: null,
      completedSquareIds: [],
    };
  }

  currentBoard = state.board;
  completedSquareIds = new Set<string>(state.completedSquareIds ?? []);

  return state;
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

  for (const square of result.completedSquares ?? []) {
    completedSquareIds.add(square.id);
  }

  try {
    await chrome.runtime.sendMessage({
      type: "GAME_STATE_UPDATED",
      data: {
        gameId,
        board: currentBoard,
        completedSquareIds: Array.from(completedSquareIds),
      },
    });
  } catch {
    // No popup is currently open to receive the update.
  }

  console.log("Page visit result:", result);
}

async function clearGame() {
  gameId = null;
  playerId = null;
  currentBoard = null;
  completedSquareIds = new Set<string>();

  await chrome.storage.local.remove(["gameId", "playerId"]);

  return {
    gameId: null,
    playerId: null,
    board: null,
    completedSquareIds: [],
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
