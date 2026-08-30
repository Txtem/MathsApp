import Database from "better-sqlite3";
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
  await prisma.user.create({ data: { id: "user-1", email: "test@localhost" } });
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
