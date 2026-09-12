import { describe, expect, it } from "vitest";

import {
  factorialProduct,
  reducedFactorialProduct,
  reductionStep,
  repeatedLetters,
  timesWord,
} from "./display";
import { letterCounts, letterGroups } from "./kombinatorik";

describe("factorialProduct", () => {
  it("verkettet die Fakultäten mit LaTeX-Malpunkten", () => {
    expect(factorialProduct([4, 4, 2])).toBe("4! \\cdot 4! \\cdot 2!");
  });

  it("lässt eine einzelne Gruppe ohne Malpunkt stehen", () => {
    expect(factorialProduct([3])).toBe("3!");
  });

  it("gibt bei keiner Gruppe eine Eins", () => {
    // Ein leeres Produkt ist 1 — als Nenner darf da nichts Leeres stehen.
    expect(factorialProduct([])).toBe("1");
  });
});

describe("reducedFactorialProduct", () => {
  it("lässt die Einsfakultäten weg", () => {
    expect(reducedFactorialProduct([1, 1, 1, 1, 2, 1])).toBe("2!");
    expect(reducedFactorialProduct([1, 4, 4, 2])).toBe("4! \\cdot 4! \\cdot 2!");
  });

  it("lässt eine Gruppenfolge ohne Einsen unverändert", () => {
    expect(reducedFactorialProduct([2, 2])).toBe("2! \\cdot 2!");
  });

  it("gibt eine Eins, wenn alle Buchstaben verschieden sind", () => {
    expect(reducedFactorialProduct([1, 1, 1])).toBe("1");
  });
});

describe("reductionStep", () => {
  /**
   * Der Kürzungsschritt steht als **ein** Wert im Template, weil YAML keine
   * Bedingung ausdrücken kann: `{{kuerzung}}` erscheint entweder oder gar nicht.
   */
  it("zeigt den Schritt, wo er etwas ändert", () => {
    // KAROTTE: 1!·1!·1!·1!·2!·1! wird zu 2!.
    expect(reductionStep(7, [1, 1, 1, 1, 2, 1])).toBe("= \\frac{ 7! }{ 2! } ");
  });

  it("bleibt leer, wo nichts wegfällt", () => {
    // OTTO: 2!·2! ist schon die kurze Form.
    expect(reductionStep(4, [2, 2])).toBe("");
  });

  it("greift auch, wenn nur eine einzige Eins wegfällt", () => {
    // MISSISSIPPI: das 1! des M.
    expect(reductionStep(11, [1, 4, 4, 2])).toBe("= \\frac{ 11! }{ 4! \\cdot 4! \\cdot 2! } ");
  });

  it("endet mit einem Leerzeichen, damit das Gleichheitszeichen dahinter passt", () => {
    // Im Template steht `{{kuerzung}}= {{result}}`.
    expect(reductionStep(5, [1, 1, 2, 1]).endsWith(" ")).toBe(true);
  });
});

describe("timesWord", () => {
  const cases: ReadonlyArray<readonly [number, string]> = [
    [2, "zweimal"],
    [3, "dreimal"],
    [4, "viermal"],
    [5, "fünfmal"],
    [10, "zehnmal"],
  ];

  it.each(cases)("%s → %s", (count, expected) => {
    expect(timesWord(count)).toBe(expected);
  });

  it("schreibt darüber hinaus mit Ziffer", () => {
    expect(timesWord(11)).toBe("11-mal");
    expect(timesWord(14)).toBe("14-mal");
  });
});

describe("repeatedLetters", () => {
  const fuer = (wort: string): string => repeatedLetters(letterGroups(wort));

  it("nennt einen doppelten Buchstaben", () => {
    expect(fuer("KAROTTE")).toBe("T zweimal");
  });

  it("nennt mehrere, in der Reihenfolge des ersten Auftretens", () => {
    expect(fuer("MISSISSIPPI")).toBe("I viermal, S viermal, P zweimal");
    expect(fuer("OTTO")).toBe("O zweimal, T zweimal");
  });

  it("lässt die einmaligen Buchstaben weg", () => {
    // Sie stehen ohnehin im Wort und tragen zur Rechnung nichts bei.
    expect(fuer("TASSE")).toBe("S zweimal");
    expect(fuer("ANANAS")).toBe("A dreimal, N zweimal");
  });

  it("sagt es auch, wenn nichts doppelt ist", () => {
    expect(fuer("HAUS")).toBe("kein Buchstabe doppelt");
  });
});

describe("die Formen passen zueinander", () => {
  /**
   * Die Gegenprobe zwischen Text und Rechnung: Was der Lösungsweg als
   * Wiederholung nennt, muss genau das sein, was im gekürzten Nenner steht.
   */
  const woerter = ["KAROTTE", "MISSISSIPPI", "OTTO", "TASSE", "ANANAS", "TEETASSE", "SEELE"];

  it.each(woerter)("%s: gekürzter Nenner und Klartext nennen dieselben Gruppen", (wort) => {
    const gruppen = letterGroups(wort).filter(([, count]) => count > 1);
    const kurz = reducedFactorialProduct(letterCounts(wort));
    const klartext = repeatedLetters(letterGroups(wort));

    expect(kurz.split(" \\cdot ")).toEqual(gruppen.map(([, count]) => `${count}!`));
    expect(klartext.split(", ")).toHaveLength(gruppen.length);
  });

  it("die volle Form nennt so viele Faktoren, wie das Wort Buchstabengruppen hat", () => {
    for (const wort of woerter) {
      expect(factorialProduct(letterCounts(wort)).split(" \\cdot "), wort).toHaveLength(
        letterGroups(wort).length,
      );
    }
  });
});
