import { describe, expect, it } from "vitest";

import { fromStorageString, type Rational } from "../expr/rational";
import { grade } from "./index";

function expectedOf(text: string): Rational {
  const value = fromStorageString(text);
  if (!value) throw new Error(`Testaufbau kaputt: ${text}`);
  return value;
}

const FIVE_TWELFTHS = expectedOf("5/12");
const THREE_EIGHTHS = expectedOf("3/8");
const WHOLE = expectedOf("3");

describe("grade fraction — richtige Antworten", () => {
  const correct: readonly string[] = [
    "5/12",
    "10/24",
    "15/36",
    "-5/-12",
    "(5/12)",
    "1/3+1/12",
    "1/2-1/12",
    "5*(1/12)",
    "10/12/2",
    "0.5-1/12",
    " 5 / 12 ",
    "combinations(5,1)/12",
    "5/(3*4)",
    "(1+4)/12",
  ];

  it.each(correct)("%s ist 5/12", (input) => {
    expect(grade(input, FIVE_TWELFTHS, "fraction")).toEqual({
      ok: true,
      isCorrect: true,
      normalized: "5/12",
    });
  });

  it("kürzt die Eingabe, bevor verglichen wird", () => {
    // Zähler und Nenner stimmen nach dem Kürzen — 2/4 und 1/2 sind derselbe Wert.
    expect(grade("2/4", expectedOf("1/2"), "fraction").ok).toBe(true);
    const result = grade("2/4", expectedOf("1/2"), "fraction");
    expect(result.ok && result.isCorrect).toBe(true);
    expect(result.ok && result.normalized).toBe("1/2");
  });

  it("akzeptiert eine exakt darstellbare Dezimaleingabe", () => {
    const result = grade("0.375", THREE_EIGHTHS, "fraction");
    expect(result).toEqual({ ok: true, isCorrect: true, normalized: "3/8" });
  });

  it("akzeptiert ganze Zahlen als Bruch mit Nenner 1", () => {
    expect(grade("3", WHOLE, "fraction")).toEqual({
      ok: true,
      isCorrect: true,
      normalized: "3",
    });
    expect(grade("6/2", WHOLE, "fraction")).toEqual({
      ok: true,
      isCorrect: true,
      normalized: "3",
    });
  });
});

describe("grade fraction — falsche Antworten", () => {
  const wrong: readonly string[] = [
    "5/13",
    "6/12",
    "4/12",
    "12/5",
    "-5/12",
    "1/2",
    "0",
    "5",
    "12",
    "0.4167", // gerundet ist nicht exakt
    "0.41",
    "50/12",
    "5/120",
    "1/3",
  ];

  it.each(wrong)("%s ist nicht 5/12", (input) => {
    const result = grade(input, FIVE_TWELFTHS, "fraction");
    expect(result.ok).toBe(true);
    expect(result.ok && result.isCorrect).toBe(false);
  });

  it("hält eine gerundete Dezimaleingabe für falsch, nicht für unlesbar", () => {
    const result = grade("0.4167", FIVE_TWELFTHS, "fraction");
    expect(result.ok).toBe(true);
    expect(result.ok && result.normalized).toBe("4167/10000");
  });
});

describe("grade fraction — nicht lesbare Eingaben", () => {
  const unreadable: readonly string[] = [
    "",
    "  ",
    "fünf zwölftel",
    "5/",
    "/12",
    "5//12",
    "5:12",
    "5 von 12",
    "5/0",
    "x/12",
    "5/12/",
    "5%",
    "sin(5)/12",
    "5/12)",
  ];

  it.each(unreadable)("%s ist nicht lesbar", (input) => {
    expect(grade(input, FIVE_TWELFTHS, "fraction")).toEqual({
      ok: false,
      reason: "unparseable",
    });
  });
});
