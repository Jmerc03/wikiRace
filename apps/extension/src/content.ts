function getPageData() {
  const title = document.querySelector("#firstHeading")?.textContent ?? "";
  const url = window.location.href;

  const categories = Array.from(
    document.querySelectorAll("#mw-normal-catlinks a"),
  ).map((el) => el.textContent ?? "");

  const links = Array.from(document.querySelectorAll("#bodyContent a"))
    .map((el) => el.getAttribute("href"))
    .filter((href): href is string => !!href);

  return { title, url, categories, links };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_DATA") {
    sendResponse(getPageData());
  }
});

chrome.runtime.sendMessage({
  type: "PAGE_VISIT",
  data: getPageData(),
});
