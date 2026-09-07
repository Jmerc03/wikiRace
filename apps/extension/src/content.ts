import { isArticleUrl } from "./wikipedia.js";

function getPageData() {
  if (!isArticleUrl(location.href)) return null;
  const title = document.querySelector("#firstHeading")?.textContent?.trim();
  if (!title) return null;
  const categories = Array.from(document.querySelectorAll("#mw-normal-catlinks li a"))
    .map(el => el.textContent?.trim() ?? "").filter(Boolean).slice(0,500);
  const links = Array.from(document.querySelectorAll("#mw-content-text a[href]"))
    .map(el => el.getAttribute("href") ?? "").filter(href => href.length > 0 && href.length <= 2048).slice(0,5000);
  return { title, url: location.href, categories, links };
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_DATA") sendResponse(getPageData());
});
const data = getPageData();
if (data) void chrome.runtime.sendMessage({ type: "PAGE_VISIT", data }).catch(() => { /* Extension was reloaded during navigation. */ });
