export type BetaConfig = {
  publicOrigin: string;
  supportEmail: string;
  operatorName: string;
  trustProxyHops: number;
  maxGames: number;
  retentionDays: number;
};

export function betaConfig(env: NodeJS.ProcessEnv = process.env): BetaConfig | undefined {
  if (!env.WIKIRACE_DEPLOYMENT || env.WIKIRACE_DEPLOYMENT === "local") return undefined;
  if (env.WIKIRACE_DEPLOYMENT !== "beta") throw new Error("WIKIRACE_DEPLOYMENT must be local or beta");
  let origin: URL;
  try { origin = new URL(env.WIKIRACE_PUBLIC_ORIGIN ?? env.RENDER_EXTERNAL_URL ?? ""); }
  catch { throw new Error("Beta requires WIKIRACE_PUBLIC_ORIGIN or RENDER_EXTERNAL_URL"); }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw new Error("Beta public origin must be a public HTTPS origin without a path");
  const supportEmail = env.WIKIRACE_SUPPORT_EMAIL?.trim() ?? "";
  const operatorName = env.WIKIRACE_OPERATOR_NAME?.trim() ?? "";
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(supportEmail)) throw new Error("Beta requires WIKIRACE_SUPPORT_EMAIL");
  if (!operatorName || operatorName.length > 120) throw new Error("Beta requires WIKIRACE_OPERATOR_NAME (1–120 characters)");
  const hops = Number(env.WIKIRACE_TRUST_PROXY_HOPS ?? "0");
  if (!Number.isInteger(hops) || hops < 0 || hops > 3) throw new Error("WIKIRACE_TRUST_PROXY_HOPS must be 0–3");
  return { publicOrigin: origin.origin, supportEmail, operatorName, trustProxyHops: hops, maxGames: 200, retentionDays: 30 };
}
