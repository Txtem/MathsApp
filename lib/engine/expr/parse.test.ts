import { describe, expect, it } from "vitest";

import { ExpressionError } from "../errors";
import { parseComparison, parseExpression, variablesOf } from "./parse";
import { formatNum } from "./numeric";
import { parseNumberLiteral, tokenize } from "./tokenize";

describe("parseNumberLiteral", () => {
  const exact: ReadonlyArray<readonly [string, string]> = [
    ["0", "0"],
    ["120", "120"],
    ["1e6", "1000000"],
    ["2.5e3", "2500"], // ganzzahlig trotz Dezimalpunkt
    ["120.000", "120"],
    ["0.12e3", "120"],
    ["1E2", "100"],
  ];

  it.each(exact)("%s bleibt exakt ganzzahlig (%s)", (text, expected) => {
    expect(formatNum(parseNumberLiteral(text))).toBe(expected);
  });

  // Ab M1 wird auch das exakt gelesen — als Bruch, nicht als float64.
  const fractions: ReadonlyArray<readonly [string, string]> = [
    ["2.5", "5/2"],
    ["0.1", "1/10"],
    ["1.5e-1", "3/20"],
  ];

  it.each(fractions)("%s wird der exakte Bruch %s", (text, expected) => {
    const value = parseNumberLiteral(text);
    expect(value.kind).toBe("exact");
    expect(formatNum(value)).toBe(expected);
  });

  it("lehnt absurd große Exponenten ab", () => {
    expect(() => parseNumberLiteral("1e5000")).toThrow(ExpressionError);
  });
});

describe("tokenize", () => {
  it("erkennt die zweistelligen Vergleichsoperatoren als ein Token", () => {
    expect(tokenize("a<=b")).toHaveLength(3);
    expect(tokenize("a!=b")).toHaveLength(3);
  });

  it("unterscheidet Fakultät von Ungleichheit", () => {
    expect(tokenize("5!")[1]).toEqual({ kind: "bang" });
  });

  it("lehnt unbekannte Zeichen ab", () => {
    expect(() => tokenize("2 § 3")).toThrow(ExpressionError);
    expect(() => tokenize("2 % 3")).toThrow(ExpressionError);
  });
});

describe("parseExpression — Struktur", () => {
  it("bindet Fakultät stärker als Multiplikation", () => {
    expect(parseExpression("2*3!")).toEqual({
      kind: "binary",
      op: "*",
      left: { kind: "number", value: { kind: "exact", value: { num: 2n, den: 1n } } },
      right: {
        kind: "factorial",
        operand: { kind: "number", value: { kind: "exact", value: { num: 3n, den: 1n } } },
      },
    });
  });

  it("parst ^ rechtsassoziativ", () => {
    const node = parseExpression("2^3^2");
    expect(node.kind === "binary" && node.right.kind).toBe("binary");
  });

  it("lehnt unvollständige Ausdrücke ab", () => {
    for (const bad of ["", "2+", "(2+3", "2 3 +", "*3", "2,3", "f(", "()"]) {
      expect(() => parseExpression(bad), bad).toThrow(ExpressionError);
    }
  });
});

describe("parseComparison", () => {
  it("liest beide Seiten und den Operator", () => {
    const comparison = parseComparison("n * 2 <= result + 1");
    expect(comparison.op).toBe("<=");
    expect(variablesOf(comparison.left)).toEqual(new Set(["n"]));
    expect(variablesOf(comparison.right)).toEqual(new Set(["result"]));
  });

  it("verlangt einen Vergleichsoperator", () => {
    expect(() => parseComparison("n + 1")).toThrow(ExpressionError);
  });

  it("lehnt zwei Vergleiche in einem Constraint ab", () => {
    expect(() => parseComparison("1 < n < 5")).toThrow(ExpressionError);
  });
});

describe("variablesOf", () => {
  it("findet Namen in Funktionsargumenten und unter Operatoren", () => {
    expect(variablesOf(parseExpression("combinations(n, k) + abs(-m)!"))).toEqual(
      new Set(["n", "k", "m"]),
    );
  });

  it("liefert für reine Zahlausdrücke die leere Menge", () => {
    expect(variablesOf(parseExpression("2 * (3 + 4)")).size).toBe(0);
  });
});
