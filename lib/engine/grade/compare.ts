import { InvalidExpectedAnswerError } from "../errors";
import { asExactInteger, type Num } from "../expr/numeric";
import { parseNumberLiteral } from "../expr/tokenize";

/**
 * Schritt 2 der Bewertung: vergleichen. Für Ganzzahlen exakt über `BigInt` —
 * ein `number`-Vergleich wäre ab `21!` still falsch.
 */

/**
 * Liest die gespeicherte Musterlösung. Sie kommt aus der Compute-Registry und
 * ist deshalb ein Dezimalstring; ein `number` wird der Bequemlichkeit halber
 * akzeptiert, alles andere ist ein Serverfehler.
 */
export function toExpectedInteger(expected: unknown): bigint {
  if (typeof expected === "bigint") return expected;

  if (typeof expected === "number") {
    if (!Number.isInteger(expected) || !Number.isSafeInteger(expected)) {
      throw new InvalidExpectedAnswerError(`Musterlösung ${expected} ist keine sichere Ganzzahl.`);
    }
    return BigInt(expected);
  }

  if (typeof expected === "string") {
    const text = expected.trim();
    const negative = text.startsWith("-");
    const digits = negative ? text.slice(1) : text;
    if (!/^\d+$/.test(digits)) {
      throw new InvalidExpectedAnswerError(`Musterlösung "${expected}" ist keine Ganzzahl.`);
    }
    const value = parseNumberLiteral(digits);
    const asInteger = asExactInteger(value);
    if (asInteger === undefined) {
      throw new InvalidExpectedAnswerError(`Musterlösung "${expected}" ist keine Ganzzahl.`);
    }
    return negative ? -asInteger : asInteger;
  }

  throw new InvalidExpectedAnswerError(
    `Musterlösung hat den Typ ${typeof expected}, erwartet wurde string oder number.`,
  );
}

/** True, wenn der ausgewertete Nutzerwert exakt der Musterlösung entspricht. */
export function equalsInteger(actual: Num, expected: bigint): boolean {
  const asInteger = asExactInteger(actual);
  return asInteger !== undefined && asInteger === expected;
}
