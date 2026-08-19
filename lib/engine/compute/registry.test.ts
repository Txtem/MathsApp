import { describe, expect, it } from "vitest";

import { isInteger, toStorageString } from "../expr/rational";
import { isComputeRef, registry } from "./registry";

describe("Registry-Verträge", () => {
  it("enthält genau die für M0 vorgesehenen Refs", () => {
    expect(Object.keys(registry).sort()).toEqual(["arithmetik.add", "arithmetik.subtract"]);
  });

  it("erkennt gültige und ungültige compute_refs", () => {
    expect(isComputeRef("arithmetik.add")).toBe(true);
    expect(isComputeRef("arithmetik.multiply")).toBe(false);
    // darf nicht auf Object.prototype anspringen
    expect(isComputeRef("toString")).toBe(false);
    expect(isComputeRef("constructor")).toBe(false);
  });

  it("liefert Ergebnisse als exakten Bruch", () => {
    for (const entry of Object.values(registry)) {
      const result = entry.compute(entry.input.parse({ a: 2, b: 1 }));
      expect(typeof result.num).toBe("bigint");
      expect(result.den).toBeGreaterThan(0n);
      // Die Grundrechenarten liefern ganze Zahlen, also Nenner 1.
      expect(isInteger(result)).toBe(true);
    }
  });
});

describe("arithmetik.add — über die Registry", () => {
  const entry = registry["arithmetik.add"];

  it("berechnet die Summe", () => {
    expect(toStorageString(entry.compute(entry.input.parse({ a: 12, b: 30 })))).toBe("42");
  });

  it("verliert bei großen Zahlen keine Präzision", () => {
    expect(toStorageString(entry.compute(entry.input.parse({ a: 9007199254740991, b: 2 })))).toBe(
      "9007199254740993",
    );
  });

  it("weist Nicht-Ganzzahlen ab", () => {
    expect(entry.input.safeParse({ a: 1.5, b: 2 }).success).toBe(false);
  });

  it("weist fehlende und falsch getypte Parameter ab", () => {
    expect(entry.input.safeParse({ a: 1 }).success).toBe(false);
    expect(entry.input.safeParse({ a: "1", b: 2 }).success).toBe(false);
    expect(entry.input.safeParse({}).success).toBe(false);
  });
});

describe("arithmetik.subtract — über die Registry", () => {
  const entry = registry["arithmetik.subtract"];

  it("berechnet die Differenz", () => {
    expect(toStorageString(entry.compute(entry.input.parse({ a: 30, b: 12 })))).toBe("18");
  });

  it("erlaubt ein negatives Ergebnis", () => {
    expect(toStorageString(entry.compute(entry.input.parse({ a: 12, b: 30 })))).toBe("-18");
  });

  it("liefert 0 bei gleichen Operanden", () => {
    expect(toStorageString(entry.compute(entry.input.parse({ a: 7, b: 7 })))).toBe("0");
  });
});
