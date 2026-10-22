import { DEFAULT_BOARD_CONFIG, boardConfigSummary, boardSetupIssue, type BoardGenerationConfig, type BoardSetupOptions } from "@bingo/shared";
import type { ExtensionState } from "./client-types.js";

export function createBoardSetup(refresh: () => void) {
  const articles = document.getElementById("article-count") as HTMLSelectElement;
  const topic = document.getElementById("topic-limit") as HTMLSelectElement;
  const difficulty = document.getElementById("difficulty") as HTMLSelectElement;
  const hint = document.getElementById("board-setup-hint")!;
  const error = document.getElementById("board-setup-error")!;
  const retry = document.getElementById("retry-board-options") as HTMLButtonElement;
  const reset = document.getElementById("reset-board-setup") as HTMLButtonElement;
  const start = document.getElementById("start") as HTMLButtonElement;
  let origin = "";
  let options: BoardSetupOptions | undefined;
  let loadError = "";
  let loading = false;
  let requestId = 0;
  for (let count = 0; count <= 25; count++) {
    const option = document.createElement("option");
    option.value = String(count); option.textContent = `${count} named / ${25 - count} flexible`;
    articles.append(option);
  }
  function defaults() {
    articles.value = String(DEFAULT_BOARD_CONFIG.vitalArticleTileCount);
    topic.value = String(DEFAULT_BOARD_CONFIG.maxTilesPerTopic);
    difficulty.value = DEFAULT_BOARD_CONFIG.difficulty;
  }
  defaults();
  const read = (): BoardGenerationConfig => ({
    difficulty: difficulty.value as BoardGenerationConfig["difficulty"],
    vitalArticleTileCount: Number(articles.value), genericTileCount: 25 - Number(articles.value), maxTilesPerTopic: Number(topic.value),
  });
  async function load() {
    const id = ++requestId; const expectedOrigin = origin;
    loading = true; loadError = ""; options = undefined;
    try {
      const result = await chrome.runtime.sendMessage({ type: "GET_BOARD_OPTIONS" });
      if (id !== requestId) return;
      if (result?.apiOrigin !== expectedOrigin) throw new Error("The selected server changed. Reload board options.");
      const capacities = result?.options?.articleCapacities;
      if (!["EASY", "MIXED", "HARD"].every(key => Array.isArray(capacities?.[key]) && capacities[key].length === 25 && capacities[key].every((n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 25)))
        throw new Error(result?.error || "The server returned invalid board options. Ask the host to update it, then reload options.");
      options = result.options;
    } catch (e) { if (id === requestId) loadError = e instanceof Error ? e.message : "Cannot load board options. Try again."; }
    finally { if (id === requestId) { loading = false; refresh(); } }
  }
  for (const control of [articles, topic, difficulty]) control.addEventListener("change", refresh);
  reset.addEventListener("click", () => { defaults(); refresh(); });
  retry.addEventListener("click", () => { void load(); refresh(); });
  return {
    read,
    valid: () => Boolean(options && !loading && !boardSetupIssue(read(), options)),
    render(state: ExtensionState, busy: boolean) {
      const locked = busy || Boolean(state.gameId || state.pendingAdmission);
      const pending = state.pendingAdmission?.boardConfig;
      if (pending) {
        articles.value = String(pending.vitalArticleTileCount); topic.value = String(pending.maxTilesPerTopic); difficulty.value = pending.difficulty;
      }
      if (!state.gameId && origin !== state.apiOrigin) { origin = state.apiOrigin; void load(); }
      const config = read();
      const issue = options ? boardSetupIssue(config, options) : loadError || "Loading board options…";
      articles.disabled = locked; topic.disabled = locked || config.vitalArticleTileCount === 0;
      difficulty.disabled = locked || config.vitalArticleTileCount === 0;
      reset.disabled = locked; retry.disabled = locked || loading; retry.hidden = !loadError;
      start.disabled = locked || Boolean(issue);
      hint.textContent = boardConfigSummary(config);
      error.hidden = !issue; error.textContent = issue;
      error.classList.toggle("error-status", Boolean(loadError || options && issue));
      articles.setAttribute("aria-invalid", String(Boolean(options && issue)));
    },
  };
}
