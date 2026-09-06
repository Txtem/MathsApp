/**
 * Setzt die Übungsdaten zurück: `npm run db:reset`.
 *
 * Geleert werden `Attempt`, `PracticeSession` und `TopicMastery` — also alles,
 * was die Auswahl steuert. **Nicht** angefasst werden Schema, Migrationen und
 * der Dev-User; die Datenbank bleibt einsatzbereit.
 *
 * Vorher entsteht immer eine Sicherung. Sie wird über `db.backup()` von SQLite
 * selbst geschrieben und nicht als Dateikopie: Das liefert auch dann einen
 * konsistenten Stand, wenn nebenher `npm run dev` läuft. Die Datei heißt
 * `dev-backup-<Zeitstempel>.db` und ist über `*.db` gitignored.
 *
 * Warum es das gibt: In `dev.db` sammeln sich Testdaten — beim Prüfen der
 * Auswahl-Logik wurde absichtlich falsch geantwortet, und `TopicMastery` merkt
 * sich das. Beim echten Üben stellt die App dann die falschen Themen.
 */
import "dotenv/config";

import { existsSync, statSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";

import { PrismaClient } from "../lib/generated/prisma/client";

/** `file:./dev.db` → absoluter Pfad. */
function databaseFile(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL fehlt — siehe .env (CLAUDE.md, Lokale Einrichtung).");

  const path = url.replace(/^file:/, "");
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

/** Zeitstempel ohne Doppelpunkte, damit der Dateiname unter Windows zulässig ist. */
function stempel(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
}

async function main(): Promise<void> {
  const file = databaseFile();
  if (!existsSync(file)) {
    throw new Error(`Keine Datenbank unter ${file}. Erst \`npx prisma migrate dev\` laufen lassen.`);
  }

  const backup = resolve(file, "..", `dev-backup-${stempel(new Date())}.db`);

  const quelle = new Database(file, { readonly: true });
  try {
    await quelle.backup(backup);
  } finally {
    quelle.close();
  }

  if (!existsSync(backup)) throw new Error(`Sicherung nach ${backup} ist fehlgeschlagen.`);
  console.log(`Sicherung: ${basename(backup)} (${statSync(backup).size} Bytes)`);

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
  try {
    // Reihenfolge wegen der Fremdschlüssel: Attempt hängt an PracticeSession
    // und User, TopicMastery nur an User. Der User bleibt.
    const attempts = await prisma.attempt.deleteMany();
    const sessions = await prisma.practiceSession.deleteMany();
    const masteries = await prisma.topicMastery.deleteMany();
    const users = await prisma.user.count();

    console.log(`Gelöscht: ${attempts.count} Attempts, ${sessions.count} Sitzungen, ${masteries.count} Themenstände.`);
    console.log(`Unberührt: ${users} User, Schema und Migrationen.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`FEHLER — ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
