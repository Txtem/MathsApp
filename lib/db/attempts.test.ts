import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/lib/generated/prisma/client";

import { createTempDatabase, type TempDatabase } from "./__testing__/temp-database";
import { closeAttempt, recordFirstMiss } from "./attempts";

/**
 * Diese Tests laufen gegen eine echte SQLite-Datei (D-19). Was hier geprüft
 * wird, ist genau das, was eine reine Funktion nicht hergibt: dass die
 * Transaktion hält und doppeltes Absenden nur einmal zählt.
 */

const NOW = new Date("2026-08-30T12:00:00.000Z");
const TOPIC = "kombinatorik.permutation";

let database: TempDatabase;
let prisma: PrismaClient;

/** Legt User, PracticeSession und einen offenen Attempt an. */
async function seedOpenAttempt(topic = TOPIC): Promise<string> {
  const user = await prisma.user.upsert({
    where: { id: "user-1" },
    update: {},
    create: { id: "user-1", email: "test@localhost", createdAt: NOW },
  });

  const session = await prisma.practiceSession.create({
    data: { userId: user.id, topicFilter: null, startedAt: NOW },
  });

  const attempt = await prisma.attempt.create({
    data: {
      practiceSessionId: session.id,
      templateId: "aufg_00001",
      templateVersion: 1,
      seed: "seed-1",
      params: { n: 6 },
      questionText: "Auf wie viele Arten?",
      userId: user.id,
      topic,
      difficulty: 1,
      expectedAnswer: "720",
      answerType: "integer",
      status: "OPEN",
      createdAt: NOW,
    },
  });

  return attempt.id;
}

function mastery(topic = TOPIC) {
  return prisma.topicMastery.findUnique({
    where: { userId_topic: { userId: "user-1", topic } },
  });
}

beforeEach(() => {
  database = createTempDatabase();
  prisma = database.prisma;
});

afterEach(async () => {
  await database.destroy();
});

describe("closeAttempt", () => {
  it("schließt den Attempt und schreibt das Urteil weg", async () => {
    const id = await seedOpenAttempt();

    const closed = await closeAttempt(prisma, {
      attemptId: id,
      userAnswer: "720",
      isCorrect: true,
      durationMs: 9100,
      previousTries: 0,
      now: NOW,
    });

    expect(closed).toBe(true);

    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id } });
    expect(attempt.status).toBe("ANSWERED");
    expect(attempt.userAnswer).toBe("720");
    expect(attempt.isCorrect).toBe(true);
    expect(attempt.durationMs).toBe(9100);
    expect(attempt.answeredAt).toEqual(NOW);
  });

  it("legt TopicMastery an, wenn es das Thema noch nicht gab", async () => {
    const id = await seedOpenAttempt();
    expect(await mastery()).toBeNull();

    await closeAttempt(prisma, {
      attemptId: id,
      userAnswer: "720",
      isCorrect: true,
      durationMs: 1000,
      previousTries: 0,
      now: NOW,
    });

    const entry = await mastery();
    expect(entry).toMatchObject({ topic: TOPIC, attempts: 1, correct: 1, intervalDays: 2 });
    expect(entry?.lastSeenAt).toEqual(NOW);
  });

  it("nimmt Topic und Nutzer vom Attempt, nicht aus dem Aufruf", async () => {
    const id = await seedOpenAttempt("wahrscheinlichkeit.hypergeometrisch");

    await closeAttempt(prisma, {
      attemptId: id,
      userAnswer: "1/2",
      isCorrect: true,
      durationMs: 1000,
      previousTries: 0,
      now: NOW,
    });

    expect(await mastery("wahrscheinlichkeit.hypergeometrisch")).not.toBeNull();
    expect(await mastery(TOPIC)).toBeNull();
  });

  it("zählt eine falsche Antwort mit und setzt das Intervall zurück", async () => {
    const first = await seedOpenAttempt();
    await closeAttempt(prisma, {
      attemptId: first,
      userAnswer: "720",
      isCorrect: true,
      durationMs: 1000,
      previousTries: 0,
      now: NOW,
    });
    expect(await mastery()).toMatchObject({ attempts: 1, correct: 1, intervalDays: 2 });

    const second = await seedOpenAttempt();
    await closeAttempt(prisma, {
      attemptId: second,
      userAnswer: "42",
      isCorrect: false,
      durationMs: 1000,
      previousTries: 0,
      now: NOW,
    });

    expect(await mastery()).toMatchObject({ attempts: 2, correct: 1, intervalDays: 1 });
  });

  describe("doppeltes Absenden", () => {
    it("zählt genau einmal", async () => {
      const id = await seedOpenAttempt();
      const answer = {
        attemptId: id,
        userAnswer: "720",
        isCorrect: true,
        durationMs: 1000,
        previousTries: 0,
        now: NOW,
      };

      expect(await closeAttempt(prisma, answer)).toBe(true);
      expect(await closeAttempt(prisma, answer)).toBe(false);

      expect(await mastery()).toMatchObject({ attempts: 1, correct: 1, intervalDays: 2 });
    });

    it("lässt das erste Urteil stehen, auch wenn das zweite anders lautet", async () => {
      const id = await seedOpenAttempt();

      await closeAttempt(prisma, {
        attemptId: id,
        userAnswer: "720",
        isCorrect: true,
        durationMs: 1000,
        previousTries: 0,
        now: NOW,
      });

      const later = new Date("2026-09-01T00:00:00.000Z");
      await closeAttempt(prisma, {
        attemptId: id,
        userAnswer: "42",
        isCorrect: false,
        durationMs: 5000,
        previousTries: 0,
        now: later,
      });

      const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id } });
      expect(attempt.userAnswer).toBe("720");
      expect(attempt.isCorrect).toBe(true);
      expect(attempt.answeredAt).toEqual(NOW);
    });

    it("zählt auch bei gleichzeitigem Absenden nur einmal", async () => {
      const id = await seedOpenAttempt();
      const answer = {
        attemptId: id,
        userAnswer: "720",
        isCorrect: true,
        durationMs: 1000,
        previousTries: 0,
        now: NOW,
      };

      const results = await Promise.all([
        closeAttempt(prisma, answer),
        closeAttempt(prisma, answer),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await mastery()).toMatchObject({ attempts: 1 });
    });
  });

  describe("Versuche (M2f)", () => {
    const zweiterVersuch = (attemptId: string, userAnswer: string, isCorrect: boolean) => ({
      attemptId,
      userAnswer,
      isCorrect,
      durationMs: 20_000,
      previousTries: 1,
      now: NOW,
    });

    it("zählt den schließenden Versuch in tries", async () => {
      const id = await seedOpenAttempt();
      await recordFirstMiss(prisma, { attemptId: id, userAnswer: "42", durationMs: 8000 });

      expect(await closeAttempt(prisma, zweiterVersuch(id, "720", true))).toBe(true);

      const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id } });
      expect(attempt).toMatchObject({
        status: "ANSWERED",
        tries: 2,
        userAnswer: "720",
        firstAnswer: "42",
        firstDurationMs: 8000,
        durationMs: 20_000,
      });
    });

    it("zählt richtig im zweiten Versuch für die Anzeige, nicht für die Steuerung", async () => {
      const first = await seedOpenAttempt();
      await closeAttempt(prisma, {
        attemptId: first,
        userAnswer: "720",
        isCorrect: true,
        durationMs: 1000,
        previousTries: 0,
        now: NOW,
      });
      expect(await mastery()).toMatchObject({ correct: 1, intervalDays: 2 });

      const second = await seedOpenAttempt();
      await recordFirstMiss(prisma, { attemptId: second, userAnswer: "42", durationMs: 1000 });
      await closeAttempt(prisma, zweiterVersuch(second, "720", true));

      // correct zählt mit, das Intervall fällt trotzdem auf einen Tag.
      expect(await mastery()).toMatchObject({ attempts: 2, correct: 2, intervalDays: 1 });
    });

    it("zählt richtig im ersten Versuch mit Tipp nicht als Erfolg", async () => {
      const id = await seedOpenAttempt();
      await prisma.attempt.update({ where: { id }, data: { hintsUsed: 1 } });

      await closeAttempt(prisma, {
        attemptId: id,
        userAnswer: "720",
        isCorrect: true,
        durationMs: 1000,
        previousTries: 0,
        now: NOW,
      });

      expect(await mastery()).toMatchObject({ attempts: 1, correct: 1, intervalDays: 1 });
    });

    it("trifft keine Zeile, wenn tries inzwischen weitergedreht wurde", async () => {
      // Zwei gleichzeitige erste Antworten: Die falsche war schneller. Die
      // richtige darf jetzt nicht mehr als erster Versuch schließen.
      const id = await seedOpenAttempt();
      await recordFirstMiss(prisma, { attemptId: id, userAnswer: "42", durationMs: 1000 });

      const closed = await closeAttempt(prisma, {
        attemptId: id,
        userAnswer: "720",
        isCorrect: true,
        durationMs: 1000,
        previousTries: 0,
        now: NOW,
      });

      expect(closed).toBe(false);
      expect(await mastery()).toBeNull();
      const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id } });
      expect(attempt).toMatchObject({ status: "OPEN", tries: 1 });
    });
  });

  describe("recordFirstMiss", () => {
    it("lässt den Attempt offen und schreibt keinen Fortschritt", async () => {
      const id = await seedOpenAttempt();

      expect(
        await recordFirstMiss(prisma, { attemptId: id, userAnswer: "42", durationMs: 4200 }),
      ).toBe(true);

      const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id } });
      expect(attempt).toMatchObject({
        status: "OPEN",
        tries: 1,
        firstAnswer: "42",
        firstDurationMs: 4200,
        userAnswer: null,
        isCorrect: null,
        answeredAt: null,
      });
      expect(await mastery()).toBeNull();
    });

    it("gilt bei gleichzeitigem Absenden nur einmal als erster Versuch", async () => {
      const id = await seedOpenAttempt();
      const input = { attemptId: id, userAnswer: "42", durationMs: 1000 };

      const results = await Promise.all([
        recordFirstMiss(prisma, input),
        recordFirstMiss(prisma, { ...input, userAnswer: "43" }),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
      expect((await prisma.attempt.findUniqueOrThrow({ where: { id } })).tries).toBe(1);
    });

    it("rührt einen geschlossenen Attempt nicht an", async () => {
      const id = await seedOpenAttempt();
      await prisma.attempt.update({ where: { id }, data: { status: "SKIPPED" } });

      expect(
        await recordFirstMiss(prisma, { attemptId: id, userAnswer: "42", durationMs: 1000 }),
      ).toBe(false);
      expect((await prisma.attempt.findUniqueOrThrow({ where: { id } })).tries).toBe(0);
    });
  });

  it("rührt einen offenen Attempt nicht an — eine unlesbare Antwort zählt nicht", async () => {
    // Die Route ruft `closeAttempt` bei `unparseable` gar nicht erst auf
    // (D-04). Hier wird die andere Hälfte geprüft: Solange niemand schließt,
    // gibt es keinen Fortschritt.
    await seedOpenAttempt();

    expect(await mastery()).toBeNull();
    expect(await prisma.attempt.count({ where: { status: "OPEN" } })).toBe(1);
  });
});
