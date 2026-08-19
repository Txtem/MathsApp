import { describe, expect, it } from "vitest";

import { ExpressionError } from "../errors";
import { binomial } from "../expr/bigmath";
import * as Q from "../expr/rational";
import { toStorageString } from "../expr/rational";
import { registry } from "./registry";
import { hypergeometricAtLeastOne, hypergeometricExactly } from "./wahrscheinlichkeit";

const s = (value: { num: bigint; den: bigint }) => toStorageString(value);

describe("hypergeometricExactly — P(X = k)", () => {
  const cases: ReadonlyArray<readonly [string, bigint, bigint, bigint, bigint, string]> = [
    ["Sechser im Lotto", 49n, 6n, 6n, 6n, "1/13983816"],
    ["kein Richtiger im Lotto", 49n, 6n, 6n, 0n, "435461/998844"],
    ["zwei Asse aus dem Skatblatt", 32n, 4n, 5n, 2n, "351/3596"],
    ["kleine Urne, ein Treffer", 10n, 3n, 2n, 1n, "7/15"],
    ["kleine Urne, kein Treffer", 10n, 3n, 2n, 0n, "7/15"],
    ["kleine Urne, zwei Treffer", 10n, 3n, 2n, 2n, "1/15"],
    ["alle Kugeln gezogen", 5n, 2n, 5n, 2n, "1"],
    ["keine Treffer in der Urne", 10n, 0n, 3n, 0n, "1"],
  ];

  it.each(cases)("%s", (_name, population, successes, draws, hits, expected) => {
    expect(s(hypergeometricExactly(population, successes, draws, hits))).toBe(expected);
  });

  it("summiert sich über alle k zu 1", () => {
    // Die stärkste Probe für eine Verteilung: Ohne exakte Brüche würde das
    // in der letzten Stelle danebenliegen.
    for (const [population, successes, draws] of [
      [49n, 6n, 6n],
      [32n, 4n, 5n],
      [10n, 3n, 3n],
    ] as const) {
      let total = Q.ZERO;
      for (let hits = 0n; hits <= successes && hits <= draws; hits++) {
        if (draws - hits > population - successes) continue;
        total = Q.add(total, hypergeometricExactly(population, successes, draws, hits));
      }
      expect(s(total), `N=${population}`).toBe("1");
    }
  });

  it("liegt immer zwischen 0 und 1", () => {
    for (let hits = 0n; hits <= 4n; hits++) {
      const p = hypergeometricExactly(32n, 4n, 5n, hits);
      expect(Q.compare(p, Q.ZERO)).toBeGreaterThanOrEqual(0);
      expect(Q.compare(p, Q.ONE)).toBeLessThanOrEqual(0);
    }
  });

  it("wehrt unmögliche Aufbauten ab", () => {
    expect(() => hypergeometricExactly(10n, 12n, 3n, 1n)).toThrow(ExpressionError);
    expect(() => hypergeometricExactly(10n, 3n, 12n, 1n)).toThrow(ExpressionError);
    expect(() => hypergeometricExactly(0n, 0n, 1n, 0n)).toThrow(ExpressionError);
  });
});

describe("hypergeometricAtLeastOne — P(X >= 1)", () => {
  const cases: ReadonlyArray<readonly [bigint, bigint, bigint, string]> = [
    [10n, 3n, 2n, "8/15"],
    [49n, 6n, 6n, "563383/998844"],
    [32n, 4n, 5n, "1841/3596"],
    [10n, 0n, 3n, "0"], // keine Treffer in der Urne
    [10n, 10n, 1n, "1"], // nur Treffer in der Urne
    [5n, 1n, 5n, "1"], // alles gezogen
  ];

  it.each(cases)("N=%s, K=%s, n=%s → %s", (population, successes, draws, expected) => {
    expect(s(hypergeometricAtLeastOne(population, successes, draws))).toBe(expected);
  });

  it("ist das Gegenereignis zu P(X = 0)", () => {
    for (const [population, successes, draws] of [
      [49n, 6n, 6n],
      [32n, 4n, 5n],
      [20n, 7n, 4n],
    ] as const) {
      const none = hypergeometricExactly(population, successes, draws, 0n);
      const some = hypergeometricAtLeastOne(population, successes, draws);
      expect(s(Q.add(none, some))).toBe("1");
    }
  });

  it("rechnet mit großen Zahlen exakt", () => {
    // Nenner C(1000,5) hat 13 Stellen; als float64 wäre das Ergebnis gerundet.
    const p = hypergeometricAtLeastOne(1000n, 3n, 5n);
    expect(p.den).toBe(binomial(1000n, 5n) / (binomial(1000n, 5n) / p.den));
    expect(Q.compare(p, Q.ZERO)).toBe(1);
    expect(Q.compare(p, Q.ONE)).toBe(-1);
  });
});

describe("Über die Registry", () => {
  it("prüft die Beziehungen der Parameter im Zod-Schema", () => {
    const genau = registry["wahrscheinlichkeit.hypergeometrisch.genau"];
    expect(genau.run({ population: 49, successes: 6, draws: 6, hits: 6 })).toBeDefined();
    // mehr Treffer verlangt, als es in der Urne gibt
    expect(genau.run({ population: 49, successes: 6, draws: 6, hits: 7 })).toBeUndefined();
    // mehr gezogen, als vorhanden ist
    expect(genau.run({ population: 10, successes: 3, draws: 11, hits: 1 })).toBeUndefined();
    // mehr Treffer in der Urne als Elemente
    expect(genau.run({ population: 10, successes: 11, draws: 2, hits: 1 })).toBeUndefined();
    // Nieten reichen nicht: draws - hits > population - successes
    expect(genau.run({ population: 10, successes: 8, draws: 5, hits: 2 })).toBeUndefined();
  });

  it("liefert einen gekürzten Bruch als Ergebnis", () => {
    const result = registry["wahrscheinlichkeit.hypergeometrisch.genau"].run({
      population: 10,
      successes: 3,
      draws: 2,
      hits: 1,
    });
    expect(result && toStorageString(result)).toBe("7/15");
  });
});
