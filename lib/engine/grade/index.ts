import { ExpressionError, UnsupportedAnswerTypeError } from "../errors";
import { evaluate } from "../expr/evaluate";
import { formatNum } from "../expr/numeric";
import { parseExpression } from "../expr/parse";
import type { AnswerType, GradeResult } from "../types";
import { equalsInteger, toExpectedInteger } from "./compare";
import { normalizeInteger } from "./normalize";

/**
 * Bewertung einer Nutzerantwort. Immer zweistufig: erst normalisieren, dann
 * vergleichen — nie ein direkter Stringvergleich.
 *
 * `120`, `5!` und `5*4*3*2*1` sind dieselbe Antwort. Eine nicht lesbare Eingabe
 * ist ausdrücklich nicht „falsch", sondern `{ ok: false, reason: "unparseable" }`.
 *
 * M0 implementiert nur `integer`. Die übrigen Typen kommen in M1 und werfen
 * bis dahin, statt still etwas Falsches zu behaupten.
 */
export function grade(userInput: string, expected: unknown, type: AnswerType): GradeResult {
  switch (type) {
    case "integer":
      return gradeInteger(userInput, expected);
    default:
      throw new UnsupportedAnswerTypeError(type);
  }
}

function gradeInteger(userInput: string, expected: unknown): GradeResult {
  // Zuerst: Ist die Musterlösung überhaupt eine Ganzzahl? Wenn nicht, ist das ein
  // Serverfehler und darf nicht als „Antwort falsch" beim Nutzer landen.
  const expectedInteger = toExpectedInteger(expected);

  try {
    // Der Scope ist leer: keine Variablen, keine Funktionsdefinitionen,
    // nur die Whitelist aus `expr/evaluate`.
    const value = evaluate(parseExpression(normalizeInteger(userInput)), {});
    return { ok: true, isCorrect: equalsInteger(value, expectedInteger), normalized: formatNum(value) };
  } catch (error) {
    if (error instanceof ExpressionError) return { ok: false, reason: "unparseable" };
    throw error;
  }
}

export { normalizeInteger } from "./normalize";
export { equalsInteger, toExpectedInteger } from "./compare";
