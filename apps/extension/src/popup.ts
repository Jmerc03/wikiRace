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

const startButton = document.getElementById("start");
const refreshButton = document.getElementById("refresh");
const statusEl = document.getElementById("status");
const boardEl = document.getElementById("board");

startButton?.addEventListener("click", async () => {
  const state = await chrome.runtime.sendMessage({ type: "START_GAME" });
  renderState(state);
});

refreshButton?.addEventListener("click", async () => {
  const state = await chrome.runtime.sendMessage({ type: "GET_GAME_STATE" });
  renderState(state);
});

void loadExistingState();

async function loadExistingState() {
  const state = await chrome.runtime.sendMessage({ type: "GET_GAME_STATE" });
  renderState(state);
}

function renderState(state: GameState) {
  if (!statusEl || !boardEl) return;

  if (!state?.gameId || !state.board) {
    statusEl.textContent = "No game started.";
    boardEl.innerHTML = "";
    return;
  }

  statusEl.textContent = `Game active: ${state.gameId}`;

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
