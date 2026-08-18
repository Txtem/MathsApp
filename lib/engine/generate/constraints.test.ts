import { describe, expect, it } from "vitest";

import { TemplateConfigError } from "../errors";
import { checkConstraints, constraintVariables, RESULT_KEY } from "./constraints";

describe("checkConstraints", () => {
  const scope = { n: 5, k: 3, result: "120" };

  const cases: ReadonlyArray<readonly [string, boolean]> = [
    ["n >= 3", true],
    ["n >= 6", false],
    ["k <= n", true],
    ["n - k > 1", true],
    ["n - k > 2", false],
    ["result <= 1000000", true],
    ["result > 1000000", false],
    ["result == 120", true],
    ["n * k != 15", false],
    ["(n + k) / 2 == 4", true],
  ];

  it.each(cases)("%s ist %s", (constraint, expected) => {
    expect(checkConstraints([constraint], scope)).toBe(expected);
  });

  it("verlangt, dass alle Constraints erfüllt sind", () => {
    expect(checkConstraints(["n >= 3", "k <= n"], scope)).toBe(true);
    expect(checkConstraints(["n >= 3", "k > n"], scope)).toBe(false);
  });

  it("ist bei einer leeren Liste erfüllt", () => {
    expect(checkConstraints([], scope)).toBe(true);
  });

  it("vergleicht result exakt, auch jenseits von 2^53", () => {
    const big = { result: "51090942171709440000" };
    expect(checkConstraints(["result == 51090942171709440000"], big)).toBe(true);
    expect(checkConstraints(["result == 51090942171709440001"], big)).toBe(false);
    expect(checkConstraints(["result <= 1000000"], big)).toBe(false);
  });

  it("liest negative Ergebnisse", () => {
    expect(checkConstraints(["result >= 0"], { result: "-18" })).toBe(false);
    expect(checkConstraints(["result < 0"], { result: "-18" })).toBe(true);
    expect(checkConstraints(["result == -18"], { result: "-18" })).toBe(true);
    expect(checkConstraints(["n > -1"], { n: -0.5 })).toBe(true);
  });

  it("wertet keine Zeichenkette aus, die kein Vergleich ist", () => {
    expect(() => checkConstraints(["n + 1"], scope)).toThrow(TemplateConfigError);
  });

  it("führt nichts aus, was nicht in der Grammatik steht", () => {
    for (const bad of [
      "process.exit(1) > 0",
      "n > (() => 1)()",
      "n; drop table > 1",
      "n > require('fs')",
    ]) {
      expect(() => checkConstraints([bad], scope), bad).toThrow(TemplateConfigError);
    }
  });

  it("meldet unbekannte Namen als Template-Fehler, statt still false zu liefern", () => {
    expect(() => checkConstraints(["m > 2"], scope)).toThrow(TemplateConfigError);
    // Genau der Fall aus instantiate: `result` ist im ersten Durchgang noch nicht da.
    expect(() => checkConstraints(["result <= 10"], { n: 5 })).toThrow(TemplateConfigError);
  });

  it("meldet nicht vergleichbare Scope-Werte", () => {
    expect(() => checkConstraints(["ordered > 0"], { ordered: true })).toThrow(TemplateConfigError);
    expect(() => checkConstraints(["label > 0"], { label: "rot" })).toThrow(TemplateConfigError);
  });

  it("meldet Division durch null im Constraint", () => {
    expect(() => checkConstraints(["n / 0 > 1"], scope)).toThrow(TemplateConfigError);
  });
});

describe("constraintVariables", () => {
  it("nennt alle referenzierten Namen", () => {
    expect(constraintVariables("n * k <= result")).toEqual(new Set(["n", "k", "result"]));
  });

  it("erkennt result-Constraints — die Filterbasis für den ersten Durchgang", () => {
    expect(constraintVariables("result <= 1000000").has(RESULT_KEY)).toBe(true);
    expect(constraintVariables("n >= 3").has(RESULT_KEY)).toBe(false);
  });
});
