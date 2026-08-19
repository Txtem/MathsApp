import { ExpressionError } from "../errors";
import { binomial, factorial } from "../expr/bigmath";

/**
 * Kombinatorik auf `BigInt`. Rein, ohne Zod — die Eingaben prüft eine Ebene
 * höher die Registry.
 *
 * Was sich direkt aus `bigmath` ergibt (`n!`, `C(n,k)`, `n·(n-1)·…·(n-k+1)`),
 * steht dort und wird hier nicht noch einmal geschrieben.
 */

/**
 * Permutationen mit Wiederholung: `n! / (k₁! · k₂! · … )`.
 *
 * Die Gruppengrößen kommen als Liste herein. Templates können keine Listen
 * ausdrücken, deshalb reicht die Registry drei einzelne Parameter durch —
 * siehe DECISIONS.md, D-13.
 */
export function multisetPermutations(n: bigint, groups: readonly bigint[]): bigint {
  const sum = groups.reduce((total, size) => total + size, 0n);
  if (sum !== n) {
    throw new ExpressionError(`Die Gruppengrößen ergeben ${sum}, nicht ${n}.`);
  }
  return groups.reduce((total, size) => total / factorial(size), factorial(n));
}

/** Kombinationen mit Wiederholung: `C(n + k - 1, k)`. */
export function combinationsWithRepetition(n: bigint, k: bigint): bigint {
  // Nichts zu ziehen gibt genau eine Möglichkeit — auch aus der leeren Menge.
  if (k === 0n) return 1n;
  if (n <= 0n) throw new ExpressionError("Aus einer leeren Menge lässt sich nichts ziehen.");
  return binomial(n + k - 1n, k);
}

/**
 * Verteilungen: `n` nicht unterscheidbare Objekte auf `k` unterscheidbare
 * Fächer, Fächer dürfen leer bleiben — `C(n + k - 1, k - 1)`. Stars and Bars.
 */
export function distributions(n: bigint, k: bigint): bigint {
  if (k <= 0n) throw new ExpressionError("Es braucht mindestens ein Fach.");
  return binomial(n + k - 1n, k - 1n);
}
