import { describe, expect, it } from "vitest";

import { productionSources, readSource } from "@/lib/__testing__/sources";
import type { SuccessFields } from "@/lib/selection/outcome";

import { pieSegments, summarizeOutcomes } from "./outcome-chart";

function attempt(overrides: Partial<SuccessFields>): SuccessFields {
  return { status: "ANSWERED", isCorrect: true, tries: 1, hintsUsed: 0, ...overrides };
}

describe("summarizeOutcomes", () => {
  it("zeigt alle vier Ausgänge in fester Reihenfolge, auch ohne Daten", () => {
    expect(summarizeOutcomes([]).map((slice) => [slice.label, slice.count, slice.share])).toEqual([
      ["Richtig (1. Versuch)", 0, 0],
      ["Richtig (2. Versuch)", 0, 0],
      ["Falsch", 0, 0],
      ["Aufgegeben", 0, 0],
    ]);
  });

  it("ordnet über classifyOutcome ein und rechnet Anteile", () => {
    const slices = summarizeOutcomes([
      attempt({}),
      attempt({ tries: 2 }),
      attempt({ isCorrect: false, tries: 2 }),
      attempt({ status: "SKIPPED", isCorrect: null }),
    ]);
    expect(slices.map((slice) => slice.count)).toEqual([1, 1, 1, 1]);
    expect(slices.every((slice) => slice.share === 0.25)).toBe(true);
  });

  it("zählt Tipps je Ausgang, als Aufgaben mit Tipp und als Summe", () => {
    const slices = summarizeOutcomes([
      attempt({ hintsUsed: 2 }),
      attempt({ hintsUsed: 1 }),
      attempt({}),
      attempt({ status: "SKIPPED", isCorrect: null, hintsUsed: 2 }),
    ]);
    expect(slices[0]).toMatchObject({ count: 3, withHints: 2, hintsUsed: 3 });
    expect(slices[3]).toMatchObject({ count: 1, withHints: 1, hintsUsed: 2 });
  });

  it("lässt offene und verworfene Attempts weg", () => {
    const slices = summarizeOutcomes([
      attempt({ status: "OPEN", isCorrect: null, tries: 1 }),
      attempt({ status: "VOIDED", isCorrect: null, tries: 1 }),
    ]);
    expect(slices.reduce((sum, slice) => sum + slice.count, 0)).toBe(0);
  });

  it("zeigt alte Attempts (tries = 1) als Richtig (1. Versuch) oder Falsch", () => {
    const slices = summarizeOutcomes([attempt({}), attempt({ isCorrect: false })]);
    expect(slices.map((slice) => slice.count)).toEqual([1, 0, 1, 0]);
  });

  it("baut classifyOutcome nicht nach", () => {
    // Konvention zu Extraktionen: Ob ein Attempt im zweiten Versuch richtig war,
    // entscheidet nur outcome.ts. Eine zweite Stelle mit `tries >= 2` wäre eine
    // zweite Wahrheit, die auseinanderlaufen kann.
    const nachbauten = productionSources().filter(
      (file) => file !== "lib/selection/outcome.ts" && /tries\s*>=\s*2/.test(readSource(file)),
    );
    expect(nachbauten).toEqual([]);
  });
});

describe("pieSegments", () => {
  it("gibt ohne Werte keine Segmente", () => {
    expect(pieSegments([], 50)).toEqual([]);
    expect(pieSegments([{ key: "a", value: 0 }], 50)).toEqual([]);
  });

  it("füllt bei einem einzigen Wert den ganzen Kreis mit zwei Halbbögen", () => {
    const [only] = pieSegments([{ key: "a", value: 3 }, { key: "b", value: 0 }], 50);
    expect(only).toEqual({
      key: "a",
      d: "M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z",
      startAngle: 0,
      endAngle: 2 * Math.PI,
    });
  });

  it("teilt den Kreis lückenlos auf, ab zwölf Uhr im Uhrzeigersinn", () => {
    const segments = pieSegments(
      [
        { key: "a", value: 1 },
        { key: "b", value: 1 },
        { key: "c", value: 2 },
      ],
      50,
    );
    expect(segments.map((s) => s.key)).toEqual(["a", "b", "c"]);
    expect(segments[0]?.startAngle).toBe(0);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i]?.startAngle).toBe(segments[i - 1]?.endAngle);
    }
    expect(segments.at(-1)?.endAngle).toBeCloseTo(2 * Math.PI);
    // Das erste Viertel geht von oben (50 0) nach rechts (100 50).
    expect(segments[0]?.d).toBe("M 50 50 L 50 0 A 50 50 0 0 1 100 50 Z");
  });

  it("setzt das Flag für den großen Bogen erst über einem Halbkreis", () => {
    const [gross, klein] = pieSegments(
      [
        { key: "a", value: 3 },
        { key: "b", value: 1 },
      ],
      50,
    );
    expect(gross?.d).toContain(" 0 1 1 ");
    expect(klein?.d).toContain(" 0 0 1 ");
  });

  it("lässt Nullwerte aus, ohne die Winkel zu verschieben", () => {
    const segments = pieSegments(
      [
        { key: "a", value: 1 },
        { key: "leer", value: 0 },
        { key: "b", value: 1 },
      ],
      50,
    );
    expect(segments.map((s) => s.key)).toEqual(["a", "b"]);
    expect(segments[1]?.startAngle).toBeCloseTo(Math.PI);
  });
});
