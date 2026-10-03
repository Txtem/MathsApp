import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { classifyOutcome } from "@/lib/selection/outcome";

import { migrationNames, migrationSql } from "./__testing__/temp-database";

/**
 * Die Migration `versuche_und_tipps` gegen Zeilen aus dem alten Ablauf
 * (SPEC-M2f Abschnitt C). Die übrigen Datenbanktests sehen nur leere Tabellen;
 * ob der Bestand richtig übersetzt wird, zeigt nur ein Altbestand.
 *
 * Abnahme: Alte Attempts erscheinen als „Richtig (1. Versuch)" oder „Falsch".
 */

const MIGRATION = migrationNames().find((name) => name.endsWith("_versuche_und_tipps"));

let directory: string;
let db: Database.Database;

beforeEach(() => {
  if (!MIGRATION) throw new Error("Migration versuche_und_tipps fehlt.");

  directory = mkdtempSync(join(tmpdir(), "mathsapp-migration-"));
  db = new Database(join(directory, "test.db"));

  for (const name of migrationNames()) {
    if (name === MIGRATION) break;
    db.exec(migrationSql(name));
  }

  const now = "2026-09-10T12:00:00.000+00:00";
  db.prepare(`INSERT INTO "User" (id, email, createdAt) VALUES ('u', 'u@localhost', ?)`).run(now);
  db.prepare(
    `INSERT INTO "PracticeSession" (id, userId, startedAt) VALUES ('s', 'u', ?)`,
  ).run(now);

  const insert = db.prepare(`
    INSERT INTO "Attempt" (id, practiceSessionId, templateId, templateVersion, seed, params,
      questionText, userId, topic, difficulty, expectedAnswer, answerType, userAnswer,
      status, isCorrect, durationMs, createdAt, answeredAt)
    VALUES (?, 's', 'aufg_00003', 1, 'seed', '{"n":6}', 'Frage', 'u', 'kombinatorik.permutation',
      1, '"720"', 'integer', ?, ?, ?, ?, ?, ?)
  `);
  insert.run("richtig", "720", "ANSWERED", 1, 4000, now, now);
  insert.run("falsch", "42", "ANSWERED", 0, 4000, now, now);
  insert.run("offen", null, "OPEN", null, null, now, null);

  db.exec(migrationSql(MIGRATION));
});

afterEach(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

interface Row {
  readonly id: string;
  readonly status: "OPEN" | "ANSWERED" | "SKIPPED";
  readonly isCorrect: number | null;
  readonly tries: number;
  readonly hintsUsed: number;
  readonly firstAnswer: string | null;
  readonly firstDurationMs: number | null;
  readonly createdAt: string;
}

function row(id: string): Row {
  return db.prepare(`SELECT * FROM "Attempt" WHERE id = ?`).get(id) as Row;
}

describe("Migration versuche_und_tipps", () => {
  it("gibt beantworteten Attempts genau einen Versuch und keinen Tipp", () => {
    for (const id of ["richtig", "falsch"]) {
      expect(row(id)).toMatchObject({ tries: 1, hintsUsed: 0, firstAnswer: null });
    }
  });

  it("lässt offene Attempts bei null Versuchen", () => {
    expect(row("offen")).toMatchObject({ tries: 0, hintsUsed: 0, status: "OPEN" });
  });

  it("ordnet den Bestand als Richtig (1. Versuch) und Falsch ein", () => {
    const outcome = (id: string) => {
      const r = row(id);
      return classifyOutcome({
        status: r.status,
        isCorrect: r.isCorrect === null ? null : r.isCorrect === 1,
        tries: r.tries,
      });
    };

    expect(outcome("richtig")).toBe("right_first");
    expect(outcome("falsch")).toBe("wrong");
    expect(outcome("offen")).toBeNull();
  });

  it("übernimmt die Zeitstempel unverändert in die neu aufgebaute Tabelle", () => {
    // RedefineTables kopiert die Zeilen um; die Schreibweise muss die
    // kanonische bleiben, sonst sortiert SQLite falsch (D-20).
    expect(row("richtig").createdAt).toBe("2026-09-10T12:00:00.000+00:00");
  });
});
