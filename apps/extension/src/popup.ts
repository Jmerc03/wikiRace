type BoardSquare = {
  id: string;
  position: number;
  label: string;
};

type PlayerSummary = {
  id: string;
  displayName: string;
  color?: string | null;
  teamId?: string | null;
};

type TeamSummary = {
  id: string;
  name: string;
  color: string;
  players?: {
    id: string;
    displayName: string;
    color?: string | null;
  }[];
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
  teams?: TeamSummary[];
  winner?: boolean;
  winningOwner?: WinningOwner | null;
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

type WinningOwner = {
  ownerKey: string;
  type: "TEAM" | "PLAYER";
  id: string;
  name: string;
  color?: string | null;
};

type SquareClaim = {
  squareId: string;
  playerId: string;
  playerName: string;
  playerColor?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
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

const teamNameInput = document.getElementById("team-name");
const createTeamBtn = document.getElementById("create-team-btn");
const teamSelect = document.getElementById("team-select");
const joinTeamBtn = document.getElementById("join-team-btn");
const leaveTeamBtn = document.getElementById("leave-team-btn");
const teamSection = document.getElementById("team-section");
const currentTeamEl = document.getElementById("current-team");
const teamRostersEl = document.getElementById("team-rosters");

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

createTeamBtn?.addEventListener("click", async () => {
  if (!(teamNameInput instanceof HTMLInputElement)) return;

  const name = teamNameInput.value.trim();
  if (!name) return;

  const state = await chrome.runtime.sendMessage({
    type: "CREATE_TEAM",
    name,
  });

  renderState(state);
});

joinTeamBtn?.addEventListener("click", async () => {
  if (!(teamSelect instanceof HTMLSelectElement)) return;

  const teamId = teamSelect.value;
  if (!teamId) return;

  const state = await chrome.runtime.sendMessage({
    type: "JOIN_TEAM",
    teamId,
  });

  renderState(state);
});

leaveTeamBtn?.addEventListener("click", async () => {
  const state = await chrome.runtime.sendMessage({
    type: "LEAVE_TEAM",
  });

  renderState(state);
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
    statusEl.classList.remove("winner-status");

    if (gameInfoEl) {
      gameInfoEl.replaceChildren();
    }

    if (currentTeamEl) {
      currentTeamEl.replaceChildren();
    }

    if (teamRostersEl) {
      teamRostersEl.replaceChildren();
    }

    if (teamSection instanceof HTMLElement) {
      teamSection.hidden = true;
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

  const winnerMessage = getWinnerMessage(state);

  statusEl.textContent = winnerMessage
    ? `${winnerMessage}.`
    : `Game active: ${state.gameId}`;
  statusEl.classList.toggle("winner-status", Boolean(winnerMessage));

  const statusText =
    state.mode === "LOCKOUT" && winnerMessage
      ? winnerMessage
      : state.winner
        ? `BINGO${state.winningLineType ? ` (${formatWinningLineType(state.winningLineType)})` : ""}`
        : "In progress";

  const currentPlayer = state.players?.find(
    (player) => player.id === state.playerId,
  );
  const currentTeam = state.teams?.find(
    (team) => team.id === currentPlayer?.teamId,
  );
  const gameFinished = state.status === "FINISHED";

  if (teamSection instanceof HTMLElement) {
    teamSection.hidden = false;
  }

  if (teamSelect instanceof HTMLSelectElement) {
    teamSelect.replaceChildren();

    const availableTeams = (state.teams ?? []).filter(
      (team) => team.id !== currentTeam?.id,
    );

    for (const team of availableTeams) {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = team.name;
      teamSelect.appendChild(option);
    }

    if (availableTeams.length === 0) {
      const option = document.createElement("option");
      option.textContent = "No other teams";
      option.value = "";
      teamSelect.appendChild(option);
    }

    teamSelect.disabled = availableTeams.length === 0 || gameFinished;
  }

  if (createTeamBtn instanceof HTMLButtonElement) {
    createTeamBtn.disabled = gameFinished;
  }

  if (teamNameInput instanceof HTMLInputElement) {
    teamNameInput.disabled = gameFinished;
  }

  if (joinTeamBtn instanceof HTMLButtonElement) {
    joinTeamBtn.disabled =
      gameFinished ||
      !(teamSelect instanceof HTMLSelectElement) ||
      !teamSelect.value;
  }

  if (leaveTeamBtn instanceof HTMLButtonElement) {
    leaveTeamBtn.hidden = !currentTeam;
    leaveTeamBtn.disabled = gameFinished;
  }

  renderCurrentTeam(currentTeam, currentPlayer);
  renderTeamRosters(state.teams ?? [], currentTeam?.id, state.playerId);
  renderGameInfo(state, statusText);

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
      const claimColor = claim.teamColor ?? claim.playerColor;
      const claimOwnerName = claim.teamName ?? claim.playerName;

      if (claimColor) {
        div.style.background = claimColor;
        div.style.borderColor = claimColor;
        div.style.color = "#111";
      }

      const claimEl = document.createElement("div");
      claimEl.className = "square-claim";
      claimEl.textContent = `Claimed by ${claimOwnerName}`;
      div.appendChild(claimEl);
    }

    boardEl.appendChild(div);
  }
}

function getWinnerMessage(state: GameState) {
  if (!state.winner) {
    return null;
  }

  if (state.mode === "LOCKOUT" && state.winningOwner) {
    if (state.winningOwner.type === "TEAM") {
      const teamName = /^team\b/i.test(state.winningOwner.name)
        ? state.winningOwner.name
        : `Team ${state.winningOwner.name}`;
      return `${teamName} won by majority`;
    }

    return `${state.winningOwner.name} won by majority`;
  }

  return "BINGO! Game won";
}

function renderCurrentTeam(
  currentTeam: TeamSummary | undefined,
  currentPlayer: PlayerSummary | undefined,
) {
  if (!currentTeamEl) return;

  currentTeamEl.replaceChildren();

  const label = document.createElement("span");
  label.className = "current-team-label";
  label.textContent = "Your team";

  const value = document.createElement("strong");
  value.textContent = currentTeam?.name ?? "Not on a team";

  const swatch = document.createElement("span");
  swatch.className = "color-swatch";
  swatch.style.background = currentTeam?.color ?? currentPlayer?.color ?? "#ced4da";

  currentTeamEl.append(swatch, label, value);
  currentTeamEl.classList.toggle("has-team", Boolean(currentTeam));

  if (currentTeam) {
    currentTeamEl.style.borderColor = currentTeam.color;
  } else {
    currentTeamEl.style.removeProperty("border-color");
  }
}

function renderTeamRosters(
  teams: TeamSummary[],
  currentTeamId: string | undefined,
  currentPlayerId: string | null | undefined,
) {
  if (!teamRostersEl) return;

  teamRostersEl.replaceChildren();

  if (teams.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No teams yet.";
    teamRostersEl.appendChild(empty);
    return;
  }

  for (const team of teams) {
    const card = document.createElement("div");
    card.className = "team-card";
    card.style.borderLeftColor = team.color;

    const header = document.createElement("div");
    header.className = "team-card-header";

    const swatch = document.createElement("span");
    swatch.className = "color-swatch";
    swatch.style.background = team.color;

    const title = document.createElement("strong");
    title.textContent = team.name;

    header.append(swatch, title);

    if (team.id === currentTeamId) {
      const badge = document.createElement("span");
      badge.className = "current-team-badge";
      badge.textContent = "Your team";
      header.appendChild(badge);
    }

    const members = document.createElement("div");
    members.className = "team-members";

    if (!team.players?.length) {
      members.textContent = "No players yet";
    } else {
      for (const player of team.players) {
        const member = document.createElement("span");
        member.className = "team-member";
        member.textContent =
          player.id === currentPlayerId
            ? `${player.displayName} (you)`
            : player.displayName;
        members.appendChild(member);
      }
    }

    card.append(header, members);
    teamRostersEl.appendChild(card);
  }
}

function renderGameInfo(state: GameState, statusText: string) {
  if (!gameInfoEl) return;

  gameInfoEl.replaceChildren();

  appendInfoRow(gameInfoEl, "Mode", state.mode ?? "Unknown");
  appendInfoRow(gameInfoEl, "Game state", state.status ?? "Unknown");
  appendInfoRow(
    gameInfoEl,
    "Difficulty",
    state.boardConfig?.difficulty ?? "Unknown",
  );
  appendInfoRow(
    gameInfoEl,
    "Players",
    typeof state.playerCount === "number"
      ? String(state.playerCount)
      : "Unknown",
  );
  appendInfoRow(gameInfoEl, "Status", statusText);
  appendInfoRow(gameInfoEl, "You", state.playerName ?? "Unknown");
  appendInfoRow(gameInfoEl, "Game ID", state.gameId ?? "Unknown", true);
}

function appendInfoRow(
  container: HTMLElement,
  labelText: string,
  valueText: string,
  code = false,
) {
  const label = document.createElement("span");
  label.className = "info-label";
  label.textContent = labelText;

  const value = document.createElement(code ? "code" : "span");
  value.className = "info-value";
  value.textContent = valueText;

  container.append(label, value);
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
