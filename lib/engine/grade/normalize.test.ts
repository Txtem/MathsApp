import { describe, expect, it } from "vitest";

import { ExpressionError } from "../errors";
import { MAX_INPUT_LENGTH, normalizeInteger } from "./normalize";

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
