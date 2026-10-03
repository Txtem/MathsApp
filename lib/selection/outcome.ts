import type { AttemptStatus } from "@/lib/api/contracts";

/**
 * Wie eine Aufgabe ausgegangen ist, und ob das für die Steuerung als Erfolg
 * zählt — die beiden Fragen, die seit M2f nicht mehr dasselbe sind.
 *
 * Rein, und die **einzige** Stelle, an der sie beantwortet werden: Die
 * Statistik fragt `classifyOutcome`, die Auswahl (`advanceMastery`, die
 * gleitende Quote) fragt `countsAsSuccess`. Wer eine der beiden Fragen an
 * anderer Stelle aus `isCorrect` und `tries` nachbaut, hat zwei Wahrheiten.
 *
 * Es gibt kein Feld `outcome` in der Datenbank: Der Ausgang folgt vollständig
 * aus `status`, `isCorrect` und `tries`, und ein abgeleitetes Feld könnte von
 * seinen Quellen abweichen.
 */

export type Outcome = "gave_up" | "wrong" | "right_first" | "right_second";

export interface OutcomeFields {
  readonly status: AttemptStatus;
  readonly isCorrect: boolean | null;
  /** Bewertete Versuche, 0–2. Unlesbare Eingaben zählen nicht. */
  readonly tries: number;
}

export interface SuccessFields extends OutcomeFields {
  readonly hintsUsed: number;
}

/**
 * Der Ausgang, wie ihn die Anzeige zeigt. `null` heißt: Die Aufgabe hat
 * keinen — sie ist noch offen oder wurde verworfen.
 *
 * Für die Anzeige ist richtig richtig, gleich in welchem Versuch (`IDEEN.md`).
 * Die beiden Richtig-Varianten bleiben trotzdem getrennt, damit die
 * Unterscheidung nicht verloren geht.
 *
 * Alte Attempts aus der Zeit vor M2f tragen `tries = 1` aus der Migration und
 * erscheinen damit als `right_first` oder `wrong` — so, wie sie beantwortet
 * wurden.
 */
export function classifyOutcome(attempt: OutcomeFields): Outcome | null {
  switch (attempt.status) {
    case "OPEN":
      return null;
    // Verworfen, weil sich das Template geändert hat: kein Ausgang. Den
    // Versionswechsel lösen Entwickler aus — die Statistik soll niemanden dafür
    // bestrafen, dass ein Template verbessert wurde.
    case "VOIDED":
      return null;
    case "SKIPPED":
      return "gave_up";
    case "ANSWERED":
      if (attempt.isCorrect !== true) return "wrong";
      return attempt.tries >= 2 ? "right_second" : "right_first";
  }
}

/**
 * Ob der Attempt für die Steuerung als Erfolg zählt: **richtig im ersten
 * Versuch und ohne geöffneten Tipp.** Alles andere — zweiter Versuch, Tipp,
 * aufgegeben, falsch — ist für die Auswahl ein Misserfolg (SPEC-M2f,
 * Entscheidung 1).
 *
 * Grund: Die Erfolgsquote steuert Score und Zielschwierigkeit zugleich. Zählte
 * der zweite Versuch oder ein Versuch mit Tipp als Erfolg, ginge die Quote
 * eines schwachen Themas gegen 1,0 — es käme seltener und zugleich mit
 * Schwierigkeit 4. Mit jederzeit verfügbaren Tipps ließe sich jedes Thema per
 * Klick auf „gekonnt" stellen.
 *
 * Abgeleitet aus `classifyOutcome`, nicht daneben formuliert: Was die Anzeige
 * „im ersten Versuch richtig" nennt, ist dieselbe Aussage.
 */
export function countsAsSuccess(attempt: SuccessFields): boolean {
  return classifyOutcome(attempt) === "right_first" && attempt.hintsUsed === 0;
}
