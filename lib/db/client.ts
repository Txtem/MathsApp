import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { z } from "zod";

import { PrismaClient } from "@/lib/generated/prisma/client";

// Zod an jeder Grenze — process.env ist eine davon.
const Env = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL fehlt (siehe .env)"),
});

// Prisma 7 spricht nicht mehr selbst mit der Datenbank, sondern über einen
// Driver Adapter. Für SQLite ist das better-sqlite3.
function createPrismaClient(): PrismaClient {
  const env = Env.parse(process.env);
  const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Im Dev-Modus lädt Next.js Module bei jeder Änderung neu. Ohne diesen Cache
// auf globalThis entstünde pro Reload ein neuer Client mit eigener Verbindung.
declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma: PrismaClient = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
