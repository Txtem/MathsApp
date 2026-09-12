/**
 * Textbausteine für Lösungswege — die Anzeigewerte aus D-29.
 *
 * Getrennt von den Compute-Funktionen, weil hier nichts gerechnet wird: Diese
 * Datei formuliert nur, was die Rechnung ohnehin schon weiß. Rein und ohne
 * Abhängigkeit auf die Registry, damit sie für sich testbar bleibt.
 */

/** Der Nenner einer Permutation mit Wiederholung: `4! \cdot 4! \cdot 2!`. */
export function factorialProduct(counts: readonly number[]): string {
  if (counts.length === 0) return "1";
  return counts.map((count) => `${count}!`).join(" \\cdot ");
}

/**
 * Der gekürzte Nenner: `1!` ist eins und trägt nichts bei.
 *
 * Warum das nicht die einzige Form ist: Die volle Schreibweise zeigt, dass
 * **jede** Buchstabengruppe in den Nenner geht — das ist die Regel. Die kurze
 * ist das, was man in der Klausur hinschreibt. Der Lösungsweg zeigt beide, und
 * bei sechzig Sekunden Zielzeit ist die kurze die nützlichere.
 */
export function reducedFactorialProduct(counts: readonly number[]): string {
  return factorialProduct(counts.filter((count) => count > 1));
}

/**
 * Der Kürzungsschritt als fertiges LaTeX-Fragment — oder leer, wo er nichts
 * ändert.
 *
 * Als ein Wert und nicht als zwei, weil ein Template keine Bedingung ausdrücken
 * kann: `{{kuerzung}}` steht entweder da oder verschwindet spurlos.
 */
export function reductionStep(n: number, counts: readonly number[]): string {
  const full = factorialProduct(counts);
  const reduced = reducedFactorialProduct(counts);
  return full === reduced ? "" : `= \\frac{ ${n}! }{ ${reduced} } `;
}

const ZAHLWORT: Readonly<Record<number, string>> = {
  2: "zweimal",
  3: "dreimal",
  4: "viermal",
  5: "fünfmal",
  6: "sechsmal",
  7: "siebenmal",
  8: "achtmal",
  9: "neunmal",
  10: "zehnmal",
};

/** `2` → „zweimal". Darüber hinaus ziffernweise, das liest sich besser als „vierzehnmal". */
export function timesWord(count: number): string {
  return ZAHLWORT[count] ?? `${count}-mal`;
}

/**
 * Die Wiederholungen im Klartext: „T zweimal" oder „I viermal, S viermal,
 * P zweimal".
 *
 * Nur die Buchstaben, die mehr als einmal vorkommen — die einmaligen stehen
 * ohnehin im Wort und tragen zur Rechnung nichts bei.
 */
export function repeatedLetters(groups: readonly (readonly [string, number])[]): string {
  const wiederholt = groups.filter(([, count]) => count > 1);
  if (wiederholt.length === 0) return "kein Buchstabe doppelt";
  return wiederholt.map(([letter, count]) => `${letter} ${timesWord(count)}`).join(", ");
}
