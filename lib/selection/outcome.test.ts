import { describe, expect, it } from "vitest";

import { classifyOutcome, countsAsSuccess, type SuccessFields } from "./outcome";

function attempt(overrides: Partial<SuccessFields>): SuccessFields {
  return { status: "ANSWERED", isCorrect: true, tries: 1, hintsUsed: 0, ...overrides };
}

describe("classifyOutcome", () => {
  it("gibt für offene Attempts keinen Ausgang — auch nach dem ersten Fehlversuch", () => {
    expect(classifyOutcome(attempt({ status: "OPEN", isCorrect: null, tries: 0 }))).toBeNull();
    expect(classifyOutcome(attempt({ status: "OPEN", isCorrect: null, tries: 1 }))).toBeNull();
  });

  it("nennt SKIPPED aufgegeben, gleich was sonst auf der Zeile steht", () => {
    expect(classifyOutcome(attempt({ status: "SKIPPED", isCorrect: null, tries: 0 }))).toBe(
      "gave_up",
    );
    expect(classifyOutcome(attempt({ status: "SKIPPED", isCorrect: null, tries: 1 }))).toBe(
      "gave_up",
    );
  });

  it("trennt richtig im ersten von richtig im zweiten Versuch", () => {
    expect(classifyOutcome(attempt({ tries: 1 }))).toBe("right_first");
    expect(classifyOutcome(attempt({ tries: 2 }))).toBe("right_second");
  });

  it("nennt falsch falsch, auch nach zwei Versuchen", () => {
    expect(classifyOutcome(attempt({ isCorrect: false, tries: 2 }))).toBe("wrong");
  });

  it("ordnet alte Attempts aus der Migration (tries = 1) richtig ein", () => {
    // Vor M2f gab es genau einen Versuch; die Migration setzt tries = 1.
    expect(classifyOutcome(attempt({ isCorrect: true, tries: 1 }))).toBe("right_first");
    expect(classifyOutcome(attempt({ isCorrect: false, tries: 1 }))).toBe("wrong");
  });

  it("wertet ein fehlendes Urteil auf ANSWERED nicht als richtig", () => {
    expect(classifyOutcome(attempt({ isCorrect: null }))).toBe("wrong");
  });

  it("zählt Tipps nicht in den Ausgang — sie sind eine zweite Dimension", () => {
    expect(classifyOutcome(attempt({ hintsUsed: 3 }))).toBe("right_first");
  });
});

describe("countsAsSuccess", () => {
  it("zählt nur richtig im ersten Versuch ohne Tipp als Erfolg", () => {
    expect(countsAsSuccess(attempt({}))).toBe(true);
  });

  it("zählt richtig im zweiten Versuch nicht", () => {
    expect(countsAsSuccess(attempt({ tries: 2 }))).toBe(false);
  });

  it("zählt richtig im ersten Versuch mit einem Tipp nicht", () => {
    expect(countsAsSuccess(attempt({ hintsUsed: 1 }))).toBe(false);
  });

  it("zählt falsch, aufgegeben und offen nicht", () => {
    expect(countsAsSuccess(attempt({ isCorrect: false }))).toBe(false);
    expect(countsAsSuccess(attempt({ status: "SKIPPED", isCorrect: null }))).toBe(false);
    expect(countsAsSuccess(attempt({ status: "OPEN", isCorrect: null, tries: 0 }))).toBe(false);
  });

  it("ist nie Erfolg, wo classifyOutcome nicht right_first sagt", () => {
    // Die beiden Funktionen dürfen nicht auseinanderlaufen: Erfolg ist eine
    // Teilmenge von „richtig im ersten Versuch".
    for (const status of ["OPEN", "ANSWERED", "SKIPPED"] as const) {
      for (const isCorrect of [true, false, null]) {
        for (const tries of [0, 1, 2]) {
          for (const hintsUsed of [0, 1, 3]) {
            const a = { status, isCorrect, tries, hintsUsed };
            if (countsAsSuccess(a)) expect(classifyOutcome(a)).toBe("right_first");
          }
        }
      }
    }
  });
});
