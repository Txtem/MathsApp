/**
 * Was die Übungsseite rund um Tipps, zweiten Versuch und Aufgeben anzeigt
 * (SPEC.md Abschnitt 8). Rein und getestet — dieselbe Trennung wie bei
 * `stats-rows.ts` und aus demselben Grund (D-16): Für React-Komponenten gibt es
 * keine Tests, also steht die Entscheidung hier und nicht im JSX.
 *
 * Die Regeln selbst setzt der Server durch — „Lösung zeigen" vor dem letzten
 * Tipp lehnt er mit 409 ab. Diese Funktionen entscheiden nur, was sichtbar ist,
 * damit niemand einen Knopf sieht, den der Server ablehnen würde.
 */

/** Der Stand einer offenen Aufgabe, wie ihn die Seite hält. */
export interface QuestionState {
  readonly hintsTotal: number;
  /** Die geöffneten Tipps, in Reihenfolge. Bleiben sichtbar. */
  readonly openedHints: readonly string[];
  /** Der erste Versuch war falsch — die nächste Antwort ist der zweite. */
  readonly firstTryWrong: boolean;
}

export interface QuestionControls {
  /** Der Knopf „Tipp" — `null`, wenn es keinen Tipp (mehr) gibt. */
  readonly hintButton: string | null;
  /**
   * „Lösung zeigen" erscheint erst, wenn alle Tipps offen sind. Ohne Tipps
   * steht der Knopf von Anfang an da (D-31).
   */
  readonly showGiveUp: boolean;
  /** Die Zeile über dem Eingabefeld im zweiten Versuch, sonst `null`. */
  readonly attemptLine: string | null;
}

export function questionControls(state: QuestionState): QuestionControls {
  const opened = state.openedHints.length;
  const remaining = state.hintsTotal - opened;

  return {
    hintButton:
      remaining <= 0
        ? null
        : opened === 0
          ? "Tipp"
          : `Nächster Tipp (${opened + 1} von ${state.hintsTotal})`,
    showGiveUp: remaining <= 0,
    attemptLine: state.firstTryWrong ? "Zweiter Versuch" : null,
  };
}

/**
 * Nimmt einen Tipp vom Server auf. Nur der Tipp mit dem nächsten Index wird
 * angehängt — ein verspäteter oder doppelter (zwei schnelle Klicks) ändert
 * nichts, statt einen Tipp zweimal oder in falscher Reihenfolge zu zeigen.
 */
export function withHint(state: QuestionState, hint: string, index: number): QuestionState {
  if (index !== state.openedHints.length) return state;
  return { ...state, openedHints: [...state.openedHints, hint] };
}

/** Die Meldung nach der ersten falschen Antwort. Keine Lösung, kein Lösungsweg. */
export const RETRY_NOTICE = "Das stimmt noch nicht. Du hast einen zweiten Versuch.";

/** Wie eine geschlossene Aufgabe ausgegangen ist, aus Sicht der Seite. */
export type ClosedVerdict =
  | { readonly kind: "answered"; readonly isCorrect: boolean; readonly secondTry: boolean }
  | { readonly kind: "gave_up" };

export interface VerdictLook {
  readonly headline: string;
  /** Grün für richtig, gleich in welchem Versuch — für die Anzeige ist richtig richtig. */
  readonly tone: "right" | "wrong" | "gave_up";
}

/** `expected` ist die gefragte Form der Lösung (`expectedDisplay(...).primary`). */
export function verdictLook(verdict: ClosedVerdict, expected: string): VerdictLook {
  if (verdict.kind === "gave_up") {
    return { headline: `Aufgegeben. Die Lösung ist ${expected}.`, tone: "gave_up" };
  }
  if (verdict.isCorrect) {
    return {
      headline: verdict.secondTry ? "Richtig — im zweiten Versuch." : "Richtig.",
      tone: "right",
    };
  }
  return { headline: `Falsch. Richtig wäre ${expected} gewesen.`, tone: "wrong" };
}
