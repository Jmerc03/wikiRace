import type { FastifyInstance } from "fastify";
import type { BetaConfig } from "../config/beta.js";

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export async function privacyRoutes(app: FastifyInstance, { beta }: { beta?: BetaConfig }) {
  const home = beta?.hostingProvider === "home-cloudflare";
  const hosting = home
    ? 'The operator runs the API and PostgreSQL database on a personally managed computer. Cloudflare routes HTTPS traffic to that computer through a tunnel and processes traffic and network metadata. See <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare’s privacy policy</a>.'
    : 'Render processes game data to host the API and database. See <a href="https://render.com/privacy">Render’s privacy policy</a>.';
  app.get("/deployment", async () => ({
    profile: beta ? "beta" : "local", publicOrigin: beta?.publicOrigin ?? null,
    retentionDays: beta?.retentionDays ?? null, maxSavedGames: beta?.maxGames ?? null,
    scoredArticlesOnly: Boolean(beta), advertising: false, hostingProvider: beta ? (beta.hostingProvider ?? "render") : null,
  }));
  app.get("/privacy", async (_request, reply) => {
    const contact = beta ? `<p>Operator: ${escape(beta.operatorName)}. Contact: <a href="mailto:${escape(beta.supportEmail)}">${escape(beta.supportEmail)}</a>.</p>`
      : "<p>This is a locally operated server. Ask its operator about retention, backups and access. The hosted beta policy below does not describe a custom local server.</p>";
    return reply.type("text/html; charset=utf-8").header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
      .send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WikiRace privacy</title>
<style>body{font:18px/1.6 system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 24px;color:#172b3a}h1,h2{line-height:1.2}a{color:#086c64}</style>
<h1>WikiRace privacy</h1><p>Updated October 22, 2026 · Ad-free beta</p>${contact}
<h2>What the extension sends</h2><p>While you are in an active match, the extension sends eligible English Wikipedia article URLs, titles, category labels and outgoing links to the selected game server to evaluate your bingo board. It does not send your general browser history or page visits outside an active match. Wikipedia receives your normal article requests directly.</p>
<h2>What the hosted beta keeps</h2><p>We keep your chosen player name and color, teams, board, match status, scores, and the title, URL and time of articles that earn a square. Category and outgoing-link payloads are discarded after scoring; unscored visits are not saved in the beta database. Private session tokens stay in your browser; the server stores their hashes. Connection indicators are temporary and are not saved as an activity history.</p>
<h2>Who can see it</h2><p>Anyone who knows a game link or ID can view its roster, results and scored articles, including a selected player's Normal progress. Choose a nickname and share links only with intended viewers. Private session tokens are not shown to other players.</p>
<h2>Retention and deletion</h2><p>Hosted beta results and related player data are eligible for deletion 30 days after a match finishes, normally on the next hourly cleanup while the server is running. Unfinished games remain until ended; the host can end a match, and the last player leaving also ends it. Contact the operator for an earlier deletion request, identifying the game without sending your private token. ${home ? "Operator-managed backups may retain deleted data until the operator removes those copies; ask the operator to confirm backup deletion as well." : "Backups can retain deleted data until the hosting provider's backup window expires."} Removing the extension clears its local access but does not itself delete server records.</p>
<h2>Hosting and security</h2><p>${hosting} Network addresses are processed for abuse prevention; infrastructure providers may retain operational logs under their own policies. We do not log article request bodies or private tokens in application access logs. Transport to the hosted beta uses HTTPS.</p>
<h2>No advertising or sale of data</h2><p>WikiRace contains no advertising or third-party analytics SDK. We do not sell user data or use it for personalized advertising. Collection and use are limited to the disclosed game functionality and its operation, security and reliability, consistent with the Chrome Web Store User Data Policy, including its Limited Use requirements.</p>
<p>WikiRace is an independent project and is not affiliated with Wikipedia or the Wikimedia Foundation.</p><p><a href="/">Return to WikiRace</a></p></html>`);
  });
}
