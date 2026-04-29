document.getElementById("start")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "START_GAME" });
});
