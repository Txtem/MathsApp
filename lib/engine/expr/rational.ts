import { ExpressionError } from "../errors";

/**
 * Exakte Rationalzahl: gekürzt, Nenner immer positiv.
 *
 * Ab der hypergeometrischen Verteilung sind Ergebnisse Brüche. In `float64`
 * gerechnet wäre der Vergleich wieder ungenau — genau der Grund, aus dem
 * `mathjs` verworfen wurde. Siehe DECISIONS.md, D-06.
 *
 * `integer` ist hier kein eigener Typ, sondern der Fall `den === 1n`.
 */
export interface Rational {
  readonly num: bigint;
  readonly den: bigint;
}

/** Schutz gegen Eingaben, die nur Rechenzeit verbrennen sollen. */
export const MAX_POW_EXPONENT = 4096n;
const MAX_DECIMAL_EXPONENT = 4096n;

export const ZERO: Rational = { num: 0n, den: 1n };
export const ONE: Rational = { num: 1n, den: 1n };

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const rest = x % y;
    x = y;
    y = rest;
  }
  return x;
}

/** Einziger Konstruktor: kürzt und normalisiert das Vorzeichen auf den Zähler. */
export function rational(num: bigint, den: bigint = 1n): Rational {
  if (den === 0n) throw new ExpressionError("Division durch null.");
  const sign = den < 0n ? -1n : 1n;
  const n = sign * num;
  const d = sign * den;
  const g = gcd(n, d);
  if (g === 0n) return ZERO;
  return { num: n / g, den: d / g };
}

export function fromBigInt(value: bigint): Rational {
  return { num: value, den: 1n };
}

export function isInteger(r: Rational): boolean {
  return r.den === 1n;
}

export function isZero(r: Rational): boolean {
  return r.num === 0n;
}

export function add(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function sub(a: Rational, b: Rational): Rational {
  return rational(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function mul(a: Rational, b: Rational): Rational {
  return rational(a.num * b.num, a.den * b.den);
}

export function div(a: Rational, b: Rational): Rational {
  if (isZero(b)) throw new ExpressionError("Division durch null.");
  return rational(a.num * b.den, a.den * b.num);
}

export function neg(a: Rational): Rational {
  return { num: -a.num, den: a.den };
}

export function abs(a: Rational): Rational {
  return a.num < 0n ? neg(a) : a;
}

export function pow(base: Rational, exponent: bigint): Rational {
  const magnitude = exponent < 0n ? -exponent : exponent;
  if (magnitude > MAX_POW_EXPONENT) {
    throw new ExpressionError(`Exponent nur bis ${MAX_POW_EXPONENT} erlaubt.`);
  }
  if (exponent < 0n) {
    if (isZero(base)) throw new ExpressionError("Division durch null.");
    return rational(base.den ** magnitude, base.num ** magnitude);
  }
  return rational(base.num ** magnitude, base.den ** magnitude);
}

/** -1, 0 oder 1. Über Kreuzmultiplikation, also ohne jeden Genauigkeitsverlust. */
export function compare(a: Rational, b: Rational): -1 | 0 | 1 {
  const left = a.num * b.den;
  const right = b.num * a.den;
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

export function equals(a: Rational, b: Rational): boolean {
  return a.num === b.num && a.den === b.den;
}

/**
 * Kaufmännisch gerundet auf `digits` Nachkommastellen: die Hälfte geht vom
 * Nullpunkt weg (0.5 → 1, -0.5 → -1). Das ist die Rundung, die in der Schule
 * gelehrt wird — und die einzige, die zu `round_to` in den Templates passt.
 */
export function round(value: Rational, digits: number): Rational {
  if (!Number.isInteger(digits) || digits < 0 || digits > 15) {
    throw new ExpressionError(`round_to muss zwischen 0 und 15 liegen, war ${digits}.`);
  }
  const scale = 10n ** BigInt(digits);
  const sign = value.num < 0n ? -1n : 1n;
  const scaled = sign * value.num * scale;
  const rounded = (2n * scaled + value.den) / (2n * value.den);
  return rational(sign * rounded, scale);
}

/**
 * Speicher- und Anzeigeform: `"41"` für ganze Zahlen, sonst `"3/8"`.
 * Genau diese Form landet in `Attempt.expectedAnswer`.
 */
export function toStorageString(value: Rational): string {
  return isInteger(value) ? value.num.toString() : `${value.num}/${value.den}`;
}

/** Gegenstück zu `toStorageString`. `undefined`, wenn der Text keine Zahl ist. */
export function fromStorageString(text: string): Rational | undefined {
  const match = /^(-?\d+)(?:\/(\d+))?$/.exec(text.trim());
  if (!match) return undefined;
  const [, numerator, denominator] = match;
  if (numerator === undefined) return undefined;
  if (denominator === undefined) return fromBigInt(BigInt(numerator));
  if (denominator === "0") return undefined;
  return rational(BigInt(numerator), BigInt(denominator));
}

/**
 * Dezimalliteral → exakter Bruch, verlustfrei: `2.5` → `5/2`,
 * `0.0177` → `177/10000`, `2.5e3` → `2500`.
 */
export function fromDecimalString(text: string): Rational {
  const match = /^(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) throw new ExpressionError(`Ungültige Zahl: "${text}".`);

  const [, whole = "", fraction = "", exponentText] = match;
  const digits = `${whole}${fraction}`;
  if (digits === "") throw new ExpressionError(`Ungültige Zahl: "${text}".`);

  const exponent = BigInt(exponentText ?? "0") - BigInt(fraction.length);
  const magnitude = exponent < 0n ? -exponent : exponent;
  if (magnitude > MAX_DECIMAL_EXPONENT) throw new ExpressionError(`Zahl zu groß: "${text}".`);

  const mantissa = BigInt(digits);
  return exponent >= 0n
    ? fromBigInt(mantissa * 10n ** exponent)
    : rational(mantissa, 10n ** magnitude);
}

/** Feste Nachkommastellen, gerundet — für die Anzeige bei `round_to`. */
export function toDecimalString(value: Rational, digits: number): string {
  const rounded = round(value, digits);
  const negative = rounded.num < 0n;
  const scaled = (negative ? -rounded.num : rounded.num) * (10n ** BigInt(digits)) / rounded.den;
  const text = scaled.toString().padStart(digits + 1, "0");
  const cut = text.length - digits;
  const body = digits === 0 ? text : `${text.slice(0, cut)}.${text.slice(cut)}`;
  return negative && scaled !== 0n ? `-${body}` : body;
}

/** Näherung als `number` — ausschließlich für Vergleiche mit inexakten Werten. */
export function toNumber(value: Rational): number {
  const direct = Number(value.num) / Number(value.den);
  if (Number.isFinite(direct) && !Number.isNaN(direct)) return direct;
  return Number(toDecimalString(value, 15));
}
