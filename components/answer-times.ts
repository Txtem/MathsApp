import type { AttemptStatus } from "@/lib/api/contracts";

import type { AnsweredDuration } from "./stats-rows";

/**
 * Welche Zeiten in die Statistik eingehen, seit es zwei Versuche gibt
 * (SPEC.md Abschnitt 10a). Rein und getestet, wie `stats-rows.ts` (D-16).
 *
 * - Die **Medianzeit** rechnet weiter über richtige Antworten, beide Varianten,
 *   mit `durationMs` — der Zeit bis zur letzten Antwort.
 * - Die **Schnellschüsse** (D-21) zählen **erste** Antworten, die falsch und
 *   schnell waren. Dafür ist `firstDurationMs` da: Sonst verschwände ein
 *   geratener erster Versuch, sobald der zweite sitzt.
 */

/** Ein geschlossener Attempt, so weit die Statistik ihn braucht. */
export interface ClosedAttempt {
  readonly templateId: string;
  readonly topic: string;
  readonly status: AttemptStatus;
  readonly isCorrect: boolean | null;
  readonly tries: number;
  readonly hintsUsed: number;
  /** Bis zur letzten bewerteten Antwort; `null` beim Aufgeben ohne Antwort. */
  readonly durationMs: number | null;
  /** Es gab eine falsche erste Antwort (`firstAnswer` gesetzt). */
  readonly firstMissed: boolean;
  readonly firstDurationMs: number | null;
}

export interface Timings {
  /** Die schließenden Antworten — für die Medianzeit über richtige. */
  readonly finalAnswers: readonly AnsweredDuration[];
  /** Die ersten Antworten, richtig oder falsch — für die Schnellschüsse. */
  readonly firstAnswers: readonly AnsweredDuration[];
}

/** `targetFor` liefert die Zielzeit in Millisekunden, `null` ohne Template. */
export function toTimings(
  closed: readonly ClosedAttempt[],
  targetFor: (templateId: string) => number | null,
): Timings {
  const finalAnswers: AnsweredDuration[] = [];
  const firstAnswers: AnsweredDuration[] = [];

  for (const attempt of closed) {
    const base = { topic: attempt.topic, targetMs: targetFor(attempt.templateId) };

    if (attempt.status === "ANSWERED" && attempt.durationMs !== null) {
      finalAnswers.push({ ...base, durationMs: attempt.durationMs, isCorrect: attempt.isCorrect === true });
    }

    const first = firstAnswer(attempt);
    if (first) firstAnswers.push({ ...base, ...first });
  }

  return { finalAnswers, firstAnswers };
}

/**
 * Die erste bewertete Antwort eines Attempts, oder `undefined`, wenn es keine
 * gab (aufgegeben, bevor überhaupt geantwortet wurde).
 *
 * War sie falsch und folgte ein zweiter Versuch, steht sie in `firstDurationMs`.
 * Sonst war die schließende Antwort zugleich die erste — so auch bei allen
 * Attempts aus der Zeit vor M2f.
 */
function firstAnswer(
  attempt: ClosedAttempt,
): { readonly durationMs: number; readonly isCorrect: boolean } | undefined {
  if (attempt.firstMissed) {
    return attempt.firstDurationMs === null
      ? undefined
      : { durationMs: attempt.firstDurationMs, isCorrect: false };
  }
  if (attempt.status === "ANSWERED" && attempt.durationMs !== null) {
    return { durationMs: attempt.durationMs, isCorrect: attempt.isCorrect === true };
  }
  return undefined;
}
