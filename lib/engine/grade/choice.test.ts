import { describe, expect, it } from "vitest";

import { InvalidExpectedAnswerError } from "../errors";
import { grade } from "./index";

describe("grade choice — IDs vergleichen, nicht rechnen", () => {
  const correct: ReadonlyArray<readonly [string, string]> = [
    ["b", "b"],
    ["B", "b"],
    [" b ", "b"],
    ["b\n", "b"],
    ["rot", "rot"],
    ["Rot", "rot"],
    ["ROT", "rot"],
    [" Rot ", "rot"],
    ["mit_wiederholung", "mit_wiederholung"],
    ["MIT_WIEDERHOLUNG", "mit_wiederholung"],
    ["Ohne Wiederholung", "ohne wiederholung"],
    ["a", "A"],
    ["42", "42"],
    ["gerade", "Gerade"],
  ];

  it.each(correct)("%s trifft %s", (input, expected) => {
    const result = grade(input, expected, "choice");
    expect(result.ok).toBe(true);
    expect(result.ok && result.isCorrect).toBe(true);
  });

  const wrong: ReadonlyArray<readonly [string, string]> = [
    ["a", "b"],
    ["c", "b"],
    ["bb", "b"],
    ["ab", "b"],
    ["blau", "rot"],
    ["rott", "rot"],
    ["ro", "rot"],
    ["42", "43"],
    ["ohne_wiederholung", "mit_wiederholung"],
    ["gerade", "ungerade"],
    ["1", "b"],
    ["r o t", "rot"],
  ];

  it.each(wrong)("%s trifft %s nicht", (input, expected) => {
    const result = grade(input, expected, "choice");
    expect(result.ok).toBe(true);
    expect(result.ok && result.isCorrect).toBe(false);
  });

  it("gibt die Eingabe unverändert zurück, nur ohne Rand", () => {
    expect(grade("  Rot  ", "rot", "choice")).toEqual({
      ok: true,
      isCorrect: true,
      normalized: "Rot",
    });
  });

  it("rechnet nichts aus — 2+2 ist die ID, nicht 4", () => {
    const result = grade("2+2", "4", "choice");
    expect(result.ok && result.isCorrect).toBe(false);
  });

  const unreadable: readonly string[] = ["", "   ", "\n", "\t"];

  it.each(unreadable)("leere Eingabe (%j) ist nicht lesbar", (input) => {
    expect(grade(input, "b", "choice")).toEqual({ ok: false, reason: "unparseable" });
  });

  it("lehnt eine Musterlösung ab, die keine ID ist", () => {
    expect(() => grade("b", "", "choice")).toThrow(InvalidExpectedAnswerError);
    expect(() => grade("b", "   ", "choice")).toThrow(InvalidExpectedAnswerError);
  });

  it("begrenzt die Eingabelänge wie bei den Zahltypen", () => {
    expect(grade("b".repeat(201), "b", "choice")).toEqual({
      ok: false,
      reason: "unparseable",
    });
  });
});
