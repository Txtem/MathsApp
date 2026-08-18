import { ExpressionError } from "../errors";
import { exactSqrt, factorial, power } from "./bigmath";

/**
 * Zahlwert der Engine.
 *
 * Solange alles ganzzahlig bleibt, wird exakt über BigInt gerechnet — das ist
 * die Voraussetzung dafür, dass `20!` beim Vergleich noch stimmt. Erst wenn ein
 * Bruch entsteht, der nicht aufgeht, fällt der Wert auf `number` zurück.
 */
export type Num =
  | { readonly kind: "int"; readonly value: bigint }
  | { readonly kind: "float"; readonly value: number };

export function intNum(value: bigint): Num {
  return { kind: "int", value };
}

export function floatNum(value: number): Num {
  if (!Number.isFinite(value)) throw new ExpressionError("Ergebnis ist nicht endlich.");
  return { kind: "float", value };
}

/** Ganzzahlige `number` werden zu `int` — sonst wäre `2 * 3.0` unnötig ungenau. */
export function fromNumber(value: number): Num {
  if (Number.isInteger(value) && Number.isSafeInteger(value)) return intNum(BigInt(value));
  return floatNum(value);
}

export function toNumber(n: Num): number {
  return n.kind === "int" ? Number(n.value) : n.value;
}

/**
 * Der Wert als exakte Ganzzahl, oder `undefined`, wenn er keine ist.
 * `float` wird akzeptiert, wenn er ganzzahlig und sicher darstellbar ist.
 */
export function asExactInteger(n: Num): bigint | undefined {
  if (n.kind === "int") return n.value;
  if (Number.isInteger(n.value) && Number.isSafeInteger(n.value)) return BigInt(n.value);
  return undefined;
}

export function formatNum(n: Num): string {
  return n.kind === "int" ? n.value.toString() : String(n.value);
}

function bothInt(a: Num, b: Num): { a: bigint; b: bigint } | undefined {
  return a.kind === "int" && b.kind === "int" ? { a: a.value, b: b.value } : undefined;
}

export function addNum(a: Num, b: Num): Num {
  const ints = bothInt(a, b);
  return ints ? intNum(ints.a + ints.b) : floatNum(toNumber(a) + toNumber(b));
}

export function subNum(a: Num, b: Num): Num {
  const ints = bothInt(a, b);
  return ints ? intNum(ints.a - ints.b) : floatNum(toNumber(a) - toNumber(b));
}

export function mulNum(a: Num, b: Num): Num {
  const ints = bothInt(a, b);
  return ints ? intNum(ints.a * ints.b) : floatNum(toNumber(a) * toNumber(b));
}

/** Ganzzahlig bleibt es nur, wenn die Division aufgeht. */
export function divNum(a: Num, b: Num): Num {
  const ints = bothInt(a, b);
  if (ints) {
    if (ints.b === 0n) throw new ExpressionError("Division durch null.");
    if (ints.a % ints.b === 0n) return intNum(ints.a / ints.b);
    return floatNum(Number(ints.a) / Number(ints.b));
  }
  const divisor = toNumber(b);
  if (divisor === 0) throw new ExpressionError("Division durch null.");
  return floatNum(toNumber(a) / divisor);
}

export function powNum(a: Num, b: Num): Num {
  const ints = bothInt(a, b);
  if (ints && ints.b >= 0n) return intNum(power(ints.a, ints.b));
  return floatNum(Math.pow(toNumber(a), toNumber(b)));
}

export function negNum(a: Num): Num {
  return a.kind === "int" ? intNum(-a.value) : floatNum(-a.value);
}

export function absNum(a: Num): Num {
  return a.kind === "int" ? intNum(a.value < 0n ? -a.value : a.value) : floatNum(Math.abs(a.value));
}

export function factorialNum(a: Num): Num {
  const n = asExactInteger(a);
  if (n === undefined) throw new ExpressionError("Fakultät ist nur für Ganzzahlen definiert.");
  return intNum(factorial(n));
}

/** Quadratzahlen bleiben exakt, alles andere wird zu `float`. */
export function sqrtNum(a: Num): Num {
  if (a.kind === "int") {
    if (a.value < 0n) throw new ExpressionError("Wurzel aus einer negativen Zahl.");
    const root = exactSqrt(a.value);
    if (root !== undefined) return intNum(root);
    return floatNum(Math.sqrt(Number(a.value)));
  }
  if (a.value < 0) throw new ExpressionError("Wurzel aus einer negativen Zahl.");
  return floatNum(Math.sqrt(a.value));
}

/** -1, 0 oder 1. Zwischen `int` und `float` wird über `number` verglichen. */
export function compareNum(a: Num, b: Num): -1 | 0 | 1 {
  const ints = bothInt(a, b);
  if (ints) {
    if (ints.a < ints.b) return -1;
    return ints.a > ints.b ? 1 : 0;
  }
  const x = toNumber(a);
  const y = toNumber(b);
  if (x < y) return -1;
  return x > y ? 1 : 0;
}
