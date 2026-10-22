import { formatDuration, isArticleUrl, matchDuration, matchOutcome, matchStandings, type SquareEvidence } from "@bingo/shared";
import type { ExtensionState } from "./client-types.js";

const byId = (id: string) => document.getElementById(id)!;
const dialog = byId("article-dialog") as HTMLDialogElement;
let current: ExtensionState | undefined;
let selectedSquare: string | undefined;

function text(tag: string, value: string, className?: string) {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
}

function fillArticle(evidence: SquareEvidence) {
  const square = current?.board?.squares.find(s => s.id === evidence.squareId);
  byId("article-objective").textContent = square?.label ?? "Scored square";
  byId("article-scorer").textContent = `Earned by ${evidence.playerName}`;
  byId("article-time").textContent = new Date(evidence.earnedAt).toLocaleString();
  const target = byId("article-link");
  target.replaceChildren();
  if (evidence.url && isArticleUrl(evidence.url)) {
    const link = document.createElement("a");
    link.href = evidence.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = evidence.title;
    target.append(link);
  } else {
    target.append(text("span", evidence.title), text("p", "The original article link is unavailable.", "hint"));
  }
}

export function showArticle(squareId: string) {
  const evidence = current?.squareEvidence?.find(e => e.squareId === squareId);
  if (!evidence) return;
  selectedSquare = squareId;
  fillArticle(evidence);
  if (!dialog.open) dialog.showModal();
}

byId("close-article").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => { selectedSquare = undefined; });

export function renderMatchDetails(state: ExtensionState) {
  if (current?.gameId !== state.gameId && dialog.open) dialog.close();
  current = state;
  const finished = state.status === "FINISHED" && Boolean(state.board);
  byId("match-results").hidden = !finished;
  if (finished) {
    const resultState = { mode: state.mode ?? "NORMAL", players: state.players ?? [], teams: state.teams ?? [],
      squareClaims: state.squareClaims ?? [], winningOwner: state.winningOwner ?? null };
    byId("results-summary").textContent = matchOutcome({ ...resultState, endReason: state.endReason ?? null });
    byId("results-duration").textContent = state.startedAt || state.endReason === "LEGACY_UNKNOWN"
      ? `Match duration · ${formatDuration(matchDuration({ startedAt: state.startedAt ?? null, finishedAt: state.finishedAt ?? null }))}`
      : "Match did not start";
    byId("results-note").textContent = state.mode === "NORMAL"
      ? "First bingo wins. Other places are ordered by completed squares; equal scores share a place."
      : "13 squares wins. Team claims count together; equal scores share a place.";
    const list = byId("results-standings");
    list.replaceChildren();
    for (const entry of matchStandings(resultState)) {
      const row = text("li", "", `result-row${entry.isWinner ? " result-winner" : ""}`);
      row.append(text("span", String(entry.rank), "result-rank"), text("span", entry.name, "result-name"),
        text("span", `${entry.score} ${entry.score === 1 ? "square" : "squares"}${entry.isWinner ? " · Winner" : ""}`, "result-score"));
      list.append(row);
    }
  }
  byId("scored-articles").hidden = !state.board;
  const evidence = state.squareEvidence ?? [];
  byId("history-count").textContent = `Scored articles · ${evidence.length} ${evidence.length === 1 ? "square" : "squares"}`;
  byId("history-hint").textContent = evidence.length
    ? state.mode === "LOCKOUT" ? "The original article and player behind each claim." : "The original article behind each of your completed squares."
    : "Articles appear here when they earn a square.";
  const list = byId("history-list");
  list.replaceChildren();
  for (const item of evidence) {
    const square = state.board?.squares.find(s => s.id === item.squareId);
    const row = document.createElement("li");
    row.append(text("span", square?.label ?? "Scored square", "history-objective"));
    const button = text("button", item.title, "history-article") as HTMLButtonElement;
    button.type = "button";
    button.addEventListener("click", () => showArticle(item.squareId));
    row.append(button);
    list.append(row);
  }
  if (dialog.open && selectedSquare) {
    const selected = evidence.find(e => e.squareId === selectedSquare);
    if (selected) fillArticle(selected); else dialog.close();
  }
}
