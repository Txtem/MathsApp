import type { AnswerType } from "@/lib/engine/types";

/**
 * Was für eine Antwort erwartet wird — als Satz unter dem Eingabefeld und
 * zusätzlich in der Meldung, wenn eine Eingabe nicht gelesen werden konnte.
 *
 * Ohne diesen Hinweis ist bei `numeric` nicht entscheidbar, ob jemand `0.0177`
 * oder `1.77` meint; Prozentangaben sind ausdrücklich nicht zugelassen
 * (DECISIONS.md, D-09).
 *
 * **Jeder Hinweis sagt „kein LaTeX".** Beim Üben wurde `\frac{69}{420}`
 * eingetippt und nicht gelesen. Der Instinkt ist verständlich: Wer in der
 * Aufgabe gesetzten Formelsatz sieht, tippt Formelsatz zurück. Die Grammatik
 * des Ausdruckskerns nimmt aber bewusst kein LaTeX auf — danach kämen `\binom`,
 * `\cdot`, `^{}`, und sie franste aus. Also wird der Hinweis deutlicher, statt
 * die Grammatik weicher zu werden.
 *
 * Der Text steht in einem `<p>`, nicht in Markdown: Beispiele werden ausgeschrieben,
 * nicht ausgezeichnet.
 */
export function answerFormatHint(answerType: AnswerType, roundTo?: number): string {
  switch (answerType) {
    case "integer":
      return (
        "Ganze Zahl. Ausdrücke sind erlaubt: 5!, combinations(10,3), 2^10 — " +
        "groß oder klein geschrieben. Kein LaTeX."
      );
    case "numeric":
      return roundTo === undefined
        ? "Dezimalzahl oder exakter Ausdruck, etwa 0,375 oder 3/8. Kein Prozentwert, kein LaTeX."
        : `Dezimalzahl, auf ${roundTo} Nachkommastellen gerundet. Kein Prozentwert, kein LaTeX.`;
    case "fraction":
      // Der Backslash muss im String verdoppelt werden — `\f` wäre ein Seitenvorschub.
      return (
        "Bruch mit Schrägstrich, etwa 69/420. Kein LaTeX: \\frac{69}{420} wird nicht gelesen. " +
        "Ausdrücke wie 1/3+1/12 sind erlaubt."
      );
    case "choice":
      return "Antwortkürzel eingeben.";
    default:
      return "";
  }
}
