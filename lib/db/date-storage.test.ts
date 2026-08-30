import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/lib/generated/prisma/client";

import { createTempDatabase, type TempDatabase } from "./__testing__/temp-database";

/**
 * Wie legt der better-sqlite3-Adapter `DateTime` ab, und kommt derselbe
 * Zeitpunkt zurück? SQLite kennt keinen Datumstyp; alles ist Text, und Text
 * wird zeichenweise verglichen. Diese Tests halten fest, was gemessen ist —
 * sie sind der Nachweis zu Abschnitt C-5 von SPEC-M2b.
 */

/** Ein Zeitpunkt mit Millisekunden, in der Nacht der Zeitumstellung. */
const WRITTEN = new Date("2026-03-29T00:30:00.123Z");

/** Die eine Schreibweise, die es nach D-20 noch geben darf. */
const KANONISCH = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}[+]00:00$/;

const MIGRATIONS = join(import.meta.dirname, "..", "..", "prisma", "migrations");

/** Alle Spalten, in denen ein Zeitstempel stehen kann. */
const ZEITSPALTEN = [
  ["User", "createdAt"],
  ["PracticeSession", "startedAt"],
  ["PracticeSession", "endedAt"],
  ["Attempt", "createdAt"],
  ["Attempt", "answeredAt"],
  ["TopicMastery", "lastSeenAt"],
  ["TopicMastery", "dueAt"],
] as const;

let database: TempDatabase;
let prisma: PrismaClient;

/** Ein Eintrag je Schreibweise, an Prisma vorbei direkt in die Datei. */
function insertRaw(rows: readonly (readonly [string, string])[]): void {
  const raw = new Database(database.file);
  try {
    const statement = raw.prepare(
      "insert into TopicMastery (id, userId, topic, attempts, correct, intervalDays, dueAt)" +
        " values (?, 'user-1', ?, 0, 0, 1, ?)",
    );
    for (const [id, value] of rows) statement.run(id, "t." + id, value);
  } finally {
    raw.close();
  }
}

async function dueAt(id: string): Promise<Date | null> {
  const row = await prisma.topicMastery.findUniqueOrThrow({ where: { id } });
  return row.dueAt;
}

beforeEach(async () => {
  database = createTempDatabase();
  prisma = database.prisma;
  await prisma.user.create({
    data: { id: "user-1", email: "test@localhost", createdAt: WRITTEN },
  });
});

afterEach(async () => {
  await database.destroy();
});

describe("DateTime in SQLite", () => {
  it("kommt millisekundengenau zurück", async () => {
    await prisma.topicMastery.create({
      data: { id: "m1", userId: "user-1", topic: "t.a", lastSeenAt: WRITTEN, dueAt: WRITTEN },
    });

    expect((await dueAt("m1"))?.getTime()).toBe(WRITTEN.getTime());
  });

  it("speichert als UTC-Text, nicht in Ortszeit", async () => {
    await prisma.topicMastery.create({
      data: { id: "m1", userId: "user-1", topic: "t.a", dueAt: WRITTEN },
    });

    const raw = new Database(database.file, { readonly: true });
    const row = raw.prepare("select dueAt, typeof(dueAt) as kind from TopicMastery").get() as {
      dueAt: string;
      kind: string;
    };
    raw.close();

    expect(row.kind).toBe("text");
    expect(row.dueAt).toBe("2026-03-29T00:30:00.123+00:00");
  });

  it("liest auch fremde Schreibweisen als UTC", async () => {
    // "Z" steht in Zeilen, die vor M2a geschrieben wurden; die Schreibweise
    // mit Leerzeichen erzeugt SQLite selbst über CURRENT_TIMESTAMP.
    insertRaw([
      ["z", "2026-03-29T00:30:00.123Z"],
      ["offset", "2026-03-29T00:30:00.123+00:00"],
      ["sqlite", "2026-03-29 00:30:00"],
    ]);

    expect((await dueAt("z"))?.toISOString()).toBe("2026-03-29T00:30:00.123Z");
    expect((await dueAt("offset"))?.toISOString()).toBe("2026-03-29T00:30:00.123Z");
    // Ortszeit gelesen wäre 2026-03-28T23:30:00Z gewesen — wird es nicht.
    expect((await dueAt("sqlite"))?.toISOString()).toBe("2026-03-29T00:30:00.000Z");
  });

  it("sortiert und filtert SQLite-eigene Zeitstempel falsch", async () => {
    // Der Grund, warum jeder Zeitstempel aus dem Anwendungscode kommen muss und
    // kein SQL-Default ihn setzen darf: Verglichen wird Text, und " " steht vor
    // "T". Betroffen wären `Attempt.createdAt` (Reihenfolge in der /next-Route)
    // und `Attempt.answeredAt` (die letzten zehn je Thema).
    insertRaw([
      ["spaet", "2026-03-29 12:00:00"],
      ["frueh", "2026-03-29T06:00:00.000+00:00"],
    ]);

    const sorted = await prisma.topicMastery.findMany({
      orderBy: { dueAt: "desc" },
      select: { id: true },
    });
    expect(sorted.map((row) => row.id)).toEqual(["frueh", "spaet"]);

    const after = await prisma.topicMastery.findMany({
      where: { dueAt: { gte: new Date("2026-03-29T10:00:00.000Z") } },
      select: { id: true },
    });
    expect(after).toEqual([]);
  });
});

/**
 * Die Konsequenz aus dem Test darüber: Zeitstempel kommen nur noch aus dem
 * Anwendungscode, `@default(now())` ist aus dem Schema verschwunden (D-20).
 */
describe("eine Schreibweise im ganzen Datenbestand", () => {
  /** Die UPDATE-Anweisungen aus der Migration, unverändert aus der Datei. */
  function normalisierung(): string {
    const marker = "-- Bestandsdaten normalisieren";

    for (const entry of readdirSync(MIGRATIONS, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sql = readFileSync(join(MIGRATIONS, entry.name, "migration.sql"), "utf8");
      if (sql.includes(marker)) return sql.slice(sql.indexOf(marker));
    }

    throw new Error(`Keine Migration mit "${marker}" gefunden.`);
  }

  /** Alle Zeitstempel, die gerade in der Datei stehen. */
  function alleZeitstempel(): string[] {
    const raw = new Database(database.file, { readonly: true });
    try {
      return ZEITSPALTEN.flatMap(([table, column]) =>
        raw
          .prepare(`select "${column}" as wert from "${table}" where "${column}" is not null`)
          .all()
          .map((row) => (row as { wert: string }).wert),
      );
    } finally {
      raw.close();
    }
  }

  it("kennt keinen SQL-Default mehr", () => {
    const raw = new Database(database.file, { readonly: true });
    const tabellen = raw
      .prepare("select name, sql from sqlite_master where type = 'table'")
      .all() as { name: string; sql: string | null }[];
    raw.close();

    // `_prisma_migrations` gehört Prisma und bleibt, wie sie ist.
    const mitDefault = tabellen
      .filter((tabelle) => tabelle.name !== "_prisma_migrations")
      .filter((tabelle) => tabelle.sql?.includes("CURRENT_TIMESTAMP"))
      .map((tabelle) => tabelle.name);

    expect(mitDefault).toEqual([]);
  });

  it("schreibt jeden Zeitstempel in derselben Form", async () => {
    const session = await prisma.practiceSession.create({
      data: { userId: "user-1", startedAt: WRITTEN, endedAt: WRITTEN },
    });

    await prisma.attempt.create({
      data: {
        practiceSessionId: session.id,
        templateId: "aufg_00001",
        templateVersion: 1,
        seed: "seed-1",
        params: {},
        questionText: "Frage",
        userId: "user-1",
        topic: "t.a",
        difficulty: 1,
        expectedAnswer: "1",
        answerType: "integer",
        status: "ANSWERED",
        createdAt: WRITTEN,
        answeredAt: WRITTEN,
      },
    });

    await prisma.topicMastery.create({
      data: { id: "m1", userId: "user-1", topic: "t.a", lastSeenAt: WRITTEN, dueAt: WRITTEN },
    });

    const werte = alleZeitstempel();
    expect(werte).toHaveLength(7);
    expect(werte.filter((wert) => !KANONISCH.test(wert))).toEqual([]);
  });

  it("bringt Altbestand mit der Migration auf dieselbe Form", () => {
    insertRaw([
      ["z", "2026-03-29T00:30:00.123Z"],
      ["sqlite", "2026-03-29 00:30:00"],
    ]);

    const raw = new Database(database.file);
    try {
      raw.exec(`update "User" set "createdAt" = '2026-03-28 22:15:00'`);
      expect(alleZeitstempel().filter((wert) => !KANONISCH.test(wert))).toHaveLength(3);

      raw.exec(normalisierung());
    } finally {
      raw.close();
    }

    expect(alleZeitstempel().filter((wert) => !KANONISCH.test(wert))).toEqual([]);
  });
});
