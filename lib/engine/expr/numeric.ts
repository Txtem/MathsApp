import { ExpressionError } from "../errors";
import { exactSqrt, factorial } from "./bigmath";
import * as Q from "./rational";
import type { Rational } from "./rational";

/**
 * Zahlwert der Engine.
 *
 * Der Normalfall ist `exact`: ein gekürzter Bruch, mit dem ohne jeden
 * Genauigkeitsverlust gerechnet und verglichen wird. `inexact` entsteht
 * ausschließlich dort, wo das Ergebnis irrational ist — praktisch nur bei
 * `sqrt` — und ist im Typ als solches markiert, damit niemand versehentlich
 * eine Bewertung darauf stützt. Siehe DECISIONS.md, D-06.
 */
export type Num =
  | { readonly kind: "exact"; readonly value: Rational }
  | { readonly kind: "inexact"; readonly value: number };

export function exactNum(value: Rational): Num {
  return { kind: "exact", value };
}

export function intNum(value: bigint): Num {
  return exactNum(Q.fromBigInt(value));
}

export function ratioNum(num: bigint, den: bigint): Num {
  return exactNum(Q.rational(num, den));
}

export function inexactNum(value: number): Num {
  if (!Number.isFinite(value)) throw new ExpressionError("Ergebnis ist nicht endlich.");
  return { kind: "inexact", value };
}

/**
 * `number` → exakter Wert. Ganzzahlen direkt, alles andere über die
 * Dezimaldarstellung. Das Vorzeichen wird hier behandelt: Der Zahlparser kennt
 * keins, weil im Ausdruck das unäre Minus ein eigener Knoten ist.
 */
export function fromNumber(value: number): Num {
  if (Number.isInteger(value) && Number.isSafeInteger(value)) return intNum(BigInt(value));
  const magnitude = Q.fromDecimalString(String(Math.abs(value)));
  return exactNum(value < 0 ? Q.neg(magnitude) : magnitude);
}

export function toNumber(n: Num): number {
  return n.kind === "exact" ? Q.toNumber(n.value) : n.value;
}

/** Der exakte Bruch, oder `undefined`, wenn der Wert nur noch genähert vorliegt. */
export function asRational(n: Num): Rational | undefined {
  return n.kind === "exact" ? n.value : undefined;
}

/** Der Wert als exakte Ganzzahl, oder `undefined`, wenn er keine ist. */
export function asExactInteger(n: Num): bigint | undefined {
  if (n.kind !== "exact") return undefined;
  return Q.isInteger(n.value) ? n.value.num : undefined;
}

/** Anzeigeform: `"41"`, `"3/8"` oder die Näherung eines irrationalen Werts. */
export function formatNum(n: Num): string {
  return n.kind === "exact" ? Q.toStorageString(n.value) : String(n.value);
}

/**
 * Sobald ein Operand genähert ist, ist es das Ergebnis auch. Deshalb wird die
 * Ungenauigkeit hier weitergereicht und nicht stillschweigend „geheilt".
 */
function lift(
  a: Num,
  b: Num,
  exact: (x: Rational, y: Rational) => Rational,
  approximate: (x: number, y: number) => number,
): Num {
  if (a.kind === "exact" && b.kind === "exact") return exactNum(exact(a.value, b.value));
  return inexactNum(approximate(toNumber(a), toNumber(b)));
}

export function addNum(a: Num, b: Num): Num {
  return lift(a, b, Q.add, (x, y) => x + y);
}

export function subNum(a: Num, b: Num): Num {
  return lift(a, b, Q.sub, (x, y) => x - y);
}

export function mulNum(a: Num, b: Num): Num {
  return lift(a, b, Q.mul, (x, y) => x * y);
}

export function divNum(a: Num, b: Num): Num {
  if (b.kind === "inexact" && b.value === 0) throw new ExpressionError("Division durch null.");
  return lift(a, b, Q.div, (x, y) => x / y);
}

export function powNum(a: Num, b: Num): Num {
  const exponent = asExactInteger(b);
  if (a.kind === "exact" && exponent !== undefined) return exactNum(Q.pow(a.value, exponent));
  return inexactNum(Math.pow(toNumber(a), toNumber(b)));
}

export function negNum(a: Num): Num {
  return a.kind === "exact" ? exactNum(Q.neg(a.value)) : inexactNum(-a.value);
}

export function absNum(a: Num): Num {
  return a.kind === "exact" ? exactNum(Q.abs(a.value)) : inexactNum(Math.abs(a.value));
}

export function factorialNum(a: Num): Num {
  const n = asExactInteger(a);
  if (n === undefined) throw new ExpressionError("Fakultät ist nur für Ganzzahlen definiert.");
  return intNum(factorial(n));
}

/** Quadratzahlen bleiben exakt; alles andere ist irrational und wird markiert. */
export function sqrtNum(a: Num): Num {
  const value = toNumber(a);
  if (a.kind === "exact") {
    if (a.value.num < 0n) throw new ExpressionError("Wurzel aus einer negativen Zahl.");
    const num = exactSqrt(a.value.num);
    const den = exactSqrt(a.value.den);
    if (num !== undefined && den !== undefined) return ratioNum(num, den);
  } else if (value < 0) {
    throw new ExpressionError("Wurzel aus einer negativen Zahl.");
  }
  return inexactNum(Math.sqrt(value));
}

/** -1, 0 oder 1. Exakt, solange beide Seiten exakt sind. */
export function compareNum(a: Num, b: Num): -1 | 0 | 1 {
  if (a.kind === "exact" && b.kind === "exact") return Q.compare(a.value, b.value);
  const x = toNumber(a);
  const y = toNumber(b);
  if (x < y) return -1;
  return x > y ? 1 : 0;
}
