import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/lib/generated/prisma/client";

import { createTempDatabase, type TempDatabase } from "./__testing__/temp-database";
import { loadAnsweredDurations, loadTopicTotals } from "./stats";

/** Gegen eine echte SQLite-Datei (D-19). Gerechnet wird in `components/stats-rows.ts`. */

const USER = "user-1";
const ANDERER = "user-2";
const TOPIC = "kombinatorik.permutation";
/** Die Uhr der Anfrage — in den Tests eine Konstante (D-20). */
const NOW = new Date("2026-08-30T12:00:00.000Z");

let database: TempDatabase;
let prisma: PrismaClient;
let sessionId: string;

async function seedAttempt(options: {
  readonly userId?: string;
  readonly status?: string;
  readonly durationMs?: number | null;
  readonly templateId?: string;
  readonly isCorrect?: boolean;
}): Promise<void> {
  await prisma.attempt.create({
    data: {
      practiceSessionId: sessionId,
      templateId: options.templateId ?? "aufg_00001",
      templateVersion: 1,
      seed: `seed-${Math.random()}`,
      params: {},
      questionText: "Frage",
      userId: options.userId ?? USER,
      topic: TOPIC,
      difficulty: 1,
      expectedAnswer: "1",
      answerType: "integer",
      status: options.status ?? "ANSWERED",
      durationMs: options.durationMs === undefined ? 5000 : options.durationMs,
      isCorrect: options.isCorrect ?? true,
      createdAt: NOW,
    },
  });
}

beforeEach(async () => {
  database = createTempDatabase();
  prisma = database.prisma;

  await prisma.user.create({ data: { id: USER, email: "test@localhost", createdAt: NOW } });
  await prisma.user.create({
    data: { id: ANDERER, email: "anderer@localhost", createdAt: NOW },
  });
  const session = await prisma.practiceSession.create({ data: { userId: USER, startedAt: NOW } });
  sessionId = session.id;
});

afterEach(async () => {
  await database.destroy();
});

describe("loadTopicTotals", () => {
  it("gibt eine leere Liste, solange nichts geübt wurde", async () => {
    expect(await loadTopicTotals(prisma, USER)).toEqual([]);
  });

  it("reicht die Gesamtzahlen und den Termin durch", async () => {
    const dueAt = new Date("2026-09-05T00:00:00.000Z");
    await prisma.topicMastery.create({
      data: { userId: USER, topic: TOPIC, attempts: 7, correct: 4, dueAt },
    });

    expect(await loadTopicTotals(prisma, USER)).toEqual([
      { topic: TOPIC, attempts: 7, correct: 4, dueAt },
    ]);
  });

  it("nimmt nur die Themen des angefragten Nutzers", async () => {
    await prisma.topicMastery.create({ data: { userId: USER, topic: "a", attempts: 1 } });
    await prisma.topicMastery.create({ data: { userId: ANDERER, topic: "b", attempts: 9 } });

    expect((await loadTopicTotals(prisma, USER)).map((entry) => entry.topic)).toEqual(["a"]);
  });
});

describe("loadAnsweredDurations", () => {
  it("gibt eine leere Liste ohne beantwortete Aufgaben", async () => {
    expect(await loadAnsweredDurations(prisma, USER)).toEqual([]);
  });

  it("liefert Template, Thema, Zeit und Urteil", async () => {
    await seedAttempt({ durationMs: 12_000, templateId: "aufg_00007" });

    expect(await loadAnsweredDurations(prisma, USER)).toEqual([
      { templateId: "aufg_00007", topic: TOPIC, durationMs: 12_000, isCorrect: true },
    ]);
  });

  it("liefert falsche Antworten mit — die Schnellschüsse brauchen sie", async () => {
    await seedAttempt({ durationMs: 800, isCorrect: false });

    expect(await loadAnsweredDurations(prisma, USER)).toEqual([
      { templateId: "aufg_00001", topic: TOPIC, durationMs: 800, isCorrect: false },
    ]);
  });

  it("lässt offene Aufgaben aus", async () => {
    await seedAttempt({ status: "OPEN", durationMs: null });
    await seedAttempt({ durationMs: 9000 });

    expect(await loadAnsweredDurations(prisma, USER)).toHaveLength(1);
  });

  it("lässt Aufgaben ohne gemessene Zeit aus", async () => {
    // Sonst zöge eine fehlende Zeit den Median nach unten.
    await seedAttempt({ durationMs: null });
    await seedAttempt({ durationMs: 9000 });

    expect(await loadAnsweredDurations(prisma, USER)).toEqual([
      { templateId: "aufg_00001", topic: TOPIC, durationMs: 9000, isCorrect: true },
    ]);
  });

  it("trennt die Nutzer", async () => {
    await seedAttempt({ durationMs: 1000 });
    await seedAttempt({ userId: ANDERER, durationMs: 2000 });

    expect(await loadAnsweredDurations(prisma, USER)).toEqual([
      { templateId: "aufg_00001", topic: TOPIC, durationMs: 1000, isCorrect: true },
    ]);
  });
});
