const GAME_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeApiOrigin(value: string) {
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Enter an HTTP or HTTPS server address without a path, username, or password.");
  }
  return url.origin;
}

export function parseGameInvitation(value: string, currentOrigin: string) {
  const input = value.trim();
  if (GAME_ID.test(input)) return { gameId: input.toLowerCase(), apiOrigin: normalizeApiOrigin(currentOrigin) };
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Enter a complete game ID or a WikiRace invitation link."); }
  const path = /^\/(join|spectate)\/([^/]+)\/?$/.exec(url.pathname);
  const query = [...url.searchParams];
  const validSelection = path?.[1] === "spectate" && query.length === 1 && query[0][0] === "playerId" && GAME_ID.test(query[0][1]);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash || !path || !GAME_ID.test(path[2]) || (query.length > 0 && !validSelection)) {
    throw new Error("Use a WikiRace /join/ or /spectate/ link with a valid game ID and no private credentials.");
  }
  return { gameId: path[2].toLowerCase(), apiOrigin: url.origin };
}

export function gameInvitationUrl(apiOrigin: string, gameId: string) {
  if (!GAME_ID.test(gameId)) throw new Error("A valid game ID is required.");
  return `${normalizeApiOrigin(apiOrigin)}/join/${gameId.toLowerCase()}`;
}

export function isLocalOnlyOrigin(origin: string) {
  const hostname = new URL(origin).hostname;
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "[::1]" || hostname === "0.0.0.0" || /^127\./.test(hostname);
}
