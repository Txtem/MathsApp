import { AttemptStatusSchema } from "@/lib/api/contracts";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { advanceMastery } from "@/lib/selection/mastery";
import { countsAsSuccess } from "@/lib/selection/outcome";

/**
 * Einen Attempt schließen und den Themenfortschritt fortschreiben — in einer
 * Transaktion, weil beides zusammengehört (SPEC.md Abschnitt 10).
 *
 * `answeredAt` und der neue Termin tragen denselben Zeitstempel: Er kommt als
 * `now` von der Route herein, nicht aus einer Uhr in dieser Funktion (D-20).
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
  /** Zeit bis zu **dieser**, also der letzten bewerteten Antwort. */
  readonly durationMs: number;
  /**
   * Wie viele bewertete Versuche der Attempt beim Lesen hatte, 0 oder 1. Steht
   * in der Bedingung des Updates: Hat ihn inzwischen jemand anders
   * weitergedreht, trifft dieser Aufruf keine Zeile.
   */
  readonly previousTries: number;
  /** Die Uhr der Anfrage. Pflicht, nicht optional — siehe D-20. */
  readonly now: Date;
}

/**
 * `true`, wenn dieser Aufruf den Attempt geschlossen hat, `false`, wenn ihn
 * jemand anders schon geschlossen oder weitergedreht hatte.
 *
 * Der Rückgabewert ist die ganze Absicherung gegen doppeltes Absenden: Nur wer
 * die Zeile von OPEN auf ANSWERED dreht, schreibt auch den Fortschritt fort.
 * Der zweite Absender trifft keine Zeile mehr und zählt deshalb nicht mit.
 *
 * `tries` steht mit in der Bedingung. Sonst könnten zwei gleichzeitige erste
 * Antworten — eine falsch, eine richtig — beide durchgehen: Die falsche dreht
 * `tries` auf 1, die richtige schließt danach mit dem veralteten Wert, und der
 * Attempt endete als „richtig im ersten Versuch" mit gesetztem `firstAnswer`.
 */
export async function closeAttempt(
  prisma: PrismaClient,
  input: CloseAttemptInput,
): Promise<boolean> {
  const { now } = input;

  return prisma.$transaction(async (tx) => {
    const closed = await tx.attempt.updateMany({
      where: { id: input.attemptId, status: "OPEN", tries: input.previousTries },
      data: {
        status: "ANSWERED",
        userAnswer: input.userAnswer,
        isCorrect: input.isCorrect,
        tries: input.previousTries + 1,
        durationMs: input.durationMs,
        answeredAt: now,
      },
    });

    if (closed.count === 0) return false;

    // Nutzer und Topic stehen auf dem Attempt selbst (D-18) — kein Umweg über
    // Session und Template, und damit auch keine zweite Wahrheit. Die Felder
    // für `countsAsSuccess` kommen aus der eben geschriebenen Zeile, nicht aus
    // dem Lesen davor: `hintsUsed` kann sich dazwischen geändert haben.
    const attempt = await tx.attempt.findUniqueOrThrow({
      where: { id: input.attemptId },
      select: {
        userId: true,
        topic: true,
        status: true,
        isCorrect: true,
        tries: true,
        hintsUsed: true,
      },
    });

    await advanceTopic(tx, attempt.userId, attempt.topic, now, {
      correct: attempt.isCorrect === true,
      success: countsAsSuccess({
        ...attempt,
        status: AttemptStatusSchema.parse(attempt.status),
      }),
    });

    return true;
  });
}

export interface FirstMissInput {
  readonly attemptId: string;
  readonly userAnswer: string;
  readonly durationMs: number;
}

/**
 * Die erste lesbare, falsche Antwort: Der Attempt bleibt **offen**, `tries`
 * geht von 0 auf 1, die Antwort und ihre Dauer werden festgehalten
 * (SPEC-M2f, D-1 dritte Zeile).
 *
 * Kein Fortschritt, kein `answeredAt`, kein `isCorrect` — es gibt noch kein
 * Urteil über die Aufgabe. `userAnswer` bleibt leer; es ist die Antwort, mit
 * der die Aufgabe geschlossen wurde.
 *
 * Atomar wie das Schließen: `tries: 0` steht in der Bedingung. Zwei
 * gleichzeitige erste Antworten dürfen nicht beide als „erster Versuch"
 * gelten. `false` heißt: Jemand anders war schneller.
 */
export async function recordFirstMiss(
  prisma: PrismaClient,
  input: FirstMissInput,
): Promise<boolean> {
  const updated = await prisma.attempt.updateMany({
    where: { id: input.attemptId, status: "OPEN", tries: 0 },
    data: { tries: 1, firstAnswer: input.userAnswer, firstDurationMs: input.durationMs },
  });
  return updated.count === 1;
}

async function advanceTopic(
  tx: Prisma.TransactionClient,
  userId: string,
  topic: string,
  now: Date,
  verdict: { readonly correct: boolean; readonly success: boolean },
): Promise<void> {
  const key = { userId_topic: { userId, topic } };

  const current = await tx.topicMastery.findUnique({
    where: key,
    select: { attempts: true, correct: true, intervalDays: true },
  });

  const next = advanceMastery(current, verdict, now);

  await tx.topicMastery.upsert({
    where: key,
    create: { userId, topic, ...next },
    update: next,
  });
}
