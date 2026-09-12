/**
 * Wie die Musterlösung auf der Antwortseite dasteht.
 *
 * Rein und getestet, weil beim Üben genau hier Verwirrung entstanden ist: Die
 * Aufgabe verlangte eine auf vier Stellen gerundete Dezimalzahl, die Lösung
 * zeigte danach `46/91`. Wer richtig geantwortet hatte, zweifelte an sich
 * selbst. Dieselbe Trennung wie bei `stats-rows.ts` und aus demselben Grund
 * (D-16).
 */

/** Was die Antwortseite anzeigt. */
export interface ExpectedDisplay {
  /** Die Form, nach der gefragt wurde. Steht zuerst. */
  readonly primary: string;
  /** Der exakte Wert daneben — `null`, wenn `primary` schon exakt ist. */
  readonly exact: string | null;
}

/** Deutsche Schreibweise: Der Dezimalpunkt der Engine wird zum Komma. */
export function withDecimalComma(value: string): string {
  return value.replace(".", ",");
}

/**
 * `expectedRounded` kommt nur mit, wenn das Template `round_to` setzt. Dann ist
 * es das, wonach gefragt wurde, und der Bruch ist die Zusatzinformation —
 * nicht umgekehrt.
 */
export function expectedDisplay(
  expectedAnswer: string,
  expectedRounded?: string,
): ExpectedDisplay {
  if (expectedRounded === undefined) return { primary: expectedAnswer, exact: null };

  const primary = withDecimalComma(expectedRounded);
  // Bei einem glatten Wert stünde sonst „2,0000 (exakt 2)" da — das erklärt nichts.
  return { primary, exact: expectedAnswer === expectedRounded ? null : expectedAnswer };
}
