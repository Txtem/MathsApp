import { ExpressionError } from "../errors";

/**
 * Exakte Ganzzahlfunktionen auf BigInt. Rein, ohne I/O.
 *
 * Die Obergrenzen sind kein Rechenlimit, sondern ein Schutz gegen Eingaben, die
 * den Server beschäftigen sollen: `100000!` hat über 450.000 Stellen.
 */

export const MAX_FACTORIAL_INPUT = 2000n;
export const MAX_POW_EXPONENT = 4096n;

export function factorial(n: bigint): bigint {
  if (n < 0n) throw new ExpressionError("Fakultät ist für negative Zahlen nicht definiert.");
  if (n > MAX_FACTORIAL_INPUT) {
    throw new ExpressionError(`Fakultät nur bis ${MAX_FACTORIAL_INPUT} erlaubt.`);
  }
  let acc = 1n;
  for (let i = 2n; i <= n; i++) acc *= i;
  return acc;
}

/** Binomialkoeffizient „n über k". Multiplikativ statt über drei Fakultäten. */
export function binomial(n: bigint, k: bigint): bigint {
  if (n < 0n || k < 0n) throw new ExpressionError("combinations erwartet nicht-negative Zahlen.");
  if (k > n) return 0n;
  const kk = k > n - k ? n - k : k;
  let acc = 1n;
  for (let i = 1n; i <= kk; i++) {
    // Die Division geht in jedem Schritt exakt auf: acc ist stets ein Binomialkoeffizient.
    acc = (acc * (n - kk + i)) / i;
  }
  return acc;
}

/** Variationen ohne Wiederholung: n · (n-1) · … · (n-k+1). */
export function permutations(n: bigint, k: bigint): bigint {
  if (n < 0n || k < 0n) throw new ExpressionError("permutations erwartet nicht-negative Zahlen.");
  if (k > n) return 0n;
  if (k > MAX_FACTORIAL_INPUT) {
    throw new ExpressionError(`permutations nur bis k = ${MAX_FACTORIAL_INPUT} erlaubt.`);
  }
  let acc = 1n;
  for (let i = 0n; i < k; i++) acc *= n - i;
  return acc;
}

export function power(base: bigint, exponent: bigint): bigint {
  if (exponent < 0n) throw new ExpressionError("Negative Exponenten liefern keine Ganzzahl.");
  if (exponent > MAX_POW_EXPONENT) {
    throw new ExpressionError(`Exponent nur bis ${MAX_POW_EXPONENT} erlaubt.`);
  }
  return base ** exponent;
}

/** Exakte Ganzzahlwurzel, oder `undefined`, wenn `n` keine Quadratzahl ist. */
export function exactSqrt(n: bigint): bigint | undefined {
  if (n < 0n) return undefined;
  if (n < 2n) return n;
  // Newton-Iteration; konvergiert für BigInt in wenigen Schritten.
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x * x === n ? x : undefined;
}
