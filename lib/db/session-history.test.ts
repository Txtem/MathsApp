import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/lib/generated/prisma/client";

import { createTempDatabase, type TempDatabase } from "./__testing__/temp-database";
import { loadSessionHistory } from "./session-history";

/**
 * Gegen eine echte SQLite-Datei (D-19). Geprüft wird die Reihenfolge, die
 * Abgrenzung zwischen Sitzungen — und dass die Abfrage schmal bleibt.
 */

const USER = "user-1";
const NOW = new Date("2026-08-30T12:00:00.000Z");

let database: TempDatabase;
let prisma: PrismaClient;
let sessionId: string;
let andereSessionId: string;

/** Legt einen Attempt an. `minutenSpaeter` staffelt die Reihenfolge. */
async function seedAttempt(options: {
  readonly templateId: string;
  readonly questionText: string;
  readonly minutenSpaeter: number;
  readonly practiceSessionId?: string;
}): Promise<void> {
  await prisma.attempt.create({
    data: {
      practiceSessionId: options.practiceSessionId ?? sessionId,
      templateId: options.templateId,
      templateVersion: 1,
      seed: `seed-${options.questionText}`,
      params: {},
      questionText: options.questionText,
      userId: USER,
      topic: "kombinatorik.permutation",
      difficulty: 1,
      expectedAnswer: "720",
      answerType: "integer",
      status: "OPEN",
      createdAt: new Date(NOW.getTime() + options.minutenSpaeter * 60_000),
    },
  });
}

beforeEach(async () => {
  database = createTempDatabase();
  prisma = database.prisma;

  await prisma.user.create({ data: { id: USER, email: "test@localhost", createdAt: NOW } });
  const session = await prisma.practiceSession.create({ data: { userId: USER, startedAt: NOW } });
  const andere = await prisma.practiceSession.create({ data: { userId: USER, startedAt: NOW } });
  sessionId = session.id;
  andereSessionId = andere.id;
});

afterEach(async () => {
  await database.destroy();
});

describe("loadSessionHistory", () => {
  it("gibt für eine leere Sitzung zwei leere Listen", async () => {
    expect(await loadSessionHistory(prisma, sessionId)).toEqual({
      recentTemplateIds: [],
      askedQuestionTexts: [],
    });
  });

  it("liefert die Template-IDs mit der jüngsten zuerst", async () => {
    await seedAttempt({ templateId: "t1", questionText: "erste", minutenSpaeter: 0 });
    await seedAttempt({ templateId: "t2", questionText: "zweite", minutenSpaeter: 1 });
    await seedAttempt({ templateId: "t3", questionText: "dritte", minutenSpaeter: 2 });

    const history = await loadSessionHistory(prisma, sessionId);

    expect(history.recentTemplateIds).toEqual(["t3", "t2", "t1"]);
    expect(history.askedQuestionTexts).toEqual(["dritte", "zweite", "erste"]);
  });

  it("behält Wiederholungen — die Abwertung zählt die jüngste Verwendung", async () => {
    await seedAttempt({ templateId: "t1", questionText: "a", minutenSpaeter: 0 });
    await seedAttempt({ templateId: "t1", questionText: "b", minutenSpaeter: 1 });

    expect((await loadSessionHistory(prisma, sessionId)).recentTemplateIds).toEqual(["t1", "t1"]);
  });

  it("kennt nur die eigene Sitzung", async () => {
    await seedAttempt({ templateId: "t1", questionText: "eigene", minutenSpaeter: 0 });
    await seedAttempt({
      templateId: "t2",
      questionText: "fremde",
      minutenSpaeter: 1,
      practiceSessionId: andereSessionId,
    });

    const history = await loadSessionHistory(prisma, sessionId);

    expect(history.askedQuestionTexts).toEqual(["eigene"]);
    expect(history.recentTemplateIds).toEqual(["t1"]);
  });

  it("holt keine Spalte, die sie nicht braucht", async () => {
    // Invariante 2 im Code fortgesetzt (D-25): `expectedAnswer` wird in einem
    // Auswahlpfad nicht geladen. Was nie geladen wird, kann nicht hinausgehen.
    let übergeben: { select?: unknown } | undefined;
    const attrappe = {
      attempt: {
        findMany: (args: { select?: unknown }) => {
          übergeben = args;
          return Promise.resolve([]);
        },
      },
    } as unknown as PrismaClient;

    await loadSessionHistory(attrappe, sessionId);

    expect(übergeben?.select).toEqual({ templateId: true, questionText: true });
  });
});
