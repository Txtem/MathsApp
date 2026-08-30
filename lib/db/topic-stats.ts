import type { PrismaClient } from "@/lib/generated/prisma/client";
import { RECENT_WINDOW, type TopicStats } from "@/lib/selection/scoring";

/**
 * Die dünne Schicht unter der Auswahl: Sie holt den Stand je Thema aus der
 * Datenbank und gibt ihn als schlichte Werte weiter. Die Bewertung selbst
 * steht rein in `lib/selection/scoring.ts` (SPEC.md Abschnitt 10).
 *
 * Kein `server-only`, Client als Parameter — wie `lib/db/attempts.ts`,
 * siehe D-19.
 */

/**
 * Die gleitende Erfolgsquote kommt aus den Attempts, nicht aus `TopicMastery`:
 * Dort stehen nur Gesamtzahlen, aus denen sich „die letzten zehn" nicht
 * rekonstruieren lassen (D-18).
 *
 * Gefiltert wird auf `status: "ANSWERED"` statt auf einen gesetzten
 * `answeredAt`. Ein übersprungener Attempt trägt kein Urteil und darf die
 * Quote nicht verwässern.
 *
 * Eine Abfrage pro Thema, nicht eine für alle: „die letzten zehn **je Thema**"
 * geht in einer Abfrage nur mit Fensterfunktionen. Bei einer Handvoll Themen
 * ist das der schlechtere Tausch — und jede einzelne Abfrage liegt genau auf
 * dem Index `[userId, topic, answeredAt]`.
 */
export async function loadTopicStats(
  prisma: PrismaClient,
  userId: string,
  topics: readonly string[],
): Promise<TopicStats[]> {
  if (topics.length === 0) return [];

  const masteries = await prisma.topicMastery.findMany({
    where: { userId, topic: { in: [...topics] } },
    select: { topic: true, dueAt: true, lastSeenAt: true },
  });

  const byTopic = new Map(masteries.map((entry) => [entry.topic, entry]));

  return Promise.all(
    topics.map(async (topic) => {
      const recent = await prisma.attempt.findMany({
        where: { userId, topic, status: "ANSWERED" },
        orderBy: { answeredAt: "desc" },
        take: RECENT_WINDOW,
        select: { isCorrect: true },
      });

      const mastery = byTopic.get(topic);

      return {
        topic,
        recentAnswered: recent.length,
        recentCorrect: recent.filter((attempt) => attempt.isCorrect === true).length,
        dueAt: mastery?.dueAt ?? null,
        lastSeenAt: mastery?.lastSeenAt ?? null,
      };
    }),
  );
}
