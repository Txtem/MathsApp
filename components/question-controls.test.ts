import { describe, expect, it } from "vitest";

import { questionControls, type QuestionState, verdictLook, withHint } from "./question-controls";

function state(overrides: Partial<QuestionState>): QuestionState {
  return { hintsTotal: 3, openedHints: [], firstTryWrong: false, ...overrides };
}

describe("questionControls", () => {
  it("bietet am Anfang den ersten Tipp an, aber noch nicht die Lösung", () => {
    expect(questionControls(state({}))).toEqual({
      hintButton: "Tipp",
      showGiveUp: false,
      attemptLine: null,
    });
  });

  it("zählt beim nächsten Tipp mit", () => {
    expect(questionControls(state({ openedHints: ["a"] })).hintButton).toBe(
      "Nächster Tipp (2 von 3)",
    );
    expect(questionControls(state({ openedHints: ["a", "b"] })).hintButton).toBe(
      "Nächster Tipp (3 von 3)",
    );
  });

  it("zeigt „Lösung zeigen“ erst, wenn alle Tipps offen sind", () => {
    expect(questionControls(state({ openedHints: ["a", "b"] })).showGiveUp).toBe(false);
    expect(questionControls(state({ openedHints: ["a", "b", "c"] }))).toMatchObject({
      hintButton: null,
      showGiveUp: true,
    });
  });

  it("zeigt „Lösung zeigen“ sofort, wenn die Aufgabe keine Tipps hat", () => {
    expect(questionControls(state({ hintsTotal: 0 }))).toMatchObject({
      hintButton: null,
      showGiveUp: true,
    });
  });

  it("kennzeichnet den zweiten Versuch", () => {
    expect(questionControls(state({ firstTryWrong: true })).attemptLine).toBe("Zweiter Versuch");
  });

  it("bleibt bei Tipps und zweitem Versuch unabhängig", () => {
    // Tipps gibt es jederzeit, auch im zweiten Versuch.
    expect(questionControls(state({ firstTryWrong: true, openedHints: ["a"] }))).toMatchObject({
      hintButton: "Nächster Tipp (2 von 3)",
      showGiveUp: false,
    });
  });
});

describe("withHint", () => {
  it("hängt den nächsten Tipp an", () => {
    expect(withHint(state({ openedHints: ["a"] }), "b", 1).openedHints).toEqual(["a", "b"]);
  });

  it("ignoriert einen doppelten oder verspäteten Tipp", () => {
    const s = state({ openedHints: ["a", "b"] });
    expect(withHint(s, "a", 0)).toBe(s);
    expect(withHint(s, "d", 3)).toBe(s);
  });
});

describe("verdictLook", () => {
  it("ist grün für richtig, in beiden Versuchen", () => {
    expect(verdictLook({ kind: "answered", isCorrect: true, secondTry: false }, "720")).toEqual({
      headline: "Richtig.",
      tone: "right",
    });
    expect(verdictLook({ kind: "answered", isCorrect: true, secondTry: true }, "720")).toEqual({
      headline: "Richtig — im zweiten Versuch.",
      tone: "right",
    });
  });

  it("nennt bei falsch die Lösung", () => {
    expect(verdictLook({ kind: "answered", isCorrect: false, secondTry: true }, "720")).toEqual({
      headline: "Falsch. Richtig wäre 720 gewesen.",
      tone: "wrong",
    });
  });

  it("nennt Aufgeben beim Namen", () => {
    expect(verdictLook({ kind: "gave_up" }, "720")).toEqual({
      headline: "Aufgegeben. Die Lösung ist 720.",
      tone: "gave_up",
    });
  });
});
