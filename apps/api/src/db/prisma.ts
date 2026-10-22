import "../config/env.js";
import { PrismaClient } from "@prisma/client";
import { runtimeDatabaseUrl } from "./runtime-url.js";

export const prisma = new PrismaClient({ datasourceUrl: runtimeDatabaseUrl(process.env.DATABASE_URL, process.env.WIKIRACE_DEPLOYMENT === "beta" ? 5 : undefined) });
