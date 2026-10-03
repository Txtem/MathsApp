/**
 * Fortschreibung des Themenfortschritts nach einer beantworteten Aufgabe.
 *
 * Rein: Eingabe ist der bisherige Stand, das Urteil und der Zeitpunkt — keine
 * Datenbank, keine Uhr. Die dünne DB-Schicht darüber steht in
 * `lib/db/attempts.ts` und ruft nur diese Funktion auf.
 *
 * Das Intervall folgt SM-2-light (SPEC.md Abschnitt 10): Erfolg verdoppelt,
 * Misserfolg setzt zurück. Kein Elo, kein Bayesian Knowledge Tracing — das kann
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

/**
 * Das Urteil über einen geschlossenen Attempt, in den zwei Lesarten, die seit
 * M2f auseinanderfallen. Beide sind Pflicht: Wer nur eine kennt, soll nicht
 * stillschweigend die andere mitbestimmen.
 */
export interface MasteryVerdict {
  /** Richtig, gleich in welchem Versuch — zählt `correct` hoch, also die Anzeige. */
  readonly correct: boolean;
  /** `countsAsSuccess` aus `./outcome` — steuert das Intervall. */
  readonly success: boolean;
}

export function advanceMastery(
  current: MasteryState | null | undefined,
  verdict: MasteryVerdict,
  now: Date,
): MasteryUpdate {
  const previousInterval = current?.intervalDays ?? INITIAL_INTERVAL_DAYS;

  // Erfolg verdoppelt das Intervall, alles andere setzt es auf einen Tag zurück.
  // Ein Thema, das man kann, kommt seltener; eines, das man verfehlt, morgen.
  // Erfolg heißt: richtig im ersten Versuch ohne Tipp. Ein im zweiten Anlauf
  // gelöstes Thema ist nicht gekonnt und soll morgen wiederkommen.
  const intervalDays = verdict.success
    ? Math.min(previousInterval * 2, MAX_INTERVAL_DAYS)
    : INITIAL_INTERVAL_DAYS;

  return {
    attempts: (current?.attempts ?? 0) + 1,
    // `correct` trägt nur die Spalte „Erfolgsquote gesamt" auf /stats. Dort ist
    // richtig richtig, auch im zweiten Versuch (IDEEN.md).
    correct: (current?.correct ?? 0) + (verdict.correct ? 1 : 0),
    intervalDays,
    lastSeenAt: now,
    dueAt: new Date(now.getTime() + intervalDays * MS_PER_DAY),
  };
}
