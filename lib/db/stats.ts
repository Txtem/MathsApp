import type { ClosedAttempt } from "@/components/answer-times";
import type { TopicTotals } from "@/components/stats-rows";
import { AttemptStatusSchema } from "@/lib/api/contracts";
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

/**
 * Alle geschlossenen Aufgaben des Nutzers — beantwortet und aufgegeben. Eine
 * Abfrage trägt drei Dinge auf der Statistik-Seite: das Kreisdiagramm der vier
 * Ausgänge mit den Tipps je Ausgang, die Medianzeit über richtige Antworten und
 * die Schnellschüsse über erste Antworten (SPEC.md Abschnitt 10a). Gefiltert und
 * gerechnet wird erst in `components/`, nicht hier.
 *
 * Offene und verworfene (`VOIDED`) Attempts fehlen: Sie haben keinen Ausgang.
 *
 * Bewusst ohne Obergrenze: Ein Median über die Hälfte der Daten wäre kein
 * Median. Für einen einzelnen Übenden sind das einige tausend schmale Zeilen;
 * wenn das je zum Problem wird, gehören die Zahlen als Aggregat in
 * `TopicMastery` und nicht in eine größere Abfrage.
 */
export async function loadClosedAttempts(
  prisma: PrismaClient,
  userId: string,
): Promise<ClosedAttempt[]> {
  const rows = await prisma.attempt.findMany({
    where: { userId, status: { in: ["ANSWERED", "SKIPPED"] } },
    select: {
      templateId: true,
      topic: true,
      status: true,
      isCorrect: true,
      tries: true,
      hintsUsed: true,
      durationMs: true,
      firstAnswer: true,
      firstDurationMs: true,
    },
  });

  // `firstAnswer` selbst bleibt hier: Die Statistik braucht nur, dass es eine
  // falsche erste Antwort gab, nicht welche.
  return rows.map(({ firstAnswer, ...row }) => ({
    ...row,
    status: AttemptStatusSchema.parse(row.status),
    firstMissed: firstAnswer !== null,
  }));
}
