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

    await advanceFromClosedRow(tx, input.attemptId, now);
    return true;
  });
}

export interface GiveUpInput {
  readonly attemptId: string;
  /**
   * So viele Tipps müssen geöffnet sein — die Zahl der Tipps des Templates.
   * Steht in der Bedingung des Updates, nicht in einer Prüfung davor: Die Regel
   * „erst alle Tipps, dann die Lösung" setzt die Datenbankzeile durch, nicht
   * ein Lesen, das schon veraltet sein kann.
   */
  readonly requiredHints: number;
  /** Die Uhr der Anfrage. Pflicht, nicht optional — siehe D-20. */
  readonly now: Date;
}

/**
 * Aufgeben: Der Attempt wird `SKIPPED`, `answeredAt = now`, und der
 * Themenfortschritt wird **als Misserfolg** fortgeschrieben — in derselben
 * Transaktion (SPEC-M2f, D-3). Sonst wäre Aufgeben ein Ausgang aus der
 * Statistik: Wer merkt, dass er es nicht kann, gibt auf, und das Thema gilt
 * als gekonnt.
 *
 * `false` heißt: Der Attempt war nicht mehr offen, oder es waren nicht alle
 * Tipps geöffnet. Der Aufrufer unterscheidet die beiden Fälle selbst.
 */
export async function giveUp(prisma: PrismaClient, input: GiveUpInput): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const closed = await tx.attempt.updateMany({
      where: { id: input.attemptId, status: "OPEN", hintsUsed: { gte: input.requiredHints } },
      data: { status: "SKIPPED", answeredAt: input.now },
    });

    if (closed.count === 0) return false;

    await advanceFromClosedRow(tx, input.attemptId, input.now);
    return true;
  });
}

/**
 * Ein offener Attempt, der etwas über den Übenden verrät: mindestens ein
 * bewerteter Versuch oder ein geöffneter Tipp. Nur solche Attempts werden beim
 * Weggehen als aufgegeben geschlossen; einer ohne Versuch und ohne Tipp trägt
 * keine Information und bleibt unberührt (SPEC-M2f, Schritt 4b).
 */
const INFORMATIVE_OPEN: Prisma.AttemptWhereInput = {
  status: "OPEN",
  OR: [{ tries: { gte: 1 } }, { hintsUsed: { gte: 1 } }],
};

/**
 * Wer weggeht, hat aufgegeben: Offene Attempts des Nutzers mit Versuch oder
 * Tipp werden `SKIPPED` und als Misserfolg fortgeschrieben — mit dem `now` der
 * Anfrage, die das Weggehen feststellt.
 *
 * Läuft in der Transaktion des Aufrufers, damit das Schließen und das, was es
 * auslöst (eine neue Sitzung), zusammen gelingen oder zusammen scheitern.
 * Gibt zurück, wie viele Attempts geschlossen wurden.
 *
 * Ohne das wäre Weggehen ein Ausgang aus der Statistik: nach dem ersten
 * Fehlversuch eine neue Sitzung starten, und der Fehlversuch zählte nie.
 */
export async function abandonOpenAttempts(
  tx: Prisma.TransactionClient,
  input: { readonly userId: string; readonly now: Date },
): Promise<number> {
  const candidates = await tx.attempt.findMany({
    where: { userId: input.userId, ...INFORMATIVE_OPEN },
    select: { id: true },
  });

  let closed = 0;
  for (const { id } of candidates) {
    // Die Bedingung noch einmal in der Aktualisierung: Was inzwischen
    // beantwortet wurde, bleibt, wie es ist.
    const updated = await tx.attempt.updateMany({
      where: { id, ...INFORMATIVE_OPEN },
      data: { status: "SKIPPED", answeredAt: input.now },
    });
    if (updated.count === 0) continue;
    await advanceFromClosedRow(tx, id, input.now);
    closed++;
  }
  return closed;
}

/**
 * Einen begonnenen Attempt verwerfen, weil sich sein Template seit dem Stellen
 * geändert hat: `VOIDED`, `answeredAt = now`, **kein** Fortschritt.
 *
 * Nicht als Misserfolg wie beim Weggehen: Den Versionswechsel lösen Entwickler
 * aus, nicht der Übende, und die Statistik soll niemanden dafür bestrafen, dass
 * ein Template verbessert wurde. Ein Schlupfloch entsteht nicht — der Übende
 * kann keinen Versionswechsel herbeiführen. `VOIDED` steht in keinem Fenster
 * und hat keinen Ausgang (`classifyOutcome` gibt `null`).
 *
 * Nur Attempts mit Versuch oder Tipp; ein unberührter trägt keine Information
 * und bleibt liegen. `true`, wenn dieser Aufruf verworfen hat.
 */
export async function voidAttempt(
  prisma: PrismaClient,
  input: { readonly attemptId: string; readonly now: Date },
): Promise<boolean> {
  const updated = await prisma.attempt.updateMany({
    where: { id: input.attemptId, ...INFORMATIVE_OPEN },
    data: { status: "VOIDED", answeredAt: input.now },
  });
  return updated.count === 1;
}

/**
 * Schreibt den Themenfortschritt aus der eben geschlossenen Zeile fort.
 *
 * Nutzer und Topic stehen auf dem Attempt selbst (D-18) — kein Umweg über
 * Session und Template, und damit auch keine zweite Wahrheit. Die Felder für
 * `countsAsSuccess` kommen aus der geschriebenen Zeile, nicht aus einem Lesen
 * davor: `hintsUsed` kann sich dazwischen geändert haben.
 */
async function advanceFromClosedRow(
  tx: Prisma.TransactionClient,
  attemptId: string,
  now: Date,
): Promise<void> {
  const attempt = await tx.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: { userId: true, topic: true, status: true, isCorrect: true, tries: true, hintsUsed: true },
  });

  const verdict = {
    correct: attempt.isCorrect === true,
    success: countsAsSuccess({ ...attempt, status: AttemptStatusSchema.parse(attempt.status) }),
  };

  const key = { userId_topic: { userId: attempt.userId, topic: attempt.topic } };

  const current = await tx.topicMastery.findUnique({
    where: key,
    select: { attempts: true, correct: true, intervalDays: true },
  });

  const next = advanceMastery(current, verdict, now);

  await tx.topicMastery.upsert({
    where: key,
    create: { userId: attempt.userId, topic: attempt.topic, ...next },
    update: next,
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
