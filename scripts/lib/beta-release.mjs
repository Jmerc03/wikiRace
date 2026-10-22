export function validateBetaOrigin(raw) {
  if (!raw) throw new Error("Set WIKIRACE_PUBLIC_ORIGIN to the deployed HTTPS origin first. No placeholder ZIP is released.");
  if (typeof raw !== "string" || /\s/.test(raw)) throw new Error("Use an HTTPS origin without whitespace");
  let url;
  try { url = new URL(raw); } catch { throw new Error("Use a valid public HTTPS origin"); }
  const hostname = url.hostname.replace(/\.$/, "");
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password ||
      /(^|\.)(example\.(com|org|net)|invalid|test|localhost|local|internal)$/.test(hostname) || /^[\d.]+$/.test(hostname) || hostname.startsWith("[")) {
    throw new Error("Use the real deployed HTTPS origin, without a path, IP address or placeholder hostname.");
  }
  return url.origin;
}

export async function checkHostedBeta(origin, fetcher = fetch) {
  const read = async path => {
    const response = await fetcher(`${origin}${path}`, { signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!response.ok) throw new Error(`Hosted beta check failed: ${path} returned ${response.status}`);
    return response;
  };
  if ((await (await read("/ready")).json()).status !== "ready") throw new Error("The deployed server is not ready");
  const deployment = await (await read("/deployment")).json();
  if (deployment.profile !== "beta" || deployment.publicOrigin !== origin || !deployment.scoredArticlesOnly || deployment.advertising !== false) throw new Error("The server must run the beta deployment profile at this origin");
  const policy = await (await read("/privacy")).text();
  if (!policy.includes("Operator:") || !policy.includes("mailto:")) throw new Error("Hosted privacy policy and operator contact must be available before release");
  const packaged = await (await read("/downloads/checksums.json")).json();
  if (packaged.profile !== "beta" || packaged.apiOrigin !== origin || !/^[a-f0-9]{64}$/.test(packaged.sha256)) throw new Error("The hosted extension must be built for this beta origin");
  return packaged;
}
