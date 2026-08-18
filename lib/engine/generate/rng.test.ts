import { describe, expect, it } from "vitest";

import { makeRng } from "./rng";

describe("makeRng", () => {
  it("liefert für denselben Seed dieselbe Folge", () => {
    const a = makeRng("aufg_00001:7");
    const b = makeRng("aufg_00001:7");
    const left = Array.from({ length: 20 }, () => a.next());
    const right = Array.from({ length: 20 }, () => b.next());
    expect(left).toEqual(right);
  });

  it("liefert für unterschiedliche Seeds unterschiedliche Folgen", () => {
    expect(makeRng("seed-1").next()).not.toBe(makeRng("seed-2").next());
    // auch bei minimal verschiedenen Seeds
    expect(makeRng("aufg_00001:1").next()).not.toBe(makeRng("aufg_00001:2").next());
  });

  it("bleibt in [0, 1)", () => {
    const rng = makeRng("range");
    for (let i = 0; i < 2000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("hält beide Grenzen von int ein und erreicht sie", () => {
    const rng = makeRng("bounds");
    const seen = new Set<number>();
    for (let i = 0; i < 3000; i++) {
      const value = rng.int(3, 9);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
      seen.add(value);
    }
    expect([...seen].sort((x, y) => x - y)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it("erlaubt einen Bereich aus genau einem Wert", () => {
    expect(makeRng("single").int(5, 5)).toBe(5);
  });

  it("lehnt leere und nicht ganzzahlige Bereiche ab", () => {
    expect(() => makeRng("bad").int(9, 3)).toThrow(RangeError);
    expect(() => makeRng("bad").int(1.5, 3)).toThrow(RangeError);
  });

  it("zieht aus einer Liste und lehnt die leere Liste ab", () => {
    const rng = makeRng("pick");
    const values = ["a", "b", "c"] as const;
    for (let i = 0; i < 100; i++) expect(values).toContain(rng.pick(values));
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it("verteilt einigermaßen gleichmäßig", () => {
    const rng = makeRng("distribution");
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) buckets[Math.floor(rng.next() * 4)] += 1;
    for (const count of buckets) expect(count).toBeGreaterThan(800);
  });
});
