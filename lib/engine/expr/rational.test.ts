import { describe, expect, it } from "vitest";

import { ExpressionError } from "../errors";
import {
  abs,
  add,
  compare,
  div,
  equals,
  fromBigInt,
  fromDecimalString,
  fromStorageString,
  isInteger,
  mul,
  neg,
  pow,
  rational,
  round,
  sub,
  toDecimalString,
  toNumber,
  toStorageString,
} from "./rational";

const r = (num: bigint, den: bigint = 1n) => rational(num, den);
const s = (value: { num: bigint; den: bigint }) => toStorageString(value);

describe("rational — Konstruktor", () => {
  it("kürzt", () => {
    expect(s(r(4n, 8n))).toBe("1/2");
    expect(s(r(100n, 10n))).toBe("10");
    expect(s(r(0n, 7n))).toBe("0");
  });

  it("hält den Nenner positiv", () => {
    expect(r(1n, -2n)).toEqual({ num: -1n, den: 2n });
    expect(r(-1n, -2n)).toEqual({ num: 1n, den: 2n });
  });

  it("lehnt den Nenner null ab", () => {
    expect(() => r(1n, 0n)).toThrow(ExpressionError);
  });

  it("erkennt ganze Zahlen am Nenner", () => {
    expect(isInteger(r(6n, 3n))).toBe(true);
    expect(isInteger(r(1n, 3n))).toBe(false);
  });
});

describe("rational — Grundrechenarten bleiben exakt", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    [s(add(r(1n, 3n), r(1n, 6n))), "1/2"],
    [s(sub(r(1n, 3n), r(1n, 3n))), "0"],
    [s(mul(r(2n, 3n), r(3n, 4n))), "1/2"],
    [s(div(r(1n, 3n), r(2n, 5n))), "5/6"],
    [s(add(r(1n, 3n), r(2n, 3n))), "1"],
    [s(neg(r(3n, 4n))), "-3/4"],
    [s(abs(r(-3n, 4n))), "3/4"],
  ];

  it.each(cases)("ergibt %s (erwartet %s)", (actual, expected) => {
    expect(actual).toBe(expected);
  });

  it("addiert Drittel ohne Rundungsfehler", () => {
    const third = r(1n, 3n);
    expect(equals(add(add(third, third), third), fromBigInt(1n))).toBe(true);
  });

  it("trifft den Fall, an dem float64 scheitert", () => {
    expect(equals(add(fromDecimalString("0.1"), fromDecimalString("0.2")), r(3n, 10n))).toBe(true);
    // Zum Vergleich, und der Grund für den ganzen Aufwand:
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it("lehnt Division durch null ab", () => {
    expect(() => div(r(1n), r(0n))).toThrow(ExpressionError);
  });
});

describe("rational — Potenzen", () => {
  it("rechnet positive Exponenten exakt", () => {
    expect(s(pow(r(2n), 64n))).toBe("18446744073709551616");
    expect(s(pow(r(2n, 3n), 3n))).toBe("8/27");
  });

  it("kehrt bei negativen Exponenten um", () => {
    expect(s(pow(r(2n), -3n))).toBe("1/8");
    expect(s(pow(r(2n, 3n), -2n))).toBe("9/4");
  });

  it("begrenzt den Aufwand", () => {
    expect(() => pow(r(2n), 100000n)).toThrow(ExpressionError);
    expect(() => pow(r(0n), -1n)).toThrow(ExpressionError);
  });
});

describe("rational — Vergleich", () => {
  it("vergleicht über Kreuzmultiplikation", () => {
    expect(compare(r(1n, 3n), r(1n, 2n))).toBe(-1);
    expect(compare(r(1n, 2n), r(1n, 3n))).toBe(1);
    expect(compare(r(2n, 4n), r(1n, 2n))).toBe(0);
  });

  it("bleibt jenseits von 2^53 genau", () => {
    const a = fromBigInt(9007199254740993n);
    const b = fromBigInt(9007199254740992n);
    expect(compare(a, b)).toBe(1);
    // In float64 wären beide gleich.
    expect(Number(a.num)).toBe(Number(b.num));
  });
});

describe("rational — Dezimaleingaben verlustfrei", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["2.5", "5/2"],
    ["0.0177", "177/10000"],
    ["0.1", "1/10"],
    ["120", "120"],
    ["120.000", "120"],
    ["2.5e3", "2500"],
    ["1e6", "1000000"],
    ["1.5e-1", "3/20"],
    ["0.000", "0"],
  ];

  it.each(cases)("%s → %s", (text, expected) => {
    expect(s(fromDecimalString(text))).toBe(expected);
  });

  it("lehnt Unfug ab", () => {
    expect(() => fromDecimalString("abc")).toThrow(ExpressionError);
    expect(() => fromDecimalString("")).toThrow(ExpressionError);
    expect(() => fromDecimalString("1e99999")).toThrow(ExpressionError);
  });
});

describe("rational — Speicherform", () => {
  const roundtrip: readonly string[] = ["41", "-41", "0", "3/8", "-3/8", "2432902008176640000"];

  it.each(roundtrip)("überlebt den Weg durch die Datenbank: %s", (text) => {
    const parsed = fromStorageString(text);
    expect(parsed).toBeDefined();
    expect(parsed && toStorageString(parsed)).toBe(text);
  });

  it("kürzt beim Einlesen", () => {
    expect(s(fromStorageString("4/8") ?? r(0n))).toBe("1/2");
  });

  it("gibt undefined für alles, was keine Zahl ist", () => {
    for (const bad of ["", "abc", "1/0", "1.5", "1/2/3", "--1", "1 / 2"]) {
      expect(fromStorageString(bad), bad).toBeUndefined();
    }
  });
});

describe("rational — Runden", () => {
  const cases: ReadonlyArray<readonly [string, number, string]> = [
    ["1/3", 4, "0.3333"],
    ["2/3", 4, "0.6667"],
    ["1/2", 0, "1"], // kaufmännisch: die Hälfte geht vom Nullpunkt weg
    ["-1/2", 0, "-1"],
    ["3/2", 0, "2"],
    ["177/10000", 4, "0.0177"],
    ["177/10000", 2, "0.02"],
    ["1/8", 2, "0.13"],
    ["5", 2, "5.00"],
    ["-1/3", 2, "-0.33"],
  ];

  it.each(cases)("%s auf %s Stellen → %s", (value, digits, expected) => {
    const parsed = fromStorageString(value);
    expect(parsed).toBeDefined();
    if (!parsed) return;
    expect(toDecimalString(parsed, digits)).toBe(expected);
  });

  it("liefert beim Runden wieder einen Bruch", () => {
    expect(s(round(r(1n, 3n), 2))).toBe("33/100");
    expect(s(round(r(2n, 3n), 0))).toBe("1");
  });

  it("lehnt unsinnige Stellenzahlen ab", () => {
    expect(() => round(r(1n, 3n), -1)).toThrow(ExpressionError);
    expect(() => round(r(1n, 3n), 1.5)).toThrow(ExpressionError);
  });
});

describe("rational — Näherung als number", () => {
  it("nähert gewöhnliche Brüche", () => {
    expect(toNumber(r(1n, 2n))).toBe(0.5);
    expect(toNumber(r(1n, 3n))).toBeCloseTo(0.3333333333333333, 15);
  });

  it("bleibt auch bei sehr großen Zählern und Nennern endlich", () => {
    const huge = rational(10n ** 400n, 3n * 10n ** 399n);
    expect(toNumber(huge)).toBeCloseTo(10 / 3, 10);
  });
});
