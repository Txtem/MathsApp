import type { PrismaClient } from "@/lib/generated/prisma/client";
import { advanceMastery } from "@/lib/selection/mastery";

/**
 * Einen Attempt schließen und den Themenfortschritt fortschreiben — in einer
 * Transaktion, weil beides zusammengehört (SPEC.md Abschnitt 10).
 *
 * Kein `server-only`, und der Prisma-Client kommt als Parameter herein statt aus
 * dem Singleton. Damit ist die Funktion gegen eine Wegwerf-Datenbank testbar,
 * ohne dass sie ihre Rolle ändert; dieselbe Trennung wie bei
 * `lib/content/read.ts`, siehe D-12 und D-19. Was nie in den Browser darf, ist
 * der Client aus `lib/db/client.ts` — der trägt das `server-only`.
 */

export interface CloseAttemptInput {
  readonly attemptId: string;
  readonly userAnswer: string;
  readonly isCorrect: boolean;
  readonly durationMs: number;
  /** Wird durchgereicht, damit Tests nicht von der echten Uhr abhängen. */
  readonly now?: Date;
}

/**
 * `true`, wenn dieser Aufruf den Attempt geschlossen hat, `false`, wenn ihn
 * jemand anders schon geschlossen hatte.
 *
 * Der Rückgabewert ist die ganze Absicherung gegen doppeltes Absenden: Nur wer
 * die Zeile von OPEN auf ANSWERED dreht, schreibt auch den Fortschritt fort.
 * Der zweite Absender trifft keine Zeile mehr und zählt deshalb nicht mit.
 */
export async function closeAttempt(
  prisma: PrismaClient,
  input: CloseAttemptInput,
): Promise<boolean> {
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const closed = await tx.attempt.updateMany({
      where: { id: input.attemptId, status: "OPEN" },
      data: {
        status: "ANSWERED",
        userAnswer: input.userAnswer,
        isCorrect: input.isCorrect,
        durationMs: input.durationMs,
        answeredAt: now,
      },
    });

    if (closed.count === 0) return false;

    // Nutzer und Topic stehen auf dem Attempt selbst (D-18) — kein Umweg über
    // Session und Template, und damit auch keine zweite Wahrheit.
    const attempt = await tx.attempt.findUniqueOrThrow({
      where: { id: input.attemptId },
      select: { userId: true, topic: true },
    });

    const key = { userId_topic: { userId: attempt.userId, topic: attempt.topic } };

    const current = await tx.topicMastery.findUnique({
      where: key,
      select: { attempts: true, correct: true, intervalDays: true },
    });

    const next = advanceMastery(current, input.isCorrect, now);

    await tx.topicMastery.upsert({
      where: key,
      create: { userId: attempt.userId, topic: attempt.topic, ...next },
      update: next,
    });

    return true;
  });
}
