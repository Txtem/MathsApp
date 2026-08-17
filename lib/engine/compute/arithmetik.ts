/**
 * Grundrechenarten auf BigInt. Rein, ohne I/O, ohne Zod — die Validierung der
 * Eingaben passiert eine Ebene höher in der Registry.
 */

export function add(a: bigint, b: bigint): bigint {
  return a + b;
}

export function subtract(a: bigint, b: bigint): bigint {
  return a - b;
}
