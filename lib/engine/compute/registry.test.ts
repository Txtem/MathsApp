import { describe, expect, it } from "vitest";

import { isInteger, toStorageString } from "../expr/rational";
import { type ComputeRef, isComputeRef, registry } from "./registry";

/** Für jeden Eintrag ein Satz gültiger Parameter plus das erwartete Ergebnis. */
const EXAMPLES: ReadonlyArray<readonly [ComputeRef, Record<string, number | string>, string]> = [
  ["arithmetik.add", { a: 12, b: 30 }, "42"],
  ["arithmetik.subtract", { a: 12, b: 30 }, "-18"],
  ["kombinatorik.permutation.factorial", { n: 5 }, "120"],
  ["kombinatorik.permutation.zyklisch", { n: 5 }, "24"], // runder Tisch: 4!
  ["kombinatorik.permutation.multiset", { k1: 4, k2: 4, k3: 2, k4: 1 }, "34650"], // MISSISSIPPI, n = 11 wird summiert
  ["kombinatorik.permutation.wort", { wort: "MISSISSIPPI" }, "34650"], // dasselbe, aus dem Wort gezählt
  ["kombinatorik.variation.ohne_wdh", { n: 10, k: 3 }, "720"],
  ["kombinatorik.variation.mit_wdh", { n: 10, k: 3 }, "1000"],
  ["kombinatorik.kombination.ohne_wdh", { n: 49, k: 6 }, "13983816"],
  ["kombinatorik.kombination.mit_wdh", { n: 5, k: 3 }, "35"],
  ["kombinatorik.verteilung.nichtnegativ", { n: 10, k: 4 }, "286"],
  ["kombinatorik.teilmengen.anzahl", { n: 10 }, "1024"],
  [
    "wahrscheinlichkeit.hypergeometrisch.genau",
    { population: 49, successes: 6, draws: 6, hits: 6 },
    "1/13983816",
  ],
  [
    "wahrscheinlichkeit.hypergeometrisch.mindestens_eins",
    { population: 10, successes: 3, draws: 2 },
    "8/15",
  ],
];

describe("Registry-Verträge", () => {
  it("enthält genau die vierzehn vorgesehenen Refs", () => {
    expect(Object.keys(registry).sort()).toEqual([
      "arithmetik.add",
      "arithmetik.subtract",
      "kombinatorik.kombination.mit_wdh",
      "kombinatorik.kombination.ohne_wdh",
      "kombinatorik.permutation.factorial",
      "kombinatorik.permutation.multiset",
      "kombinatorik.permutation.wort",
      "kombinatorik.permutation.zyklisch",
      "kombinatorik.teilmengen.anzahl",
      "kombinatorik.variation.mit_wdh",
      "kombinatorik.variation.ohne_wdh",
      "kombinatorik.verteilung.nichtnegativ",
      "wahrscheinlichkeit.hypergeometrisch.genau",
      "wahrscheinlichkeit.hypergeometrisch.mindestens_eins",
    ]);
  });

  it("erkennt gültige und ungültige compute_refs", () => {
    expect(isComputeRef("arithmetik.add")).toBe(true);
    expect(isComputeRef("arithmetik.multiply")).toBe(false);
    // darf nicht auf Object.prototype anspringen
    expect(isComputeRef("toString")).toBe(false);
    expect(isComputeRef("constructor")).toBe(false);
  });

  it("hat für jeden Eintrag ein Beispiel in dieser Datei", () => {
    expect(EXAMPLES.map(([ref]) => ref).sort()).toEqual(Object.keys(registry).sort());
  });

  it.each(EXAMPLES)("%s rechnet %j zu %s", (ref, params, expected) => {
    expect(toStorageString(registry[ref].run(params)?.result ?? { num: 0n, den: 1n })).toBe(
      expected,
    );
  });

  describe("Anzeigewerte", () => {
    /**
     * `displayKeys` wird statisch deklariert, damit die Content-Prüfung sie
     * kennt, ohne die Funktion auszuführen. Genau deshalb kann die Liste von
     * dem abweichen, was `display` tatsächlich liefert — das prüft dieser Test.
     */
    it.each(EXAMPLES)("%s liefert genau die deklarierten Schlüssel", (ref, params) => {
      const computed = registry[ref].run(params);
      expect(computed).toBeDefined();
      if (!computed) return;

      expect(Object.keys(computed.display).sort()).toEqual([...registry[ref].displayKeys].sort());
    });

    it("liefert bei jedem Eintrag Text, nicht Zahlen", () => {
      // `interpolate` setzt Strings ein; eine Zahl käme über `String()` zwar
      // durch, aber LaTeX wie `4! \cdot 2!` ist ohnehin nur als Text möglich.
      for (const [ref, params] of EXAMPLES) {
        for (const value of Object.values(registry[ref].run(params)?.display ?? {})) {
          expect(typeof value, ref).toBe("string");
        }
      }
    });

    it("hat heute genau bei diesen Einträgen welche", () => {
      // Festgenagelt, damit ein neuer Anzeigewert auffällt und jemand prüft,
      // ob ein Lösungsweg ihn benutzen sollte.
      const mitAnzeige = Object.entries(registry)
        .filter(([, entry]) => entry.displayKeys.length > 0)
        .map(([ref]) => ref)
        .sort();

      expect(mitAnzeige).toEqual([
        "kombinatorik.permutation.multiset",
        "kombinatorik.permutation.wort",
        "kombinatorik.permutation.zyklisch",
      ]);
    });

    it("nennt die Zerlegung, die die Funktion selbst abgeleitet hat", () => {
      // Der Fall aus D-26: Das Template kennt nur das Wort.
      expect(registry["kombinatorik.permutation.wort"].run({ wort: "MISSISSIPPI" })?.display).toEqual(
        { n: "11", nenner: "1! \\cdot 4! \\cdot 4! \\cdot 2!" },
      );
      expect(registry["kombinatorik.permutation.multiset"].run({ k1: 3, k2: 5, k3: 2 })?.display).toEqual(
        { n: "10", nenner: "3! \\cdot 5! \\cdot 2!" },
      );
      expect(registry["kombinatorik.permutation.zyklisch"].run({ n: 10 })?.display).toEqual({
        n_minus_1: "9",
      });
    });

    it("benutzt nur Namen, die als Platzhalter zulässig sind", () => {
      // `interpolate` erkennt `{{name}}` nur mit `[a-z][a-z0-9_]*`.
      for (const entry of Object.values(registry)) {
        for (const key of entry.displayKeys) expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    });
  });

  it("verwirft Parameter, die nicht zum Schema passen, statt zu werfen", () => {
    expect(registry["arithmetik.add"].run({ a: 1 })).toBeUndefined();
    expect(registry["arithmetik.add"].run({ a: 1.5, b: 2 })).toBeUndefined();
    expect(registry["arithmetik.add"].run({})).toBeUndefined();
    expect(registry["arithmetik.add"].run("nichts")).toBeUndefined();
  });

  it("lehnt überzählige Parameter ab — die Schemata sind strikt", () => {
    expect(registry["arithmetik.add"].run({ a: 1, b: 2, c: 3 })).toBeUndefined();
    expect(registry["kombinatorik.permutation.factorial"].run({ n: 5, k: 2 })).toBeUndefined();
  });

  it("liefert bei den Kombinatorikfunktionen ganze Zahlen", () => {
    for (const [ref, params] of EXAMPLES) {
      if (!ref.startsWith("kombinatorik") && !ref.startsWith("arithmetik")) continue;
      const computed = registry[ref].run(params);
      expect(computed).toBeDefined();
      expect(computed && isInteger(computed.result), ref).toBe(true);
    }
  });

  it("liefert bei den Wahrscheinlichkeiten Werte zwischen 0 und 1", () => {
    for (const [ref, params] of EXAMPLES) {
      if (!ref.startsWith("wahrscheinlichkeit")) continue;
      const computed = registry[ref].run(params);
      expect(computed).toBeDefined();
      if (!computed) continue;
      expect(computed.result.num >= 0n, ref).toBe(true);
      expect(computed.result.num <= computed.result.den, ref).toBe(true);
    }
  });
});

describe("arithmetik über die Registry", () => {
  it("verliert bei großen Zahlen keine Präzision", () => {
    const computed = registry["arithmetik.add"].run({ a: 9007199254740991, b: 2 });
    expect(computed && toStorageString(computed.result)).toBe("9007199254740993");
  });

  it("erlaubt ein negatives Ergebnis", () => {
    const computed = registry["arithmetik.subtract"].run({ a: 12, b: 30 });
    expect(computed && toStorageString(computed.result)).toBe("-18");
  });
});
