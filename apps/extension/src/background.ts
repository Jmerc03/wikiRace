let gameId: string | null = null;

chrome.runtime.onMessage.addListener((message: any) => {
  if (message.type === "START_GAME") {
    void startGame();
  }

  if (message.type === "PAGE_VISIT" && gameId) {
    void sendPageVisit(message.data);
  }
});

async function startGame() {
  const res = await fetch("http://localhost:4000/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "NORMAL" }),
  });

  const game = await res.json();
  gameId = game.id;

  console.log("Game started:", game);
  await sendCurrentTabPageVisit();
}

async function sendPageVisit(data: unknown) {
  await fetch(`http://localhost:4000/games/${gameId}/events/page-visit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerId: "player_1",
      ...(data as object),
    }),
  });
  console.log("papge vist");
}

async function sendCurrentTabPageVisit() {
  if (!gameId) return;

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab.id || !tab.url?.includes("wikipedia.org")) {
    return;
  }

  const pageData = await chrome.tabs.sendMessage(tab.id, {
    type: "GET_PAGE_DATA",
  });

  await sendPageVisit(pageData);
}
