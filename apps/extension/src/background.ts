let gameId: string | null = null;
let currentBoard: any = null;
let completedSquareIds = new Set<string>();

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  if (message.type === "START_GAME") {
    void startGame().then(sendResponse);
    return true;
  }

  if (message.type === "GET_GAME_STATE") {
    sendResponse({
      gameId,
      board: currentBoard,
      completedSquareIds: Array.from(completedSquareIds),
    });
    return false;
  }

  if (message.type === "PAGE_VISIT" && gameId) {
    void sendPageVisit(message.data);
    return false;
  }

  return false;
});

async function startGame() {
  const res = await fetch("http://localhost:4000/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "NORMAL" }),
  });

  const game = await res.json();

  gameId = game.id;
  currentBoard = game.board;
  completedSquareIds = new Set<string>();

  console.log("Game started:", game);

  await sendCurrentTabPageVisit();

  return {
    gameId,
    board: currentBoard,
    completedSquareIds: Array.from(completedSquareIds),
  };
}

async function sendPageVisit(data: unknown) {
  if (!gameId) return;

  const res = await fetch(
    `http://localhost:4000/games/${gameId}/events/page-visit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: "player_1",
        ...(data as object),
      }),
    },
  );

  const result = await res.json();

  for (const square of result.completedSquares ?? []) {
    completedSquareIds.add(square.id);
  }

  console.log("Page visit result:", result);
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
