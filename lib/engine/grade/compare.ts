import { InvalidExpectedAnswerError } from "../errors";
import { asRational, type Num } from "../expr/numeric";
import * as Q from "../expr/rational";
import type { Rational } from "../expr/rational";

/**
 * Schritt 2 der Bewertung: vergleichen. Exakt über `Rational` — ein
 * `number`-Vergleich wäre ab `21!` still falsch und bei Brüchen ohnehin.
 */

/**
 * Liest die gespeicherte Musterlösung. Sie kommt entweder direkt aus der
 * Compute-Registry (`Rational`) oder als Speicherform aus der Datenbank
 * (`"41"`, `"3/8"`). Alles andere ist ein Serverfehler, keine Nutzereingabe.
 */
export function toExpectedRational(expected: unknown): Rational {
  if (typeof expected === "object" && expected !== null && "num" in expected && "den" in expected) {
    const { num, den } = expected;
    if (typeof num === "bigint" && typeof den === "bigint" && den !== 0n) {
      return Q.rational(num, den);
    }
    throw new InvalidExpectedAnswerError("Musterlösung ist kein gültiger Bruch.");
  }

  if (typeof expected === "bigint") return Q.fromBigInt(expected);

  if (typeof expected === "number") {
    if (!Number.isInteger(expected) || !Number.isSafeInteger(expected)) {
      throw new InvalidExpectedAnswerError(`Musterlösung ${expected} ist keine sichere Ganzzahl.`);
    }
    return Q.fromBigInt(BigInt(expected));
  }

  if (typeof expected === "string") {
    const parsed = Q.fromStorageString(expected);
    if (!parsed) {
      throw new InvalidExpectedAnswerError(`Musterlösung "${expected}" ist keine Zahl.`);
    }
    return parsed;
  }

  throw new InvalidExpectedAnswerError(
    `Musterlösung hat den Typ ${typeof expected}, erwartet wurde Rational oder string.`,
  );
}

/** Für `choice` ist die Musterlösung eine ID, keine Zahl. */
export function toExpectedChoice(expected: unknown): string {
  if (typeof expected === "string" && expected.trim() !== "") return expected;
  throw new InvalidExpectedAnswerError("Musterlösung für choice muss eine nicht-leere ID sein.");
}

/**
 * Exakter Wertevergleich. `undefined` heißt: Der Nutzerwert liegt nur genähert
 * vor (er enthält eine irrationale Wurzel) und lässt sich nicht exakt prüfen.
 */
export function equalsExact(actual: Num, expected: Rational): boolean | undefined {
  const value = asRational(actual);
  if (!value) return undefined;
  return Q.equals(value, expected);
}

/** Beide Seiten auf `digits` Stellen runden, dann exakt vergleichen. */
export function equalsRounded(actual: Rational, expected: Rational, digits: number): boolean {
  return Q.equals(Q.round(actual, digits), Q.round(expected, digits));
}

/** Ganzzahlvergleich: Der Wert muss exakt *und* nennerfrei sein. */
export function equalsInteger(actual: Num, expected: Rational): boolean {
  const value = asRational(actual);
  if (!value || !Q.isInteger(value)) return false;
  return Q.equals(value, expected);
}
