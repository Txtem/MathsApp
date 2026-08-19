import { describe, expect, it } from "vitest";

import { InvalidExpectedAnswerError, UnsupportedAnswerTypeError } from "../errors";
import type { AnswerType } from "../types";
import { fromBigInt } from "../expr/rational";
import { grade, toExpectedRational } from "./index";

/** 20! — jenseits von `Number.MAX_SAFE_INTEGER`. */
const BIG = "2432902008176640000";

describe("grade — answer_type integer, richtige Antworten", () => {
  const correct: ReadonlyArray<readonly [string, string]> = [
    ["120", "120"],
    [" 120 ", "120"],
    ["+120", "120"],
    ["5!", "120"],
    ["5*4*3*2*1", "120"],
    ["5\u00B74\u00B73\u00B72\u00B71", "120"],
    ["(2+3)!", "120"],
    ["combinations(10,3)", "120"],
    ["permutations(5,5)", "120"],
    ["sqrt(14400)", "120"],
    ["240/2", "120"],
    ["119+1", "120"],
    ["12e1", "120"],
    ["1.2e2", "120"],
    ["120.000", "120000"], // Tausendertrennung: 120.000 ist 120000
    ["abs(-120)", "120"],
    ["-120", "-120"],
    ["0", "0"],
    ["3-3", "0"],
    ["1000000", "1000000"],
    ["1.000.000", "1000000"],
    ["1 000 000", "1000000"],
    ["10^6", "1000000"],
    ["20!", BIG],
    [BIG, BIG],
    ["21!/21", BIG],
    ["combinations(49,6)", "13983816"],
  ];

  it.each(correct)("%s gilt als %s", (input, expected) => {
    expect(grade(input, expected, "integer")).toEqual({
      ok: true,
      isCorrect: true,
      normalized: expected,
    });
  });
});

describe("grade — answer_type integer, falsche Antworten", () => {
  const wrong: ReadonlyArray<readonly [string, string]> = [
    ["119", "120"],
    ["121", "120"],
    ["-120", "120"],
    ["12", "120"],
    ["1200", "120"],
    ["4!", "120"],
    ["combinations(10,4)", "120"],
    ["2.5", "120"], // lesbar, aber keine Ganzzahl
    ["1/3", "120"],
    ["0", "120"],
    // eine Ziffer daneben, jenseits der float-Genauigkeit
    ["2432902008176640001", BIG],
    ["19!", BIG],
  ];

  it.each(wrong)("%s ist nicht %s", (input, expected) => {
    const result = grade(input, expected, "integer");
    expect(result.ok).toBe(true);
    expect(result.ok && result.isCorrect).toBe(false);
  });

  it("erkennt den Unterschied jenseits von 2^53, wo `number` versagen würde", () => {
    // Beide Werte sind als `number` identisch — als BigInt nicht.
    expect(Number("2432902008176640001")).toBe(Number(BIG));
    const result = grade("2432902008176640001", BIG, "integer");
    expect(result.ok && result.isCorrect).toBe(false);
  });
});

describe("grade — nicht lesbare Eingaben", () => {
  const unparseable: readonly string[] = [
    "",
    "   ",
    "keine Ahnung",
    "n",
    "x + 1",
    "2 +",
    "(2+3",
    "5!!!!", // Rechenaufwand über der Grenze
    "2,5", // Dezimalkomma ist für eine Ganzzahlantwort nicht lesbar
    "1/0",
    "sqrt(-1)",
    "sin(30)",
    "eval('1')",
    "process.exit(1)",
    "2^100000",
    "1".repeat(300),
  ];

  it.each(unparseable)("%s ist nicht lesbar", (input) => {
    expect(grade(input, "120", "integer")).toEqual({ ok: false, reason: "unparseable" });
  });

  it("ist ausdrücklich etwas anderes als eine falsche Antwort", () => {
    const nonsense = grade("keine Ahnung", "120", "integer");
    const wrongNumber = grade("119", "120", "integer");
    expect(nonsense.ok).toBe(false);
    expect(wrongNumber.ok).toBe(true);
  });
});

describe("grade — Musterlösung und Typen", () => {
  it("akzeptiert die Musterlösung als Speicherform oder als Bruch", () => {
    expect(grade("42", "42", "integer").ok).toBe(true);
    expect(grade("42", fromBigInt(42n), "integer")).toEqual({
      ok: true,
      isCorrect: true,
      normalized: "42",
    });
  });

  it("meldet eine kaputte Musterlösung als Serverfehler, nicht als falsche Antwort", () => {
    expect(() => grade("120", "120.5", "integer")).toThrow(InvalidExpectedAnswerError);
    expect(() => grade("120", "abc", "integer")).toThrow(InvalidExpectedAnswerError);
    // Ein Bruch ist bei answer_type integer keine gültige Musterlösung.
    expect(() => grade("120", "3/8", "integer")).toThrow(InvalidExpectedAnswerError);
  });

  it("prüft die Musterlösung an der Grenze, nicht erst im Vergleich", () => {
    // Was aus der Datenbank kommt, ist zur Übersetzungszeit unbekannt —
    // deshalb hat der Validator eine eigene Suite.
    for (const broken of [null, undefined, {}, 1.5, [], true]) {
      expect(() => toExpectedRational(broken), String(broken)).toThrow(
        InvalidExpectedAnswerError,
      );
    }
    expect(toExpectedRational(42)).toEqual({ num: 42n, den: 1n });
    expect(toExpectedRational("3/8")).toEqual({ num: 3n, den: 8n });
    expect(toExpectedRational(7n)).toEqual({ num: 7n, den: 1n });
  });

  it("wirft bei noch nicht implementierten answer_types", () => {
    const later: readonly AnswerType[] = ["set", "tuple", "text"];
    for (const type of later) {
      expect(() => grade("1", "1", type), type).toThrow(UnsupportedAnswerTypeError);
    }
  });

  it("gibt die verstandene Eingabe zurück, damit die UI sie zeigen kann", () => {
    expect(grade("5!", "120", "integer")).toEqual({
      ok: true,
      isCorrect: true,
      normalized: "120",
    });
    // Kommazahlen werden exakt gelesen und deshalb als Bruch zurückgemeldet.
    const asFraction = grade("2.5", "120", "integer");
    expect(asFraction.ok && asFraction.normalized).toBe("5/2");
  });
});
