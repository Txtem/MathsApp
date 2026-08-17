import { describe, expect, it } from "vitest";

import { add, subtract } from "./arithmetik";

describe("arithmetik.add", () => {
  const cases: ReadonlyArray<readonly [bigint, bigint, string]> = [
    [BigInt(0), BigInt(0), "0"],
    [BigInt(2), BigInt(3), "5"],
    [BigInt(-7), BigInt(3), "-4"],
    [BigInt(-7), BigInt(-3), "-10"],
    [BigInt(5), BigInt(-5), "0"],
    // größer als Number.MAX_SAFE_INTEGER — hier würde `number` still falsch rechnen
    [BigInt("9007199254740993"), BigInt(1), "9007199254740994"],
    [BigInt("123456789012345678901234567890"), BigInt(1), "123456789012345678901234567891"],
  ];

  it.each(cases)("add(%s, %s) = %s", (a, b, expected) => {
    expect(add(a, b).toString()).toBe(expected);
  });

  it("ist kommutativ", () => {
    expect(add(BigInt(41), BigInt(1))).toBe(add(BigInt(1), BigInt(41)));
  });
});

describe("arithmetik.subtract", () => {
  const cases: ReadonlyArray<readonly [bigint, bigint, string]> = [
    [BigInt(0), BigInt(0), "0"],
    [BigInt(5), BigInt(3), "2"],
    // Ergebnis darf negativ werden — das ist Sache der Template-Constraints, nicht der Funktion
    [BigInt(3), BigInt(5), "-2"],
    [BigInt(-3), BigInt(-5), "2"],
    [BigInt(7), BigInt(-3), "10"],
    [BigInt("9007199254740993"), BigInt(1), "9007199254740992"],
  ];

  it.each(cases)("subtract(%s, %s) = %s", (a, b, expected) => {
    expect(subtract(a, b).toString()).toBe(expected);
  });

  it("kehrt add um", () => {
    const a = BigInt(1234567);
    const b = BigInt(89);
    expect(subtract(add(a, b), b)).toBe(a);
  });
});
