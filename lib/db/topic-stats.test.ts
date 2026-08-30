import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/lib/generated/prisma/client";
import { RECENT_WINDOW } from "@/lib/selection/scoring";

import { createTempDatabase, type TempDatabase } from "./__testing__/temp-database";
import { loadTopicStats } from "./topic-stats";

/**
 * Gegen eine echte SQLite-Datei (D-19). Geprüft wird das Fenster der letzten
 * beantworteten Versuche — die Bewertung darauf ist rein und hat eigene Tests
 * in `lib/selection/scoring.test.ts`.
 */

const USER = "user-1";
const ANDERER = "user-2";
const TOPIC = "kombinatorik.permutation";

let database: TempDatabase;
let prisma: PrismaClient;
let sessionId: string;

async function seedUser(id: string): Promise<void> {
  await prisma.user.create({ data: { id, email: `${id}@localhost` } });
}

/**
 * Legt einen Attempt an. `isCorrect: null` heißt: noch offen, also unbeantwortet.
 * `answeredAt` wird künstlich gestaffelt, damit die Reihenfolge eindeutig ist.
 */
async function seedAttempt(options: {
  readonly userId?: string;
  readonly topic?: string;
  readonly isCorrect: boolean | null;
  readonly minutesAgo?: number;
  readonly status?: string;
}): Promise<void> {
  const answered = options.isCorrect !== null;
  const minutesAgo = options.minutesAgo ?? 0;

  await prisma.attempt.create({
    data: {
      practiceSessionId: sessionId,
      templateId: "aufg_00001",
      templateVersion: 1,
      seed: `seed-${Math.random()}`,
      params: {},
      questionText: "Frage",
      userId: options.userId ?? USER,
      topic: options.topic ?? TOPIC,
      difficulty: 1,
      expectedAnswer: "1",
      answerType: "integer",
      status: options.status ?? (answered ? "ANSWERED" : "OPEN"),
      isCorrect: options.isCorrect,
      answeredAt: answered ? new Date(Date.now() - minutesAgo * 60_000) : null,
    },
  });
}

beforeEach(async () => {
  database = createTempDatabase();
  prisma = database.prisma;

  await seedUser(USER);
  await seedUser(ANDERER);
  const session = await prisma.practiceSession.create({ data: { userId: USER } });
  sessionId = session.id;
});

afterEach(async () => {
  await database.destroy();
});

describe("loadTopicStats", () => {
  it("gibt eine leere Liste ohne Themen zurück", async () => {
    expect(await loadTopicStats(prisma, USER, [])).toEqual([]);
  });

  it("liefert für ein unberührtes Thema einen leeren Stand", async () => {
    const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);

    expect(stats).toEqual({
      topic: TOPIC,
      recentAnswered: 0,
      recentCorrect: 0,
      dueAt: null,
      lastSeenAt: null,
    });
  });

  it("behält die Reihenfolge der angefragten Themen", async () => {
    const topics = ["c", "a", "b"];
    const stats = await loadTopicStats(prisma, USER, topics);
    expect(stats.map((entry) => entry.topic)).toEqual(topics);
  });

  it("zählt richtige und falsche Antworten", async () => {
    await seedAttempt({ isCorrect: true, minutesAgo: 3 });
    await seedAttempt({ isCorrect: false, minutesAgo: 2 });
    await seedAttempt({ isCorrect: true, minutesAgo: 1 });

    const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
    expect(stats.recentAnswered).toBe(3);
    expect(stats.recentCorrect).toBe(2);
  });

  it("zählt offene Attempts nicht mit", async () => {
    await seedAttempt({ isCorrect: true, minutesAgo: 1 });
    await seedAttempt({ isCorrect: null });

    const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
    expect(stats.recentAnswered).toBe(1);
  });

  it("zählt übersprungene Attempts nicht mit", async () => {
    // SKIPPED trägt kein Urteil und darf die Quote nicht verwässern.
    await seedAttempt({ isCorrect: true, minutesAgo: 2 });
    await seedAttempt({ isCorrect: null, status: "SKIPPED" });

    const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
    expect(stats.recentAnswered).toBe(1);
    expect(stats.recentCorrect).toBe(1);
  });

  it("trennt die Themen", async () => {
    await seedAttempt({ topic: "a", isCorrect: true, minutesAgo: 1 });
    await seedAttempt({ topic: "b", isCorrect: false, minutesAgo: 1 });

    const [a, b] = await loadTopicStats(prisma, USER, ["a", "b"]);
    expect(a).toMatchObject({ recentAnswered: 1, recentCorrect: 1 });
    expect(b).toMatchObject({ recentAnswered: 1, recentCorrect: 0 });
  });

  it("trennt die Nutzer", async () => {
    await seedAttempt({ isCorrect: false, minutesAgo: 1 });
    await seedAttempt({ userId: ANDERER, isCorrect: true, minutesAgo: 1 });

    const [meine] = await loadTopicStats(prisma, USER, [TOPIC]);
    expect(meine).toMatchObject({ recentAnswered: 1, recentCorrect: 0 });

    const [fremde] = await loadTopicStats(prisma, ANDERER, [TOPIC]);
    expect(fremde).toMatchObject({ recentAnswered: 1, recentCorrect: 1 });
  });

  describe("Fenster der letzten Versuche", () => {
    it(`betrachtet höchstens ${RECENT_WINDOW} Versuche`, async () => {
      for (let i = 0; i < RECENT_WINDOW + 5; i++) {
        await seedAttempt({ isCorrect: true, minutesAgo: i });
      }

      const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
      expect(stats.recentAnswered).toBe(RECENT_WINDOW);
    });

    it("nimmt die jüngsten, nicht die ersten", async () => {
      // Zehn alte richtige, dann zehn neue falsche: Das Fenster muss die
      // falschen sehen, sonst wirkt eine Verschlechterung nie.
      for (let i = 0; i < RECENT_WINDOW; i++) {
        await seedAttempt({ isCorrect: true, minutesAgo: 100 + i });
      }
      for (let i = 0; i < RECENT_WINDOW; i++) {
        await seedAttempt({ isCorrect: false, minutesAgo: i });
      }

      const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
      expect(stats.recentAnswered).toBe(RECENT_WINDOW);
      expect(stats.recentCorrect).toBe(0);
    });
  });

  describe("Termine aus TopicMastery", () => {
    it("reicht dueAt und lastSeenAt durch", async () => {
      const dueAt = new Date("2026-09-05T00:00:00.000Z");
      const lastSeenAt = new Date("2026-09-01T00:00:00.000Z");

      await prisma.topicMastery.create({
        data: { userId: USER, topic: TOPIC, attempts: 4, correct: 3, dueAt, lastSeenAt },
      });

      const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
      expect(stats.dueAt).toEqual(dueAt);
      expect(stats.lastSeenAt).toEqual(lastSeenAt);
    });

    it("nimmt den Eintrag eines anderen Nutzers nicht", async () => {
      await prisma.topicMastery.create({
        data: { userId: ANDERER, topic: TOPIC, dueAt: new Date("2026-09-05T00:00:00.000Z") },
      });

      const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
      expect(stats.dueAt).toBeNull();
    });
  });
});
