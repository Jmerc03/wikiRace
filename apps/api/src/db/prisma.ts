import "../config/env.js";
import { PrismaClient } from "@prisma/client";
import { runtimeDatabaseUrl } from "./runtime-url.js";

export const prisma = new PrismaClient({ datasourceUrl: runtimeDatabaseUrl(process.env.DATABASE_URL) });
