import type { TopicTotals } from "@/components/stats-rows";
import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Die Zahlen für die Statistik-Seite. Dünne Schicht: holen und weiterreichen,
 * gerechnet wird in `components/stats-rows.ts`.
 *
 * Kein `server-only`, Client als Parameter — wie die übrigen Module hier,
 * siehe D-19.
 */

/** Gesamtzahlen je Thema aus `TopicMastery`. Themen ohne Eintrag fehlen. */
export async function loadTopicTotals(
  prisma: PrismaClient,
  userId: string,
): Promise<TopicTotals[]> {
  const rows = await prisma.topicMastery.findMany({
    where: { userId },
    select: { topic: true, attempts: true, correct: true, dueAt: true },
  });

  return rows.map((row) => ({
    topic: row.topic,
    attempts: row.attempts,
    correct: row.correct,
    dueAt: row.dueAt,
  }));
}

/** Eine beantwortete Aufgabe mit gemessener Zeit. */
export interface AnsweredAttempt {
  readonly templateId: string;
  readonly topic: string;
  readonly durationMs: number;
  readonly isCorrect: boolean;
}

/**
 * Alle beantworteten Aufgaben mit gemessener Zeit — richtige wie falsche.
 *
 * Beide werden gebraucht: Die Medianzeit rechnet nur mit den richtigen, die
 * Schnellschüsse nur mit den falschen (D-21). Gefiltert wird deshalb erst in
 * `components/stats-rows.ts`, nicht schon hier.
 *
 * Bewusst ohne Obergrenze: Ein Median über die Hälfte der Daten wäre kein
 * Median. Für einen einzelnen Übenden sind das einige tausend schmale Zeilen;
 * wenn das je zum Problem wird, gehört die Zeit als Aggregat in `TopicMastery`
 * und nicht in eine größere Abfrage.
 */
export async function loadAnsweredDurations(
  prisma: PrismaClient,
  userId: string,
): Promise<AnsweredAttempt[]> {
  const rows = await prisma.attempt.findMany({
    where: { userId, status: "ANSWERED", durationMs: { not: null } },
    select: { templateId: true, topic: true, durationMs: true, isCorrect: true },
  });

  return rows.map((row) => ({
    templateId: row.templateId,
    topic: row.topic,
    durationMs: row.durationMs as number,
    // `isCorrect` ist nullable, weil ein offener Attempt noch kein Urteil hat.
    // Hier sind alle ANSWERED; alles außer `true` zählt als nicht richtig.
    isCorrect: row.isCorrect === true,
  }));
}
