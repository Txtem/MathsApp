import { describe, expect, it } from "vitest";

import { ExpressionError } from "../errors";
import { MAX_INPUT_LENGTH, normalizeChoice, normalizeInteger, normalizeNumeric } from "./normalize";

describe("normalizeInteger", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["120", "120"],
    ["  120  ", "120"],
    ["1 200", "1200"],
    ["12\u00A0345", "12345"], // geschütztes Leerzeichen
    ["1.000.000", "1000000"],
    ["1,000,000", "1000000"],
    ["1'000'000", "1000000"], // Schweizer Schreibweise
    ["1_000_000", "1000000"],
    ["1,000", "1000"], // für Ganzzahlen als Tausendertrennung gelesen
    ["2,5", "2,5"], // Komma bleibt stehen — der Parser lehnt es später ab
    ["combinations(10,3)", "combinations(10,3)"], // Argumenttrenner überlebt
    ["5\u00B74\u00B73\u00B72\u00B71", "5*4*3*2*1"], // Malpunkt
    ["7\u00D76", "7*6"], // Kreuz
    ["\u22128", "-8"], // Unicode-Minus
    ["10\u00F72", "10/2"],
    ["2.5e3", "2.5e3"],
    ["5!", "5!"],
  ];

  it.each(cases)("%s → %s", (input, expected) => {
    expect(normalizeInteger(input)).toBe(expected);
  });

  it("wirft bei leerer Eingabe", () => {
    expect(() => normalizeInteger("")).toThrow(ExpressionError);
    expect(() => normalizeInteger("   ")).toThrow(ExpressionError);
  });

  it("begrenzt die Eingabelänge", () => {
    expect(() => normalizeInteger("1".repeat(MAX_INPUT_LENGTH + 1))).toThrow(ExpressionError);
  });

  it("verändert nichts an Zeichen, die der Parser ablehnen soll", () => {
    // Normalisierung ist kein Filter — die Ablehnung passiert im Tokenizer.
    expect(normalizeInteger("n + 1")).toBe("n+1");
  });
});

describe("normalizeNumeric — Dezimal- und Tausendertrenner", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["0,25", "0.25"],
    ["0.25", "0.25"],
    ["1.000,25", "1000.25"], // deutsche Schreibweise
    ["1,000.25", "1000.25"], // englische Schreibweise
    ["1.000.000,5", "1000000.5"],
    ["1,000,000.5", "1000000.5"],
    ["0.5-0.125", "0.5-0.125"], // zwei Zahlen, nicht eine mit Tausenderpunkten
    ["0,5+0,125", "0.5+0.125"],
    ["1.000", "1.000"], // ein einzelner Trenner ist der Dezimalpunkt
    ["1.000.000", "1000000"], // saubere Gruppierung ⇒ Tausendertrennung
    ["12 345", "12345"],
    ["3/8", "3/8"],
    ["-0,375", "-0.375"],
  ];

  it.each(cases)("%s → %s", (input, expected) => {
    expect(normalizeNumeric(input)).toBe(expected);
  });

  it("lässt Kommas in Funktionsaufrufen in Ruhe", () => {
    expect(normalizeNumeric("combinations(49,6)")).toBe("combinations(49,6)");
    expect(normalizeNumeric("combinations(4,2)*combinations(48,4)/combinations(52,6)")).toBe(
      "combinations(4,2)*combinations(48,4)/combinations(52,6)",
    );
  });

  it("erfindet keine Bedeutung für unsinnige Gruppierungen", () => {
    // Bleibt stehen und scheitert am Parser — besser als eine geratene Zahl.
    expect(normalizeNumeric("0,3,7")).toBe("0,3,7");
    expect(normalizeNumeric("1.23.456")).toBe("1.23.456");
  });

  it("wirft bei leerer und zu langer Eingabe", () => {
    expect(() => normalizeNumeric("")).toThrow(ExpressionError);
    expect(() => normalizeNumeric("1".repeat(MAX_INPUT_LENGTH + 1))).toThrow(ExpressionError);
  });
});

describe("normalizeChoice", () => {
  it("vergleicht ohne Rand und ohne Groß-/Kleinschreibung", () => {
    expect(normalizeChoice("  Rot ")).toBe("rot");
    expect(normalizeChoice("MIT_WDH")).toBe("mit_wdh");
  });

  it("wirft bei leerer Eingabe", () => {
    expect(() => normalizeChoice("   ")).toThrow(ExpressionError);
  });
});
