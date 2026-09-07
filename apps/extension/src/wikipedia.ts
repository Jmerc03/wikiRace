export { isArticleUrl } from "@bingo/shared";
export function normalizeApiOrigin(value: string) {
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Enter an HTTP or HTTPS server address without a path, username, or password.");
  }
  return url.origin;
}
