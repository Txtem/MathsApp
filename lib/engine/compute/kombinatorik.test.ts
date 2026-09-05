import { describe, expect, it } from "vitest";

import { ExpressionError } from "../errors";
import { binomial, factorial, permutations } from "../expr/bigmath";
import { toStorageString } from "../expr/rational";
import {
  combinationsWithRepetition,
  distributions,
  letterPermutations,
  multisetPermutations,
} from "./kombinatorik";
import { registry } from "./registry";

const via = (
  ref: keyof typeof registry,
  params: Record<string, number | string>,
): string | undefined => {
  const result = registry[ref].run(params);
  return result ? toStorageString(result) : undefined;
};

describe("letterPermutations", () => {
  /**
   * Die Erwartungswerte sind **unabhängig nachgerechnet** und nicht aus dem
   * Template abgeleitet (D-15). Drei Wege, die alle dasselbe ergeben haben:
   * die Multiset-Formel über die tatsächlichen Buchstabenhäufigkeiten, das
   * Abzählen aller verschiedenen Permutationen bis neun Buchstaben, und das
   * Platzieren jeder Buchstabengruppe über Binomialkoeffizienten.
   */
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["OTTO", "6"], // O2 T2 → 4!/(2!·2!)
    ["ANNA", "6"],
    ["EGGE", "6"],
    ["BOOT", "12"], // B1 O2 T1 → 4!/2!
    ["NENNE", "10"], // N3 E2 → 5!/(3!·2!)
    ["SEELE", "20"], // S1 E3 L1 → 5!/3!
    ["ESSEN", "30"], // E2 S2 N1 → 5!/(2!·2!)
    ["TASSE", "60"], // T1 A1 S2 E1 → 5!/2!
    ["ANANAS", "60"], // A3 N2 S1 → 6!/(3!·2!)
    ["KAFFEE", "180"], // K1 A1 F2 E2 → 6!/(2!·2!)
    ["BANANE", "180"], // B1 A2 N2 E1
    ["TOMATE", "360"], // T2 O1 M1 A1 E1 → 6!/2!
    ["BANANEN", "420"], // B1 A2 N3 E1 → 7!/(2!·3!)
    ["ERDBEERE", "840"], // E4 R2 D1 B1 → 8!/(4!·2!)
    ["TEETASSE", "1680"], // T2 E3 A1 S2 → 8!/(2!·3!·2!)
    ["KAROTTE", "2520"], // sechs verschiedene Buchstaben, T2
    ["PARALLEL", "3360"], // P1 A2 R1 L3 E1
    ["RENNTIER", "5040"], // R2 E2 N2 T1 I1
    ["HIMBEERE", "6720"], // E3, sonst einfach
    ["BROMBEERE", "15120"], // B2 R2 O1 M1 E3
    ["MISSISSIPPI", "34650"], // der Fall aus D-15
  ];

  it.each(cases)("%s → %s", (word, expected) => {
    expect(letterPermutations(word).toString()).toBe(expected);
  });

  it("gibt für lauter verschiedene Buchstaben die Fakultät", () => {
    expect(letterPermutations("HAUS").toString()).toBe("24");
    expect(letterPermutations("ZEBRA").toString()).toBe("120");
  });

  it("gibt für lauter gleiche Buchstaben genau eine Anordnung", () => {
    expect(letterPermutations("AAAA").toString()).toBe("1");
  });

  it("kennt keine Grenze bei vier Gruppen", () => {
    // `multisetPermutations` nimmt zwei bis vier Gruppen (D-15). Diese Funktion
    // zählt selbst und ist deshalb nicht beschränkt.
    expect(letterPermutations("KAROTTE").toString()).toBe("2520"); // sechs Gruppen
    expect(letterPermutations("SCHIFFE").toString()).toBe("2520");
  });

  it("stimmt mit multisetPermutations überein, wo beide anwendbar sind", () => {
    // Dieselbe Mathematik, andere Signatur.
    expect(letterPermutations("MISSISSIPPI")).toBe(multisetPermutations(11n, [4n, 4n, 2n, 1n]));
    expect(letterPermutations("ANANAS")).toBe(multisetPermutations(6n, [3n, 2n, 1n]));
  });

  it("weist ein leeres Wort ab", () => {
    expect(() => letterPermutations("")).toThrow(ExpressionError);
  });

  it("bleibt bei langen Wörtern exakt", () => {
    // 20 Buchstaben, zehnmal A und zehnmal B — der mittlere Binomialkoeffizient.
    expect(letterPermutations("AAAAAAAAAABBBBBBBBBB").toString()).toBe(binomial(20n, 10n).toString());
  });

  describe("über die Registry", () => {
    it("rechnet ein gültiges Wort", () => {
      expect(via("kombinatorik.permutation.wort", { wort: "MISSISSIPPI" })).toBe("34650");
    });

    it("lehnt Kleinbuchstaben, Umlaute und Ziffern ab", () => {
      for (const wort of ["tasse", "TASSEÄ", "TA5SE", "TA SE", "STRASSE-1"]) {
        expect(via("kombinatorik.permutation.wort", { wort })).toBeUndefined();
      }
    });

    it("lehnt zu kurze und zu lange Wörter ab", () => {
      expect(via("kombinatorik.permutation.wort", { wort: "A" })).toBeUndefined();
      expect(via("kombinatorik.permutation.wort", { wort: "A".repeat(21) })).toBeUndefined();
    });

    it("lehnt einen überzähligen Parameter ab", () => {
      // `strictObject`: Ein Template mit einem Parameter zu viel fällt auf.
      expect(via("kombinatorik.permutation.wort", { wort: "TASSE", n: 5 })).toBeUndefined();
    });
  });
});

describe("multisetPermutations", () => {
  const cases: ReadonlyArray<readonly [bigint, readonly bigint[], string]> = [
    [11n, [4n, 4n, 2n, 1n], "34650"], // MISSISSIPPI
    [10n, [4n, 4n, 2n], "3150"], // MISSISSIPPI ohne das M
    [11n, [5n, 4n, 2n], "6930"], // drei Gruppen, zum Vergleich
    [3n, [1n, 1n, 1n], "6"], // alle verschieden ⇒ 3!
    [4n, [2n, 2n, 0n], "6"],
    [5n, [5n, 0n, 0n], "1"], // alle gleich ⇒ nur eine Anordnung
    [0n, [0n], "1"],
    [10n, [4n, 3n, 3n], "4200"],
  ];

  it.each(cases)("n=%s, Gruppen=%s → %s", (n, groups, expected) => {
    expect(multisetPermutations(n, groups).toString()).toBe(expected);
  });

  it("verlangt, dass die Gruppen zusammen n ergeben", () => {
    expect(() => multisetPermutations(5n, [2n, 2n])).toThrow(ExpressionError);
    expect(() => multisetPermutations(5n, [3n, 3n])).toThrow(ExpressionError);
  });

  it("bleibt bei großem n exakt", () => {
    // 100! / (50!·50!) ist der mittlere Binomialkoeffizient.
    expect(multisetPermutations(100n, [50n, 50n]).toString()).toBe(
      binomial(100n, 50n).toString(),
    );
  });

  it("lehnt über die Registry Gruppen ab, die nicht aufgehen", () => {
    expect(via("kombinatorik.permutation.multiset", { n: 10, k1: 5, k2: 4, k3: 2 })).toBeUndefined();
    expect(via("kombinatorik.permutation.multiset", { n: 11, k1: 5, k2: 4, k3: 2 })).toBe("6930");
  });

  it("nimmt zwei bis vier Gruppen entgegen", () => {
    // Der Fall, an dem aufg_00004 gescheitert ist: MISSISSIPPI hat vier
    // Buchstabengruppen, nicht drei.
    expect(via("kombinatorik.permutation.multiset", { n: 11, k1: 4, k2: 4, k3: 2, k4: 1 })).toBe(
      "34650",
    );
    expect(via("kombinatorik.permutation.multiset", { n: 5, k1: 3, k2: 2 })).toBe("10");
    expect(via("kombinatorik.permutation.multiset", { n: 9, k1: 3, k2: 3, k3: 3 })).toBe("1680");
    // Eine Gruppe der Größe 0 gibt es nicht — sie wird weggelassen.
    expect(via("kombinatorik.permutation.multiset", { n: 5, k1: 3, k2: 2, k3: 0 })).toBeUndefined();
    // Fünf Gruppen kennt das Schema nicht.
    expect(
      via("kombinatorik.permutation.multiset", { n: 6, k1: 2, k2: 1, k3: 1, k4: 1, k5: 1 }),
    ).toBeUndefined();
  });
});

describe("combinationsWithRepetition", () => {
  const cases: ReadonlyArray<readonly [bigint, bigint, string]> = [
    [5n, 3n, "35"], // C(7,3)
    [3n, 5n, "21"], // k > n ist hier erlaubt: C(7,5)
    [1n, 4n, "1"],
    [4n, 1n, "4"],
    [5n, 0n, "1"], // k = 0
    [0n, 0n, "1"], // leere Menge, nichts ziehen
    [10n, 10n, "92378"],
  ];

  it.each(cases)("n=%s, k=%s → %s", (n, k, expected) => {
    expect(combinationsWithRepetition(n, k).toString()).toBe(expected);
  });

  it("lehnt das Ziehen aus der leeren Menge ab", () => {
    expect(() => combinationsWithRepetition(0n, 3n)).toThrow(ExpressionError);
  });

  it("bleibt bei großem n exakt", () => {
    expect(combinationsWithRepetition(200n, 100n).toString()).toBe(binomial(299n, 100n).toString());
  });
});

describe("distributions — Stars and Bars", () => {
  const cases: ReadonlyArray<readonly [bigint, bigint, string]> = [
    [10n, 4n, "286"], // C(13,3)
    [0n, 4n, "1"], // nichts zu verteilen
    [5n, 1n, "1"], // ein Fach
    [1n, 5n, "5"],
    [7n, 3n, "36"],
    [20n, 5n, "10626"],
  ];

  it.each(cases)("n=%s auf k=%s Fächer → %s", (n, k, expected) => {
    expect(distributions(n, k).toString()).toBe(expected);
  });

  it("braucht mindestens ein Fach", () => {
    expect(() => distributions(5n, 0n)).toThrow(ExpressionError);
    expect(via("kombinatorik.verteilung.nichtnegativ", { n: 5, k: 0 })).toBeUndefined();
  });
});

describe("Registry-Randfälle der Kombinatorik", () => {
  it("kennt n = 0 überall dort, wo es definiert ist", () => {
    expect(via("kombinatorik.permutation.factorial", { n: 0 })).toBe("1");
    expect(via("kombinatorik.teilmengen.anzahl", { n: 0 })).toBe("1");
    expect(via("kombinatorik.variation.ohne_wdh", { n: 0, k: 0 })).toBe("1");
    expect(via("kombinatorik.kombination.ohne_wdh", { n: 0, k: 0 })).toBe("1");
  });

  it("kennt k = 0 und k = n", () => {
    expect(via("kombinatorik.variation.ohne_wdh", { n: 7, k: 0 })).toBe("1");
    expect(via("kombinatorik.variation.ohne_wdh", { n: 7, k: 7 })).toBe(factorial(7n).toString());
    expect(via("kombinatorik.kombination.ohne_wdh", { n: 7, k: 0 })).toBe("1");
    expect(via("kombinatorik.kombination.ohne_wdh", { n: 7, k: 7 })).toBe("1");
    expect(via("kombinatorik.variation.mit_wdh", { n: 7, k: 0 })).toBe("1");
  });

  it("lehnt k > n dort ab, wo es keinen Sinn ergibt", () => {
    expect(via("kombinatorik.variation.ohne_wdh", { n: 5, k: 6 })).toBeUndefined();
    expect(via("kombinatorik.kombination.ohne_wdh", { n: 5, k: 6 })).toBeUndefined();
    // Mit Wiederholung ist k > n dagegen erlaubt.
    expect(via("kombinatorik.variation.mit_wdh", { n: 5, k: 6 })).toBe("15625");
    expect(via("kombinatorik.kombination.mit_wdh", { n: 5, k: 6 })).toBe("210");
  });

  it("rechnet auch dort exakt, wo number überliefe", () => {
    // 25! hat 26 Stellen, C(500,250) über 149.
    expect(via("kombinatorik.permutation.factorial", { n: 25 })).toBe(factorial(25n).toString());
    expect(via("kombinatorik.variation.ohne_wdh", { n: 100, k: 20 })).toBe(
      permutations(100n, 20n).toString(),
    );
    expect(via("kombinatorik.kombination.ohne_wdh", { n: 500, k: 250 })).toBe(
      binomial(500n, 250n).toString(),
    );
    expect(via("kombinatorik.teilmengen.anzahl", { n: 200 })).toBe((2n ** 200n).toString());
  });

  it("begrenzt die Eingaben, statt beliebig lange zu rechnen", () => {
    expect(via("kombinatorik.permutation.factorial", { n: 501 })).toBeUndefined();
    expect(via("kombinatorik.permutation.factorial", { n: -1 })).toBeUndefined();
  });
});
