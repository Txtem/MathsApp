/**
 * Fortschreibung des Themenfortschritts nach einer beantworteten Aufgabe.
 *
 * Rein: Eingabe ist der bisherige Stand, das Urteil und der Zeitpunkt — keine
 * Datenbank, keine Uhr. Die dünne DB-Schicht darüber steht in
 * `lib/db/attempts.ts` und ruft nur diese Funktion auf.
 *
 * Das Intervall folgt SM-2-light (SPEC.md Abschnitt 10): richtig verdoppelt,
 * falsch setzt zurück. Kein Elo, kein Bayesian Knowledge Tracing — das kann
 * später ersetzt werden, deshalb liegt es hinter dieser einen Signatur.
 */

/** Obergrenze für `intervalDays`. Ohne sie wächst das Intervall unbegrenzt. */
export const MAX_INTERVAL_DAYS = 60;

/** Startintervall eines Themas, das noch keinen Eintrag hat. */
export const INITIAL_INTERVAL_DAYS = 1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Der Stand, wie er in `TopicMastery` liegt. `undefined` heißt: noch kein Eintrag. */
export interface MasteryState {
  readonly attempts: number;
  readonly correct: number;
  readonly intervalDays: number;
}

export interface MasteryUpdate {
  readonly attempts: number;
  readonly correct: number;
  readonly intervalDays: number;
  readonly lastSeenAt: Date;
  readonly dueAt: Date;
}

export function advanceMastery(
  current: MasteryState | null | undefined,
  isCorrect: boolean,
  now: Date,
): MasteryUpdate {
  const previousInterval = current?.intervalDays ?? INITIAL_INTERVAL_DAYS;

  // Richtig verdoppelt das Intervall, falsch setzt es auf einen Tag zurück.
  // Ein Thema, das man kann, kommt seltener; eines, das man verfehlt, morgen.
  const intervalDays = isCorrect
    ? Math.min(previousInterval * 2, MAX_INTERVAL_DAYS)
    : INITIAL_INTERVAL_DAYS;

  return {
    attempts: (current?.attempts ?? 0) + 1,
    correct: (current?.correct ?? 0) + (isCorrect ? 1 : 0),
    intervalDays,
    lastSeenAt: now,
    dueAt: new Date(now.getTime() + intervalDays * MS_PER_DAY),
  };
}
