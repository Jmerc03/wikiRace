export function isArticleUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.origin !== "https://en.wikipedia.org" || url.username || url.password || !url.pathname.startsWith("/wiki/")) return false;
    const title = decodeURIComponent(url.pathname.slice(6)).replaceAll("_", " ");
    return title.trim().length > 0 && title !== "Main Page" && !/^(?:Special|Talk|User(?: talk)?|Wikipedia(?: talk)?|File(?: talk)?|Media|MediaWiki(?: talk)?|Template(?: talk)?|Help(?: talk)?|Category(?: talk)?|Portal(?: talk)?|Draft(?: talk)?|Module(?: talk)?|TimedText|Book):/i.test(title);
  } catch { return false; }
}
