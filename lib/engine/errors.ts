/**
 * Fehlerklassen der Engine. Alle sind synchron und tragen genug Kontext, um das
 * verursachende Template bzw. den verursachenden Ausdruck zu identifizieren.
 *
 * Leitlinie: Ein falsch konfiguriertes Template soll laut scheitern, nicht still
 * eine kaputte Aufgabe liefern.
 */

/** Ein Template hat nach `MAX_TRIES` Versuchen keine gültige Instanz geliefert. */
export class TemplateUnsatisfiableError extends Error {
  constructor(
    readonly templateId: string,
    readonly tries: number,
  ) {
    super(
      `Template ${templateId} lieferte nach ${tries} Versuchen keine gültige Instanz. ` +
        `Wertebereiche und Constraints passen nicht zusammen.`,
    );
    this.name = "TemplateUnsatisfiableError";
  }
}

/** Das Template selbst ist fehlerhaft: unbekannter Platzhalter, kaputtes Constraint, leerer Wertebereich. */
export class TemplateConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateConfigError";
  }
}

/** `compute_ref` steht nicht in der Registry-Whitelist. */
export class UnknownComputeRefError extends TemplateConfigError {
  constructor(
    readonly templateId: string,
    readonly computeRef: string,
  ) {
    super(`Template ${templateId} verweist auf unbekannte compute_ref "${computeRef}".`);
    this.name = "UnknownComputeRefError";
  }
}

/**
 * Ein Ausdruck ließ sich nicht lesen oder nicht auswerten.
 *
 * Bei Nutzereingaben ist das *nicht* dasselbe wie „falsch" — `grade` übersetzt
 * ihn in `{ ok: false, reason: "unparseable" }`. Bei Constraints aus einem
 * Template ist er ein Konfigurationsfehler und wird weitergereicht.
 */
export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

/** `answer_type` ist gültig, aber in dieser Ausbaustufe noch nicht implementiert. */
export class UnsupportedAnswerTypeError extends Error {
  constructor(readonly answerType: string) {
    super(`answer_type "${answerType}" ist noch nicht implementiert (M0 kennt nur "integer").`);
    this.name = "UnsupportedAnswerTypeError";
  }
}

/** Die gespeicherte Musterlösung passt nicht zum `answer_type` — ein Serverfehler, keine Nutzereingabe. */
export class InvalidExpectedAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidExpectedAnswerError";
  }
}
