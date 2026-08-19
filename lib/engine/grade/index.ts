import { ExpressionError, InvalidExpectedAnswerError, UnsupportedAnswerTypeError } from "../errors";
import { evaluate } from "../expr/evaluate";
import { formatNum, type Num, toNumber } from "../expr/numeric";
import { parseExpression } from "../expr/parse";
import * as Q from "../expr/rational";
import type { Rational } from "../expr/rational";
import type { AnswerType, GradeResult } from "../types";
import {
  equalsExact,
  equalsInteger,
  equalsRounded,
  toExpectedChoice,
  toExpectedRational,
} from "./compare";
import { normalizeChoice, normalizeInteger, normalizeNumeric } from "./normalize";

/**
 * Bewertung einer Nutzerantwort. Immer zweistufig: erst normalisieren, dann
 * vergleichen — nie ein direkter Stringvergleich.
 *
 * `120`, `5!` und `5*4*3*2*1` sind dieselbe Antwort. Eine nicht lesbare Eingabe
 * ist ausdrücklich nicht „falsch", sondern `{ ok: false, reason: "unparseable" }`.
 *
 * `set`, `tuple` und `text` sind nicht implementiert und werfen: Kein Normalizer
 * ohne Template, das ihn braucht (DECISIONS.md, D-07).
 */

export interface GradeOptions {
  /** Nur für `numeric`: Beide Seiten werden auf so viele Nachkommastellen gerundet. */
  readonly roundTo?: number;
}

/** Musterlösung: ein exakter Wert, seine Speicherform, oder bei `choice` eine ID. */
export type ExpectedAnswer = Rational | string;

export function grade(
  userInput: string,
  expected: ExpectedAnswer,
  type: AnswerType,
  options: GradeOptions = {},
): GradeResult {
  switch (type) {
    case "integer":
      return gradeInteger(userInput, expected);
    case "numeric":
      return gradeNumeric(userInput, expected, options.roundTo);
    case "fraction":
      return gradeFraction(userInput, expected);
    case "choice":
      return gradeChoice(userInput, expected);
    default:
      throw new UnsupportedAnswerTypeError(type);
  }
}

/** Wertet die Eingabe aus. `undefined` heißt: nicht lesbar, nicht „falsch". */
function evaluateInput(normalized: string): Num | undefined {
  try {
    // Leerer Scope: keine Variablen, keine Funktionsdefinitionen, nur die
    // Whitelist aus `expr/evaluate`.
    return evaluate(parseExpression(normalized), {});
  } catch (error) {
    if (error instanceof ExpressionError) return undefined;
    throw error;
  }
}

function unparseable(): GradeResult {
  return { ok: false, reason: "unparseable" };
}

function gradeInteger(userInput: string, expected: ExpectedAnswer): GradeResult {
  const target = toExpectedRational(expected);
  if (!Q.isInteger(target)) {
    throw new InvalidExpectedAnswerError(
      `Musterlösung ${Q.toStorageString(target)} ist bei answer_type "integer" keine Ganzzahl.`,
    );
  }

  let value: Num | undefined;
  try {
    value = evaluateInput(normalizeInteger(userInput));
  } catch (error) {
    if (error instanceof ExpressionError) return unparseable();
    throw error;
  }
  if (!value) return unparseable();

  return { ok: true, isCorrect: equalsInteger(value, target), normalized: formatNum(value) };
}

function gradeNumeric(
  userInput: string,
  expected: ExpectedAnswer,
  roundTo: number | undefined,
): GradeResult {
  const target = toExpectedRational(expected);

  const value = readNumeric(userInput);
  if (!value) return unparseable();

  if (roundTo === undefined) {
    const correct = equalsExact(value, target);
    return { ok: true, isCorrect: correct === true, normalized: formatNum(value) };
  }

  // Gerundet wird auf beiden Seiten. Ein genäherter Wert (Wurzel) wird dafür
  // auf dieselbe Stellenzahl gebracht — er ist danach wieder exakt vergleichbar.
  const exact = value.kind === "exact" ? value.value : signed(toNumber(value), roundTo);
  return {
    ok: true,
    isCorrect: equalsRounded(exact, target, roundTo),
    normalized: Q.toDecimalString(exact, roundTo),
  };
}

/** Genäherten Wert auf `digits` Stellen festklopfen — danach ist er wieder exakt. */
function signed(value: number, digits: number): Rational {
  const magnitude = Q.fromDecimalString(Math.abs(value).toFixed(digits));
  return value < 0 ? Q.neg(magnitude) : magnitude;
}

function gradeFraction(userInput: string, expected: ExpectedAnswer): GradeResult {
  const target = toExpectedRational(expected);

  const value = readNumeric(userInput);
  if (!value) return unparseable();

  // `Rational` ist immer gekürzt, deshalb ist Wertgleichheit hier dasselbe wie
  // „Zähler und Nenner stimmen": `2/4` und `1/2` sind derselbe Wert.
  const correct = equalsExact(value, target);
  return { ok: true, isCorrect: correct === true, normalized: formatNum(value) };
}

function readNumeric(userInput: string): Num | undefined {
  try {
    return evaluateInput(normalizeNumeric(userInput));
  } catch (error) {
    if (error instanceof ExpressionError) return undefined;
    throw error;
  }
}

function gradeChoice(userInput: string, expected: ExpectedAnswer): GradeResult {
  const target = toExpectedChoice(expected);

  let normalized: string;
  try {
    normalized = normalizeChoice(userInput);
  } catch (error) {
    if (error instanceof ExpressionError) return unparseable();
    throw error;
  }

  return {
    ok: true,
    isCorrect: normalized === normalizeChoice(target),
    normalized: userInput.trim(),
  };
}

export { normalizeChoice, normalizeInteger, normalizeNumeric } from "./normalize";
export { equalsInteger, toExpectedChoice, toExpectedRational } from "./compare";
