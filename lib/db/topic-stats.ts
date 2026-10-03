import { AttemptStatusSchema } from "@/lib/api/contracts";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { classifyOutcome, countsAsSuccess } from "@/lib/selection/outcome";
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
 * Das Fenster umfasst alle **geschlossenen** Attempts, `ANSWERED` und
 * `SKIPPED`. Seit M2f heißt `SKIPPED` „aufgegeben" und ist ein Misserfolg —
 * bliebe es draußen, wäre Aufgeben ein Ausgang aus der Statistik: Wer merkt,
 * dass er es nicht kann, gibt auf, und das Thema gilt als gekonnt.
 *
 * Aus demselben Fenster entstehen zwei Zahlen: `recentSuccess` für die
 * Auswahl (`countsAsSuccess`) und `recentRight` für die Anzeige
 * (`classifyOutcome`, richtig in jedem Versuch). Beide Fragen werden dort
 * beantwortet, nicht hier.
 *
 * Eine Abfrage pro Thema, nicht eine für alle: „die letzten zehn **je Thema**"
 * geht in einer Abfrage nur mit Fensterfunktionen. Bei einer Handvoll Themen
 * ist das der schlechtere Tausch — und jede einzelne Abfrage liegt genau auf
 * dem Index `[userId, topic, answeredAt]`.
 */
export interface TopicWindow extends TopicStats {
  /** Richtige, gleich in welchem Versuch, im selben Fenster — nur für die Anzeige. */
  readonly recentRight: number;
}

export async function loadTopicStats(
  prisma: PrismaClient,
  userId: string,
  topics: readonly string[],
): Promise<TopicWindow[]> {
  if (topics.length === 0) return [];

  const masteries = await prisma.topicMastery.findMany({
    where: { userId, topic: { in: [...topics] } },
    select: { topic: true, dueAt: true, lastSeenAt: true },
  });

  const byTopic = new Map(masteries.map((entry) => [entry.topic, entry]));

  return Promise.all(
    topics.map(async (topic) => {
      const recent = await prisma.attempt.findMany({
        where: { userId, topic, status: { in: ["ANSWERED", "SKIPPED"] } },
        orderBy: { answeredAt: "desc" },
        take: RECENT_WINDOW,
        select: { status: true, isCorrect: true, tries: true, hintsUsed: true },
      });

      const closed = recent.map((attempt) => ({
        ...attempt,
        status: AttemptStatusSchema.parse(attempt.status),
      }));
      const mastery = byTopic.get(topic);

      return {
        topic,
        recentClosed: closed.length,
        recentSuccess: closed.filter(countsAsSuccess).length,
        recentRight: closed.filter((attempt) => {
          const outcome = classifyOutcome(attempt);
          return outcome === "right_first" || outcome === "right_second";
        }).length,
        dueAt: mastery?.dueAt ?? null,
        lastSeenAt: mastery?.lastSeenAt ?? null,
      };
    }),
  );
}
