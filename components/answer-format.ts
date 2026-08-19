import type { AnswerType } from "@/lib/engine/types";

/**
 * Was für eine Antwort erwartet wird — als Satz unter dem Eingabefeld.
 *
 * Ohne diesen Hinweis ist bei `numeric` nicht entscheidbar, ob jemand `0.0177`
 * oder `1.77` meint; Prozentangaben sind in M1 ausdrücklich nicht zugelassen
 * (DECISIONS.md, D-09).
 */
export function answerFormatHint(answerType: AnswerType, roundTo?: number): string {
  switch (answerType) {
    case "integer":
      return "Ganze Zahl. Ausdrücke wie 5! oder combinations(10,3) sind erlaubt.";
    case "numeric":
      return roundTo === undefined
        ? "Dezimalzahl oder exakter Ausdruck, kein Prozentwert."
        : `Dezimalzahl, auf ${roundTo} Nachkommastellen gerundet, kein Prozentwert.`;
    case "fraction":
      return "Bruch als a/b, vollständig gekürzt.";
    case "choice":
      return "Antwortkürzel eingeben.";
    default:
      return "";
  }
}
