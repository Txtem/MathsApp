import { describe, expect, it } from "vitest";

import { ExpressionError } from "../errors";
import { ALLOWED_FUNCTIONS, evaluate, evaluateComparison } from "./evaluate";
import { formatNum, intNum, type Num } from "./numeric";
import { parseComparison, parseExpression } from "./parse";

function run(input: string, scope: Readonly<Record<string, Num>> = {}): string {
  return formatNum(evaluate(parseExpression(input), scope));
}

describe("evaluate — Vorrang und Assoziativität", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["2+3*4", "14"],
    ["(2+3)*4", "20"],
    ["2^3^2", "512"],
    ["-2^2", "-4"],
    ["2*3!", "12"],
    ["-(3-5)", "2"],
    ["--3", "3"],
    ["10/5/2", "1"],
    ["2-3-4", "-5"],
    ["(5)!", "120"],
    ["3!!", "720"],
  ];

  it.each(cases)("%s = %s", (input, expected) => {
    expect(run(input)).toBe(expected);
  });
});

describe("evaluate — exakt statt float", () => {
  it("bleibt bei Ganzzahlen exakt jenseits von 2^53", () => {
    expect(run("21!")).toBe("51090942171709440000");
    expect(run("9007199254740993 + 1")).toBe("9007199254740994");
    expect(run("2^80")).toBe("1208925819614629174706176");
  });

  it("bleibt ganzzahlig, wenn eine Division aufgeht", () => {
    expect(run("240/2")).toBe("120");
    expect(run("7/7")).toBe("1");
  });

  it("bleibt exakt, wenn die Division nicht aufgeht", () => {
    expect(run("5/2")).toBe("5/2");
    expect(run("1/3")).toBe("1/3");
    // Der Bruch bleibt bis zum Vergleich stehen, statt in float64 zu zerfallen.
    expect(run("1/3 + 1/6")).toBe("1/2");
    expect(run("2.5 * 4")).toBe("10");
    // Der Fall, an dem float64 scheitert:
    expect(evaluateComparison(parseComparison("0.1 + 0.2 == 0.3"))).toBe(true);
  });

  it("zieht Wurzeln exakt, wenn sie aufgehen", () => {
    expect(run("sqrt(14400)")).toBe("120");
    expect(run("sqrt(2)")).toBe("1.4142135623730951");
  });
});

describe("evaluate — Funktions-Whitelist", () => {
  it("kennt genau die erlaubten Funktionen", () => {
    expect([...ALLOWED_FUNCTIONS].sort()).toEqual([
      "abs",
      "combinations",
      "factorial",
      "permutations",
      "sqrt",
    ]);
  });

  const cases: ReadonlyArray<readonly [string, string]> = [
    ["factorial(5)", "120"],
    ["combinations(10,3)", "120"],
    ["permutations(5,5)", "120"],
    ["abs(-7)", "7"],
    ["sqrt(49)", "7"],
    ["combinations(49,6)", "13983816"],
  ];

  it.each(cases)("%s = %s", (input, expected) => {
    expect(run(input)).toBe(expected);
  });

  it("lehnt alles außerhalb der Whitelist ab", () => {
    for (const bad of ["sin(1)", "eval(1)", "require(1)", "constructor(1)", "toString(1)"]) {
      expect(() => run(bad), bad).toThrow(ExpressionError);
    }
  });

  it("prüft die Stelligkeit", () => {
    expect(() => run("combinations(5)")).toThrow(ExpressionError);
    expect(() => run("sqrt(1,2)")).toThrow(ExpressionError);
  });
});

describe("evaluate — Scope", () => {
  it("löst Variablen aus dem übergebenen Scope auf", () => {
    expect(run("n * 2", { n: intNum(21n) })).toBe("42");
  });

  it("kennt bei leerem Scope keinen einzigen Namen", () => {
    expect(() => run("n")).toThrow(ExpressionError);
    expect(() => run("pi")).toThrow(ExpressionError);
    expect(() => run("e")).toThrow(ExpressionError);
  });

  it("springt nicht auf Prototype-Eigenschaften an", () => {
    expect(() => run("toString", {})).toThrow(ExpressionError);
    expect(() => run("constructor", {})).toThrow(ExpressionError);
    expect(() => run("__proto__", {})).toThrow(ExpressionError);
  });
});

describe("evaluate — Fehlerfälle", () => {
  it("meldet Division durch null", () => {
    expect(() => run("1/0")).toThrow(ExpressionError);
    expect(() => run("1/(2-2)")).toThrow(ExpressionError);
  });

  it("begrenzt Rechenaufwand", () => {
    expect(() => run("100000!")).toThrow(ExpressionError);
    expect(() => run("2^100000")).toThrow(ExpressionError);
  });

  it("meldet die Wurzel aus einer negativen Zahl", () => {
    expect(() => run("sqrt(-1)")).toThrow(ExpressionError);
  });
});

describe("evaluateComparison", () => {
  const scope = { n: intNum(5n), result: intNum(120n) };
  const cases: ReadonlyArray<readonly [string, boolean]> = [
    ["n >= 3", true],
    ["n > 5", false],
    ["n == 5", true],
    ["n != 5", false],
    ["result <= 1000000", true],
    ["result < 100", false],
    ["n * 24 == result", true],
    ["2 + 3 <= n", true],
  ];

  it.each(cases)("%s ist %s", (input, expected) => {
    expect(evaluateComparison(parseComparison(input), scope)).toBe(expected);
  });

  it("vergleicht große Ganzzahlen exakt", () => {
    const big = { result: intNum(51090942171709440000n) };
    expect(evaluateComparison(parseComparison("result == 51090942171709440000"), big)).toBe(true);
    expect(evaluateComparison(parseComparison("result == 51090942171709440001"), big)).toBe(false);
  });
});
