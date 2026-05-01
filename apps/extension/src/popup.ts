type BoardSquare = {
  id: string;
  position: number;
  label: string;
};

type GameState = {
  gameId: string | null;
  board: {
    squares: BoardSquare[];
  } | null;
  completedSquareIds: string[];
};

const difficultySelect = document.getElementById("difficulty");

const startButton = document.getElementById("start");
const refreshButton = document.getElementById("refresh");
const statusEl = document.getElementById("status");
const boardEl = document.getElementById("board");
const endGameButton = document.getElementById("end-game");
const progressEl = document.getElementById("progress");

startButton?.addEventListener("click", async () => {
  const difficulty =
    difficultySelect instanceof HTMLSelectElement
      ? difficultySelect.value
      : "MIXED";

  const state = await chrome.runtime.sendMessage({
    type: "START_GAME",
    boardConfig: {
      difficulty,
      vitalArticleTileCount: 15,
      genericTileCount: 10,
      maxTilesPerTopic: 3,
    },
  });
  renderState(state);
});

refreshButton?.addEventListener("click", async () => {
  const state = await chrome.runtime.sendMessage({ type: "SYNC_GAME_STATE" });
  renderState(state);
});

endGameButton?.addEventListener("click", async () => {
  const state = await chrome.runtime.sendMessage({ type: "CLEAR_GAME" });
  renderState(state);
});

void loadExistingState();

async function loadExistingState() {
  const state = await chrome.runtime.sendMessage({ type: "SYNC_GAME_STATE" });
  renderState(state);
}

function renderState(state: GameState) {
  if (!statusEl || !boardEl) return;

  if (!state?.gameId || !state.board) {
    statusEl.textContent = "No game started.";

    if (difficultySelect instanceof HTMLElement) {
      difficultySelect.style.display = "inline-block";
    }
    if (progressEl) progressEl.textContent = "";

    if (startButton instanceof HTMLElement)
      startButton.style.display = "inline-block";
    if (endGameButton instanceof HTMLElement)
      endGameButton.style.display = "none";
    if (refreshButton instanceof HTMLElement)
      refreshButton.style.display = "none";

    boardEl.innerHTML = "";
    return;
  }

  statusEl.textContent = `Game active: ${state.gameId}`;

  if (difficultySelect instanceof HTMLElement) {
    difficultySelect.style.display = "none";
  }

  if (startButton instanceof HTMLElement) startButton.style.display = "none";
  if (endGameButton instanceof HTMLElement)
    endGameButton.style.display = "inline-block";
  if (refreshButton instanceof HTMLElement)
    refreshButton.style.display = "inline-block";

  const completedCount = state.completedSquareIds.length;
  const totalCount = state.board.squares.length;

  if (progressEl) {
    progressEl.textContent = `Progress: ${completedCount}/${totalCount}`;
  }

  const completed = new Set(state.completedSquareIds);

  boardEl.innerHTML = "";

  const squares = [...state.board.squares].sort(
    (a, b) => a.position - b.position,
  );

  for (const square of squares) {
    const div = document.createElement("div");
    div.className = completed.has(square.id) ? "square completed" : "square";
    div.textContent = square.label;
    boardEl.appendChild(div);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "GAME_STATE_UPDATED") {
    renderState(message.data);
  }
});
