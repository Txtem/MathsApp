import { describe, expect, it } from "vitest";

import { ExpressionError } from "../errors";
import { binomial, exactSqrt, factorial, permutations, power } from "./bigmath";

describe("factorial", () => {
  const cases: ReadonlyArray<readonly [bigint, string]> = [
    [0n, "1"],
    [1n, "1"],
    [5n, "120"],
    [20n, "2432902008176640000"],
    // ab 21! ist `number` still ungenau — hier muss es exakt bleiben
    [21n, "51090942171709440000"],
    [25n, "15511210043330985984000000"],
  ];

  it.each(cases)("factorial(%s) = %s", (n, expected) => {
    expect(factorial(n).toString()).toBe(expected);
  });

  it("lehnt negative Eingaben ab", () => {
    expect(() => factorial(-1n)).toThrow(ExpressionError);
  });

  it("lehnt unverhältnismäßig große Eingaben ab", () => {
    expect(() => factorial(2001n)).toThrow(ExpressionError);
  });
});

describe("binomial", () => {
  const cases: ReadonlyArray<readonly [bigint, bigint, string]> = [
    [0n, 0n, "1"],
    [5n, 0n, "1"],
    [5n, 5n, "1"], // k = n
    [5n, 6n, "0"], // k > n
    [10n, 3n, "120"],
    [49n, 6n, "13983816"], // Lotto
    [100n, 50n, "100891344545564193334812497256"],
  ];

  it.each(cases)("binomial(%s, %s) = %s", (n, k, expected) => {
    expect(binomial(n, k).toString()).toBe(expected);
  });

  it("ist symmetrisch", () => {
    expect(binomial(30n, 12n)).toBe(binomial(30n, 18n));
  });

  it("lehnt negative Eingaben ab", () => {
    expect(() => binomial(-1n, 2n)).toThrow(ExpressionError);
  });
});

describe("permutations", () => {
  const cases: ReadonlyArray<readonly [bigint, bigint, string]> = [
    [5n, 0n, "1"],
    [5n, 1n, "5"],
    [5n, 5n, "120"],
    [5n, 6n, "0"],
    [10n, 3n, "720"],
  ];

  it.each(cases)("permutations(%s, %s) = %s", (n, k, expected) => {
    expect(permutations(n, k).toString()).toBe(expected);
  });
});

describe("power", () => {
  it("rechnet exakt", () => {
    expect(power(2n, 64n).toString()).toBe("18446744073709551616");
  });

  it("lehnt negative Exponenten ab", () => {
    expect(() => power(2n, -1n)).toThrow(ExpressionError);
  });

  it("lehnt Exponenten jenseits der Grenze ab", () => {
    expect(() => power(2n, 4097n)).toThrow(ExpressionError);
  });
});

describe("exactSqrt", () => {
  it.each([
    [0n, "0"],
    [1n, "1"],
    [144n, "12"],
    [14400n, "120"],
    [1000000000000000000000000n, "1000000000000"],
  ] as ReadonlyArray<readonly [bigint, string]>)("exactSqrt(%s) = %s", (n, expected) => {
    expect(exactSqrt(n)?.toString()).toBe(expected);
  });

  it("gibt undefined für Nicht-Quadratzahlen", () => {
    expect(exactSqrt(2n)).toBeUndefined();
    expect(exactSqrt(143n)).toBeUndefined();
    expect(exactSqrt(-4n)).toBeUndefined();
  });
});
