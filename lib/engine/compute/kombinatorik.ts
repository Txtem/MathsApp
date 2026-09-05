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
 * ausdrücken, deshalb reicht die Registry sie als `k1` bis `k4` durch, wovon
 * die hinteren beiden optional sind — siehe DECISIONS.md, D-15.
 */
export function multisetPermutations(n: bigint, groups: readonly bigint[]): bigint {
  const sum = groups.reduce((total, size) => total + size, 0n);
  if (sum !== n) {
    throw new ExpressionError(`Die Gruppengrößen ergeben ${sum}, nicht ${n}.`);
  }
  return groups.reduce((total, size) => total / factorial(size), factorial(n));
}

/**
 * Permutationen der Buchstaben eines Wortes: `n! / (k₁! · k₂! · …)`, wobei die
 * `kᵢ` die Häufigkeiten der Buchstaben sind.
 *
 * Rechnet dasselbe wie `multisetPermutations`, bekommt die Gruppen aber nicht
 * gesagt, sondern zählt sie selbst. Genau das ist der Punkt: Ein Template kann
 * nur einen Skalar würfeln, und `constraints` kennen nur Zahlen — „die
 * Häufigkeiten in MISSISSIPPI sind 4, 4, 2, 1" lässt sich dort nicht ausdrücken.
 * Wort und Gruppengrößen wären als getrennte Parameter in fast jedem Wurf
 * inkonsistent. Kommt das Wort allein herein, ist die Kopplung geschenkt.
 *
 * Nebenwirkung: Die Grenze von zwei bis vier Gruppen aus D-15 gilt hier nicht.
 * Sie stammt aus der Signatur von `multisetPermutations`, nicht aus der Mathematik.
 */
export function letterPermutations(word: string): bigint {
  if (word.length === 0) throw new ExpressionError("Das Wort ist leer.");

  const counts = new Map<string, number>();
  for (const letter of word) counts.set(letter, (counts.get(letter) ?? 0) + 1);

  let result = factorial(BigInt(word.length));
  for (const count of counts.values()) result /= factorial(BigInt(count));
  return result;
}

/**
 * Zyklische Anordnungen: `(n - 1)!`.
 *
 * Am runden Tisch gibt es keine erste Position. Jede Sitzordnung fällt mit ihren
 * `n` Drehungen zusammen, also `n! / n`. Gleichwertig: eine Person festhalten und
 * die übrigen `n - 1` frei anordnen.
 *
 * Für `n = 0` ist der Ausdruck nicht definiert — es gibt keine Anordnung von
 * niemandem an einem Tisch, und `(-1)!` gibt es nicht.
 */
export function cyclicPermutations(n: bigint): bigint {
  if (n < 1n) throw new ExpressionError("An einem runden Tisch sitzt mindestens einer.");
  return factorial(n - 1n);
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
