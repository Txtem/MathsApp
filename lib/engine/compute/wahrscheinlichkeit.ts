import { ExpressionError } from "../errors";
import { binomial } from "../expr/bigmath";
import * as Q from "../expr/rational";
import type { Rational } from "../expr/rational";

/**
 * Wahrscheinlichkeiten als exakte Brüche.
 *
 * Hier zahlt sich `Rational` aus: `C(6,2)·C(43,4) / C(49,6)` ist ein Bruch mit
 * großem Zähler und Nenner. In `float64` wäre der Vergleich mit der
 * Nutzerantwort schon in der vierten Nachkommastelle Glückssache.
 *
 * Bezeichner nach der üblichen Schreibweise der hypergeometrischen Verteilung:
 * `population` = N, `successes` = K, `draws` = n, `hits` = k.
 */

function ensureConsistent(population: bigint, successes: bigint, draws: bigint): void {
  if (population <= 0n) throw new ExpressionError("Die Grundgesamtheit muss positiv sein.");
  if (successes > population) {
    throw new ExpressionError("Es kann nicht mehr Treffer als Elemente geben.");
  }
  if (draws > population) {
    throw new ExpressionError("Es lassen sich nicht mehr Elemente ziehen, als vorhanden sind.");
  }
}

/** `P(X = k)` — genau `hits` Treffer bei `draws` Zügen ohne Zurücklegen. */
export function hypergeometricExactly(
  population: bigint,
  successes: bigint,
  draws: bigint,
  hits: bigint,
): Rational {
  ensureConsistent(population, successes, draws);
  const favourable = binomial(successes, hits) * binomial(population - successes, draws - hits);
  return Q.rational(favourable, binomial(population, draws));
}

/**
 * `P(X >= 1)` — mindestens ein Treffer, über das Gegenereignis:
 * `1 - C(N-K, n) / C(N, n)`.
 */
export function hypergeometricAtLeastOne(
  population: bigint,
  successes: bigint,
  draws: bigint,
): Rational {
  ensureConsistent(population, successes, draws);
  const withoutHit = Q.rational(binomial(population - successes, draws), binomial(population, draws));
  return Q.sub(Q.ONE, withoutHit);
}
