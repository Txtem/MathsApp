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
/** Die Uhr der Anfrage — in den Tests eine Konstante (D-20). */
const NOW = new Date("2026-08-30T12:00:00.000Z");

let database: TempDatabase;
let prisma: PrismaClient;
let sessionId: string;

async function seedUser(id: string): Promise<void> {
  await prisma.user.create({ data: { id, email: `${id}@localhost`, createdAt: NOW } });
}

/**
 * Legt einen Attempt an. `isCorrect: null` ohne `status` heißt: noch offen.
 * `answeredAt` wird künstlich gestaffelt, damit die Reihenfolge eindeutig ist;
 * jeder geschlossene Attempt hat eines, auch ein aufgegebener.
 */
async function seedAttempt(options: {
  readonly userId?: string;
  readonly topic?: string;
  readonly isCorrect: boolean | null;
  readonly minutesAgo?: number;
  readonly status?: string;
  readonly tries?: number;
  readonly hintsUsed?: number;
}): Promise<void> {
  const status = options.status ?? (options.isCorrect !== null ? "ANSWERED" : "OPEN");
  const closed = status !== "OPEN";
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
      status,
      isCorrect: options.isCorrect,
      tries: options.tries ?? (status === "ANSWERED" ? 1 : 0),
      hintsUsed: options.hintsUsed ?? 0,
      answeredAt: closed ? new Date(NOW.getTime() - minutesAgo * 60_000) : null,
      createdAt: NOW,
    },
  });
}

beforeEach(async () => {
  database = createTempDatabase();
  prisma = database.prisma;

  await seedUser(USER);
  await seedUser(ANDERER);
  const session = await prisma.practiceSession.create({ data: { userId: USER, startedAt: NOW } });
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
      recentClosed: 0,
      recentSuccess: 0,
      recentRight: 0,
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
    expect(stats.recentClosed).toBe(3);
    expect(stats.recentSuccess).toBe(2);
  });

  it("zählt offene Attempts nicht mit", async () => {
    await seedAttempt({ isCorrect: true, minutesAgo: 1 });
    await seedAttempt({ isCorrect: null });

    const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
    expect(stats.recentClosed).toBe(1);
  });

  it("zählt aufgegebene Attempts als Misserfolg mit", async () => {
    // SKIPPED heißt seit M2f „aufgegeben". Bliebe es draußen, wäre Aufgeben
    // ein Ausgang aus der Statistik, und das Thema gälte als gekonnt.
    await seedAttempt({ isCorrect: true, minutesAgo: 2 });
    await seedAttempt({ isCorrect: null, status: "SKIPPED", minutesAgo: 1 });

    const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
    expect(stats).toMatchObject({ recentClosed: 2, recentSuccess: 1, recentRight: 1 });
  });

  it("zählt richtig im zweiten Versuch als richtig, nicht als Erfolg", async () => {
    await seedAttempt({ isCorrect: true, tries: 2, minutesAgo: 2 });
    await seedAttempt({ isCorrect: true, tries: 1, minutesAgo: 1 });

    const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
    expect(stats).toMatchObject({ recentClosed: 2, recentSuccess: 1, recentRight: 2 });
  });

  it("zählt richtig mit Tipp als richtig, nicht als Erfolg", async () => {
    await seedAttempt({ isCorrect: true, hintsUsed: 2, minutesAgo: 1 });

    const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
    expect(stats).toMatchObject({ recentClosed: 1, recentSuccess: 0, recentRight: 1 });
  });

  it("zählt einen Attempt im zweiten Versuch, der noch offen ist, nicht mit", async () => {
    await seedAttempt({ isCorrect: null, tries: 1 });

    const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
    expect(stats.recentClosed).toBe(0);
  });

  it("trennt die Themen", async () => {
    await seedAttempt({ topic: "a", isCorrect: true, minutesAgo: 1 });
    await seedAttempt({ topic: "b", isCorrect: false, minutesAgo: 1 });

    const [a, b] = await loadTopicStats(prisma, USER, ["a", "b"]);
    expect(a).toMatchObject({ recentClosed: 1, recentSuccess: 1 });
    expect(b).toMatchObject({ recentClosed: 1, recentSuccess: 0 });
  });

  it("trennt die Nutzer", async () => {
    await seedAttempt({ isCorrect: false, minutesAgo: 1 });
    await seedAttempt({ userId: ANDERER, isCorrect: true, minutesAgo: 1 });

    const [meine] = await loadTopicStats(prisma, USER, [TOPIC]);
    expect(meine).toMatchObject({ recentClosed: 1, recentSuccess: 0 });

    const [fremde] = await loadTopicStats(prisma, ANDERER, [TOPIC]);
    expect(fremde).toMatchObject({ recentClosed: 1, recentSuccess: 1 });
  });

  describe("Fenster der letzten Versuche", () => {
    it(`betrachtet höchstens ${RECENT_WINDOW} Versuche`, async () => {
      for (let i = 0; i < RECENT_WINDOW + 5; i++) {
        await seedAttempt({ isCorrect: true, minutesAgo: i });
      }

      const [stats] = await loadTopicStats(prisma, USER, [TOPIC]);
      expect(stats.recentClosed).toBe(RECENT_WINDOW);
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
      expect(stats.recentClosed).toBe(RECENT_WINDOW);
      expect(stats.recentSuccess).toBe(0);
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
