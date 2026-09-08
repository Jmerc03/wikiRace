import { parseGameInvitation, gameInvitationUrl, isLocalOnlyOrigin, type PlayerSummary, type TeamSummary } from "@bingo/shared";
import type { ExtensionState as GameState } from "./client-types.js";
import { normalizeApiOrigin } from "./wikipedia.js";

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
let latest: GameState | undefined;
let busy = false;

function nameValue() { return playerNameInput instanceof HTMLInputElement ? playerNameInput.value.trim() || undefined : undefined; }
function valueOf(element: HTMLElement | null) { return element instanceof HTMLInputElement || element instanceof HTMLSelectElement ? element.value.trim() : ""; }
function showError(error: unknown) { if (statusEl) { statusEl.textContent = error instanceof Error ? error.message : "Unable to contact the extension. Reload it and retry."; statusEl.classList.add("error-status"); } }
async function action(message: object) {
  if (busy) return;
  busy = true;
  document.body.setAttribute("aria-busy", "true");
  document.querySelectorAll<HTMLButtonElement>("button").forEach(button => { button.disabled = true; });
  try {
    const result = await chrome.runtime.sendMessage(message);
    if (!result) throw new Error("The extension did not respond. Reload it and retry.");
    latest = result;
  } catch (error) { showError(error); }
  finally {
    busy = false;
    document.body.removeAttribute("aria-busy");
    document.querySelectorAll<HTMLButtonElement>("button").forEach(button => { button.disabled = false; });
    if (latest) renderState(latest);
  }
}
startButton?.addEventListener("click", () => void action({type:"START_GAME",displayName:nameValue(),mode:valueOf(gameModeSelect),boardConfig:{difficulty:valueOf(difficultySelect),vitalArticleTileCount:15,genericTileCount:10,maxTilesPerTopic:3}}));
joinGameBtn?.addEventListener("click", async () => {
  if (busy || latest?.gameId || latest?.pendingAdmission) return;
  try {
    const invitation = parseGameInvitation(valueOf(joinGameInput), latest?.apiOrigin ?? "http://localhost:4000");
    const permitted = await chrome.permissions.request({origins:[`${invitation.apiOrigin}/*`]});
    if (!permitted) throw new Error("Server access was not granted. Your current server is unchanged.");
    await action({type:"JOIN_GAME", ...invitation, displayName:nameValue()});
  } catch (error) { showError(error); }
});
refreshButton?.addEventListener("click", () => void action({type:"SYNC_GAME_STATE"}));
endGameButton?.addEventListener("click", () => void action({type:"LEAVE_GAME"}));
document.getElementById("start-match")?.addEventListener("click", () => void action({type:"START_MATCH"}));
document.getElementById("host-end")?.addEventListener("click", () => void action({type:"END_MATCH"}));
document.getElementById("forget-game")?.addEventListener("click", () => void action({type:"FORGET_GAME"}));
createTeamBtn?.addEventListener("click", () => { const name=valueOf(teamNameInput); if(name) void action({type:"CREATE_TEAM",name}); else showError(new Error("Enter a team name.")); });
joinTeamBtn?.addEventListener("click", () => { const teamId=valueOf(teamSelect); if(teamId) void action({type:"JOIN_TEAM",teamId}); });
leaveTeamBtn?.addEventListener("click", () => void action({type:"LEAVE_TEAM"}));
copyGameIdButton?.addEventListener("click", () => {
  if (latest?.gameId) void navigator.clipboard.writeText(latest.gameId).then(() => {if(statusEl) statusEl.textContent="Game ID copied.";}).catch(showError);
});
document.getElementById("copy-invite")?.addEventListener("click", () => {
  if (!latest?.gameId) return;
  void navigator.clipboard.writeText(gameInvitationUrl(latest.apiOrigin, latest.gameId)).then(() => {
    if(statusEl) statusEl.textContent=isLocalOnlyOrigin(latest!.apiOrigin)?"Invitation copied. This server address works on this computer; other computers need the host’s network address.":"Invitation copied. Players can paste it into Join Game.";
  }).catch(showError);
});
document.getElementById("open-board")?.addEventListener("click", () => void chrome.tabs.create({url:chrome.runtime.getURL("popup.html?view=board")}));
document.getElementById("open-wikipedia")?.addEventListener("click", () => void chrome.tabs.create({url:"https://en.wikipedia.org/wiki/Special:Random"}));
document.getElementById("watch-game")?.addEventListener("click", () => { if(latest?.gameId) void chrome.tabs.create({url:`${latest.apiOrigin}/spectate/${latest.gameId}`}); });
document.getElementById("save-server")?.addEventListener("click", async () => {
  try {
    const apiOrigin=normalizeApiOrigin(valueOf(document.getElementById("api-origin")));
    const permitted=await chrome.permissions.request({origins:[`${apiOrigin}/*`]});
    if (!permitted) throw new Error("Server access was not granted.");
    await action({type:"SET_API_ORIGIN",apiOrigin});
  } catch(error) {showError(error);}
});
document.getElementById("retry-admission")?.addEventListener("click", () => void action({type:"RETRY_ADMISSION"}));
document.getElementById("forget-admission")?.addEventListener("click", () => {
  if (confirm("The server may already have created your player. Forget this pending entry and lose its recovery key?")) void action({type:"FORGET_ADMISSION"});
});
if (new URLSearchParams(location.search).get("view") === "board") document.body.classList.add("full-view");
chrome.runtime.onMessage.addListener(message => {
  if(message.type === "GAME_STATE_UPDATED") void chrome.runtime.sendMessage({type:"GET_GAME_STATE"}).then(result=>{latest=result; if(!busy) renderState(result);}).catch(showError);
});
void action({type:"SYNC_GAME_STATE"});

function renderState(state: GameState) {
  if (!statusEl || !boardEl) return;
  if (!state) { showError(new Error("No state was returned by the extension.")); return; }
  latest = state;
  const hasSession = Boolean(state.gameId);
  const pending = Boolean(state.pendingAdmission);
  const entryLocked = hasSession || pending;
  const isHost = state.hostPlayerId === state.playerId;
  const setHidden = (id: string, hidden: boolean) => { const el=document.getElementById(id); if(el) el.hidden=hidden; };
  setHidden("pending-entry", !pending);
  setHidden("start-match", !(hasSession && isHost && state.status === "WAITING"));
  setHidden("host-end", !(hasSession && isHost && state.status !== "FINISHED"));
  setHidden("forget-game", !(hasSession && (state.error || state.invalidSession)));
  setHidden("lobby-hint", state.status !== "WAITING");
  setHidden("setup-fields", hasSession);
  setHidden("join-section", hasSession);
  setHidden("team-controls", state.status !== "WAITING");
  setHidden("match-details", !hasSession);
  setHidden("watch-game", !hasSession);
  setHidden("copy-invite", !hasSession);
  const playerRoster=document.getElementById("player-roster");
  if(playerRoster) {
    playerRoster.replaceChildren();
    for(const player of state.players ?? []) {
      const chip=document.createElement("span");
      chip.className=`player-chip${player.id===state.playerId ? " you" : ""}${player.leftAt ? " departed" : ""}`;
      chip.textContent=`${player.displayName}${player.id===state.playerId ? " (you)" : ""}${player.isHost ? " · host" : ""}${player.leftAt ? " · left" : ""} · ${player.score ?? 0}`;
      playerRoster.appendChild(chip);
    }
  }
  const connectionEl = document.getElementById("connection");
  if (connectionEl) connectionEl.textContent = `${state.connection === "live" ? "Live updates connected" : state.connection === "reconnecting" ? "Reconnecting…" : state.connection === "connecting" ? "Connecting…" : "Offline"} · ${state.apiOrigin}`;
  const apiInput=document.getElementById("api-origin");
  if(apiInput instanceof HTMLInputElement) { if(document.activeElement!==apiInput) apiInput.value=state.apiOrigin; apiInput.disabled=entryLocked; }
  const saveServer=document.getElementById("save-server");
  if(saveServer instanceof HTMLButtonElement) saveServer.disabled=entryLocked;
  if(joinGameBtn instanceof HTMLButtonElement) joinGameBtn.disabled=entryLocked;
  if(joinGameInput instanceof HTMLInputElement) joinGameInput.disabled=entryLocked;
  if(playerNameInput instanceof HTMLInputElement) playerNameInput.disabled=entryLocked;
  if(startButton instanceof HTMLButtonElement) startButton.disabled=entryLocked;
  if(gameModeSelect instanceof HTMLSelectElement) gameModeSelect.disabled=entryLocked;
  if(difficultySelect instanceof HTMLSelectElement) difficultySelect.disabled=entryLocked;
  statusEl.classList.toggle("error-status", Boolean(state.error));

  if (!state?.gameId || !state.board) {
    statusEl.textContent = state.error ?? (hasSession ? "Restoring your game…" : "Create a lobby or join a game to begin.");
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
      startButton.style.display = hasSession ? "none" : "inline-block";
    if (endGameButton instanceof HTMLElement)
      endGameButton.style.display = hasSession ? "inline-block" : "none";
    if (refreshButton instanceof HTMLElement)
      refreshButton.style.display = hasSession ? "inline-block" : "none";

    boardEl.innerHTML = "";
    return;
  }

  const winnerMessage = getWinnerMessage(state);

  statusEl.textContent = state.error ?? (winnerMessage
    ? `${winnerMessage}.`
    : state.status === "WAITING" ? (isHost ? "Lobby ready. Start when everyone has joined." : "Waiting for the host to start.")
      : state.status === "FINISHED" ? (state.endReason === "BOARD_EXHAUSTED" ? "Draw! The board is full and no owner reached 13 squares." : "Match ended. Leave to create or join another game.")
      : "Match active — explore Wikipedia to complete your board.");
  statusEl.classList.toggle("winner-status", Boolean(winnerMessage));

  const statusText =
    state.mode === "LOCKOUT" && winnerMessage
      ? winnerMessage
      : state.winner
        ? `BINGO${state.winningLineType ? ` (${formatWinningLineType(state.winningLineType)})` : ""}`
        : state.status === "WAITING" ? "Waiting in lobby" : state.status === "FINISHED" ? (state.endReason === "BOARD_EXHAUSTED" ? "Draw — board exhausted" : state.endReason === "LEGACY_UNKNOWN" ? "Older match: winner not recorded" : "Ended without a winner") : "In progress";

  const currentPlayer = state.players?.find(
    (player) => player.id === state.playerId,
  );
  const currentTeam = state.teams?.find(
    (team) => team.id === currentPlayer?.teamId,
  );
  const gameFinished = state.status !== "WAITING";

  if (teamSection instanceof HTMLElement) {
    teamSection.hidden = state.mode !== "LOCKOUT" || (state.status !== "WAITING" && !state.teams?.length);
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
    const yourClaims = (state.squareClaims ?? []).filter(claim => currentPlayer?.teamId ? claim.teamId === currentPlayer.teamId : claim.playerId === state.playerId).length;
    progressEl.textContent = state.mode === "LOCKOUT"
      ? `${currentTeam ? "Your team" : "You"}: ${yourClaims}/13 to win · Board: ${completedCount}/${totalCount} claimed`
      : `Your progress: ${completedCount}/${totalCount} · Complete a row, column, or diagonal to win`;
  }

  const completed = new Set(state.completedSquareIds);
  const winningPositions = new Set(state.mode === "NORMAL" && state.winningOwner?.id === state.playerId ? state.winningLine ?? [] : []);

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

  return `${state.winningOwner?.name ?? "A player"} won by bingo`;
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
