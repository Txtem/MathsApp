import { describe, expect, it } from "vitest";

import { fromStorageString, type Rational } from "../expr/rational";
import { grade } from "./index";

/** `3/8` = 0.375 — exakt darstellbar, damit Dezimal- und Brucheingaben vergleichbar sind. */
const THREE_EIGHTHS = expectedOf("3/8");
/** `177/10000` = 0.0177 — der typische Wahrscheinlichkeitswert aus M1. */
const P = expectedOf("177/10000");
/** `5/12` — als Dezimalzahl nicht endlich. */
const FIVE_TWELFTHS = expectedOf("5/12");

function expectedOf(text: string): Rational {
  const value = fromStorageString(text);
  if (!value) throw new Error(`Testaufbau kaputt: ${text}`);
  return value;
}

describe("grade numeric — exakt, ohne round_to", () => {
  const correct: readonly string[] = [
    "0.375",
    "0,375",
    "3/8",
    "6/16",
    "375/1000",
    "0.3750",
    "(3/8)",
    "1/4+1/8",
    "0.5-0.125",
    "3*(1/8)",
    "0.75/2",
    "1-5/8",
    "-(-3/8)",
    "37.5/100",
    "0.375e0",
    "3.75e-1",
    "combinations(3,1)/8",
    "abs(-0.375)",
    "sqrt(9)/8",
    " 0.375 ",
  ];

  it.each(correct)("%s ist 3/8", (input) => {
    expect(grade(input, THREE_EIGHTHS, "numeric")).toEqual({
      ok: true,
      isCorrect: true,
      normalized: "3/8",
    });
  });

  const wrong: readonly string[] = [
    "0.38",
    "0.37",
    "0.4",
    "3/7",
    "1/2",
    "8/3",
    "-3/8",
    "0",
    "0.375001",
    "375",
    "1",
    "0.0375",
  ];

  it.each(wrong)("%s ist nicht 3/8", (input) => {
    const result = grade(input, THREE_EIGHTHS, "numeric");
    expect(result.ok).toBe(true);
    expect(result.ok && result.isCorrect).toBe(false);
  });

  it("verlangt ohne round_to den exakten Wert", () => {
    // 5/12 ist als Dezimalzahl nicht endlich — gerundet eingetippt ist es falsch.
    expect(grade("0.4167", FIVE_TWELFTHS, "numeric").ok && true).toBe(true);
    const rounded = grade("0.4167", FIVE_TWELFTHS, "numeric");
    expect(rounded.ok && rounded.isCorrect).toBe(false);

    const exact = grade("1/3+1/12", FIVE_TWELFTHS, "numeric");
    expect(exact.ok && exact.isCorrect).toBe(true);
  });

  const unreadable: readonly string[] = [
    "",
    "   ",
    "abc",
    "3/",
    "/8",
    "x",
    "1/0",
    "0,3,7",
    "sin(0.5)",
    "3//8",
    "0.375%", // Prozent ist als Antwortformat nicht zugelassen, D-09
    "37,5 %",
  ];

  it.each(unreadable)("%s ist nicht lesbar", (input) => {
    expect(grade(input, THREE_EIGHTHS, "numeric")).toEqual({ ok: false, reason: "unparseable" });
  });
});

describe("grade numeric — mit round_to", () => {
  const options = { roundTo: 4 };

  const correct: readonly string[] = [
    "0.0177",
    "0,0177",
    "0.01770",
    "177/10000",
    "0.017701",
    "0.0176999",
    "0.01765", // kaufmännisch aufgerundet
    "0.017749",
    "1.77/100",
    "0.0177e0",
    "1.77e-2",
    "combinations(2,1)*0.00885",
  ];

  it.each(correct)("%s gilt auf 4 Stellen als 0.0177", (input) => {
    expect(grade(input, P, "numeric", options)).toEqual({
      ok: true,
      isCorrect: true,
      normalized: "0.0177",
    });
  });

  const wrong: readonly string[] = [
    "0.0178",
    "0.0176",
    "0.017",
    "0.02",
    "1.77", // Prozentwert statt Wahrscheinlichkeit, D-09
    "177/1000",
    "0.00177",
    "0",
    "-0.0177",
    "0.01764",
  ];

  it.each(wrong)("%s gilt auf 4 Stellen nicht als 0.0177", (input) => {
    const result = grade(input, P, "numeric", options);
    expect(result.ok).toBe(true);
    expect(result.ok && result.isCorrect).toBe(false);
  });

  it("rundet beide Seiten, nicht nur die Eingabe", () => {
    // Erwartet ist 5/12 = 0.41666…, die Eingabe die gerundete Dezimalzahl.
    const result = grade("0.4167", FIVE_TWELFTHS, "numeric", options);
    expect(result).toEqual({ ok: true, isCorrect: true, normalized: "0.4167" });
  });

  it("meldet die verstandene Eingabe in der gerundeten Form", () => {
    const result = grade("1/3", expectedOf("1/3"), "numeric", { roundTo: 2 });
    expect(result).toEqual({ ok: true, isCorrect: true, normalized: "0.33" });
  });

  it("rundet auch bei round_to: 0", () => {
    const result = grade("2.5", expectedOf("3"), "numeric", { roundTo: 0 });
    expect(result).toEqual({ ok: true, isCorrect: true, normalized: "3" });
  });

  it("bringt einen genäherten Wert auf dieselbe Stellenzahl", () => {
    // sqrt(2) ist irrational und liegt nur genähert vor — mit round_to ist es
    // trotzdem entscheidbar.
    const result = grade("sqrt(2)", expectedOf("14142/10000"), "numeric", options);
    expect(result).toEqual({ ok: true, isCorrect: true, normalized: "1.4142" });
  });

  it("lehnt einen genäherten Wert ohne round_to als nicht richtig ab", () => {
    const result = grade("sqrt(2)", expectedOf("14142/10000"), "numeric");
    expect(result.ok && result.isCorrect).toBe(false);
  });
});
