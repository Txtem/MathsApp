import Database from "better-sqlite3";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Eine Wegwerf-Datenbank für Tests: eigene Datei im Temp-Verzeichnis, nach dem
 * Lauf wieder weg. Nötig für alles, was nicht rein ist — Transaktionen,
 * Nebenläufigkeit, `@@unique`.
 *
 * Das Schema entsteht aus den **echten** Migrationen, nicht aus einer zweiten
 * Beschreibung. Eine vergessene Migration fällt damit im Test auf, statt erst
 * beim nächsten `migrate dev`. Siehe DECISIONS.md, D-19.
 */

const MIGRATIONS = join(import.meta.dirname, "..", "..", "..", "prisma", "migrations");

export interface TempDatabase {
  readonly prisma: PrismaClient;
  /** Pfad der Datei — für Tests, die an Prisma vorbei in die Datenbank sehen. */
  readonly file: string;
  /** Verbindung schließen und die Datei löschen. Gehört in `afterEach`. */
  readonly destroy: () => Promise<void>;
}

export function createTempDatabase(): TempDatabase {
  const directory = mkdtempSync(join(tmpdir(), "mathsapp-test-"));
  const file = join(directory, "test.db").replaceAll("\\", "/");

  const migrations = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    // Der Ordnername beginnt mit dem Zeitstempel, alphabetisch ist also
    // chronologisch.
    .sort();

  if (migrations.length === 0) {
    throw new Error(`Keine Migrationen unter ${MIGRATIONS} gefunden.`);
  }

  const database = new Database(file);
  try {
    for (const name of migrations) {
      database.exec(readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8"));
    }
  } finally {
    database.close();
  }

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });

  return {
    prisma,
    file,
    destroy: async () => {
      await prisma.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
