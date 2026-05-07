type BoardSquare = {
  id: string;
  position: number;
  label: string;
};

type PlayerSummary = {
  id: string;
  displayName: string;
};

type GameState = {
  gameId: string | null;
  playerId?: string | null;
  playerName?: string | null;
  mode?: string;
  status?: string;
  error?: string;
  playerCount?: number;
  players?: PlayerSummary[];
  winner?: boolean;
  winningLine?: number[] | null;
  winningLineType?: "ROW" | "COLUMN" | "DIAGONAL" | null;
  boardConfig?: {
    difficulty?: string;
  };
  board: {
    squares: BoardSquare[];
  } | null;
  completedSquareIds: string[];
  squareClaims?: SquareClaim[];
};

type SquareClaim = {
  squareId: string;
  playerId: string;
  playerName: string;
  claimedAt: string;
};

const gameModeSelect = document.getElementById("game-mode");
const playerNameInput = document.getElementById("player-name");

const difficultySelect = document.getElementById("difficulty");

const startButton = document.getElementById("start");
const refreshButton = document.getElementById("refresh");
const endGameButton = document.getElementById("end-game");
const copyGameIdButton = document.getElementById("copy-game-id");

const joinGameInput = document.getElementById("join-game-id");
const joinGameBtn = document.getElementById("join-game-btn");

const statusEl = document.getElementById("status");
const progressEl = document.getElementById("progress");
const gameInfoEl = document.getElementById("game-info");

const boardEl = document.getElementById("board");

if (!(joinGameBtn instanceof HTMLButtonElement)) {
  throw new Error("join-game-btn not found or wrong type");
}

joinGameBtn.addEventListener("click", async () => {
  if (!(joinGameInput instanceof HTMLInputElement)) return;

  const displayName =
    playerNameInput instanceof HTMLInputElement && playerNameInput.value.trim()
      ? playerNameInput.value.trim()
      : undefined;

  const gameId = joinGameInput.value.trim();

  if (!gameId) return;

  const state = await chrome.runtime.sendMessage({
    displayName,
    type: "JOIN_GAME",
    gameId,
  });

  renderState(state);
});

startButton?.addEventListener("click", async () => {
  const displayName =
    playerNameInput instanceof HTMLInputElement && playerNameInput.value.trim()
      ? playerNameInput.value.trim()
      : undefined;
  const mode =
    gameModeSelect instanceof HTMLSelectElement
      ? gameModeSelect.value
      : "NORMAL";

  const difficulty =
    difficultySelect instanceof HTMLSelectElement
      ? difficultySelect.value
      : "MIXED";

  const state = await chrome.runtime.sendMessage({
    displayName,
    type: "START_GAME",
    mode,
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
  await syncAndRenderState();
});

endGameButton?.addEventListener("click", async () => {
  const state = await chrome.runtime.sendMessage({
    type: "CLEAR_GAME",
  });

  renderState(state);
});

copyGameIdButton?.addEventListener("click", async () => {
  const state = await chrome.runtime.sendMessage({ type: "GET_GAME_STATE" });

  if (!state?.gameId) {
    if (statusEl) statusEl.textContent = "No active game to copy.";
    return;
  }

  await navigator.clipboard.writeText(state.gameId);

  if (statusEl) {
    statusEl.textContent = "Game ID copied.";
  }
});

void loadExistingState();

async function loadExistingState() {
  await syncAndRenderState();
}

async function syncAndRenderState() {
  const state = await chrome.runtime.sendMessage({ type: "SYNC_GAME_STATE" });
  renderState(state);
}

function renderState(state: GameState) {
  if (!statusEl || !boardEl) return;

  if (state?.error) {
    statusEl.textContent = state.error;
    return;
  }

  if (!state?.gameId || !state.board) {
    statusEl.textContent = "No game started.";

    if (gameInfoEl) {
      gameInfoEl.innerHTML = "";
    }

    if (copyGameIdButton instanceof HTMLElement) {
      copyGameIdButton.style.display = "none";
    }

    if (gameModeSelect instanceof HTMLElement) {
      gameModeSelect.style.display = "inline-block";
    }

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

  statusEl.textContent = state.winner
    ? "BINGO! Game won."
    : `Game active: ${state.gameId}`;

  const statusText = state.winner
    ? `BINGO${state.winningLineType ? ` (${formatWinningLineType(state.winningLineType)})` : ""}`
    : "In progress";

  if (gameInfoEl) {
    gameInfoEl.innerHTML = `
      <p><strong>Mode:</strong> ${state.mode ?? "Unknown"}</p>
      <p><strong>Game State:</strong> ${state.status ?? "Unknown"}</p>
      <p><strong>Difficulty:</strong> ${state.boardConfig?.difficulty ?? "Unknown"}</p>
      <p><strong>Players:</strong> ${typeof state.playerCount === "number" ? state.playerCount : "Unknown"}</p>
      <p><strong>Player List:</strong> ${state.players?.map((player) => player.displayName).join(", ") ?? "Unknown"}</p>
      <p><strong>Status:</strong> ${statusText}</p>
      <p><strong>Game ID:</strong> <code>${state.gameId}</code></p>
      <p><strong>You:</strong> ${state.playerName ?? "Unknown"}</p>
    `;
  }

  if (copyGameIdButton instanceof HTMLElement) {
    copyGameIdButton.style.display = "inline-block";
  }

  if (gameModeSelect instanceof HTMLElement) {
    gameModeSelect.style.display = "none";
  }

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
  const winningPositions = new Set(state.winningLine ?? []);

  boardEl.innerHTML = "";

  const squares = [...state.board.squares].sort(
    (a, b) => a.position - b.position,
  );

  const claimsBySquareId = new Map(
    (state.squareClaims ?? []).map((claim) => [claim.squareId, claim]),
  );

  for (const square of squares) {
    const div = document.createElement("div");
    const classes = ["square"];

    if (completed.has(square.id)) {
      classes.push("completed");
    }

    if (winningPositions.has(square.position)) {
      classes.push("winning-square");
    }

    div.className = classes.join(" ");

    const claim = claimsBySquareId.get(square.id);

    const labelEl = document.createElement("div");
    labelEl.className = "square-label";
    labelEl.textContent = square.label;
    div.appendChild(labelEl);

    if (claim) {
      const claimEl = document.createElement("div");
      claimEl.className = "square-claim";
      claimEl.textContent = `Claimed by ${claim.playerName}`;
      div.appendChild(claimEl);
    }

    boardEl.appendChild(div);
  }
}

function formatWinningLineType(type: "ROW" | "COLUMN" | "DIAGONAL") {
  if (type === "ROW") return "row";
  if (type === "COLUMN") return "column";
  return "diagonal";
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "GAME_STATE_UPDATED") {
    void syncAndRenderState();
  }
});
