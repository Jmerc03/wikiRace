/** Prisma v6 PostgreSQL runtime deadlines. Explicit operator values take precedence. */
export function runtimeDatabaseUrl(value: string | undefined, connectionLimit?: number) {
  let url: URL;
  try { url = new URL(value ?? ""); } catch { throw new Error("DATABASE_URL must be a PostgreSQL connection URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL must use PostgreSQL");
  for (const [name, fallback] of Object.entries({ connect_timeout: "3", pool_timeout: "5", socket_timeout: "5" })) {
    if (!url.searchParams.has(name)) url.searchParams.set(name, fallback);
    const selected = url.searchParams.get(name)!;
    if (!/^\d+$/.test(selected) || !Number.isSafeInteger(Number(selected))) throw new Error(`${name} must be a non-negative integer number of seconds`);
  }
  if (connectionLimit !== undefined && !url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", String(connectionLimit));
  return url.href;
}
