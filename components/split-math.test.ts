import { describe, expect, it } from "vitest";

import { splitMath } from "./split-math";

describe("splitMath", () => {
  it("lässt reinen Text unangetastet", () => {
    expect(splitMath("Wie viele Teilmengen hat eine Menge?")).toEqual([
      { kind: "text", value: "Wie viele Teilmengen hat eine Menge?" },
    ]);
  });

  it("erkennt Inline-Mathematik", () => {
    expect(splitMath("Gib das Ergebnis als Bruch $a/b$ an.")).toEqual([
      { kind: "text", value: "Gib das Ergebnis als Bruch " },
      { kind: "math", value: "a/b", display: false },
      { kind: "text", value: " an." },
    ]);
  });

  it("erkennt abgesetzte Mathematik", () => {
    expect(splitMath("Formel:\n$$2^{10} = 1024$$")).toEqual([
      { kind: "text", value: "Formel:\n" },
      { kind: "math", value: "2^{10} = 1024", display: true },
    ]);
  });

  it("verwechselt $$ nicht mit zwei $", () => {
    const segments = splitMath("$$\\frac{1}{2}$$");
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ kind: "math", value: "\\frac{1}{2}", display: true });
  });

  it("kommt mit mehreren Formeln in einem Text zurecht", () => {
    const segments = splitMath("Erst $a$, dann $$b$$, zum Schluss $c$.");
    expect(segments.filter((segment) => segment.kind === "math")).toHaveLength(3);
    expect(segments.map((segment) => segment.kind)).toEqual([
      "text",
      "math",
      "text",
      "math",
      "text",
      "math",
      "text",
    ]);
  });

  it("behält Zeilenumbrüche im Fließtext", () => {
    const segments = splitMath("Zeile eins\nZeile zwei");
    expect(segments[0]?.value).toBe("Zeile eins\nZeile zwei");
  });

  it("lässt ein einzelnes Dollarzeichen in Ruhe", () => {
    expect(splitMath("Der Preis liegt bei 5 $ pro Stück.")).toEqual([
      { kind: "text", value: "Der Preis liegt bei 5 $ pro Stück." },
    ]);
  });

  it("greift nicht über Zeilengrenzen bei Inline-Mathematik", () => {
    // Sonst würde ein vergessenes schließendes $ den halben Text verschlucken.
    const segments = splitMath("$a\nb$");
    expect(segments).toEqual([{ kind: "text", value: "$a\nb$" }]);
  });

  it("zerlegt einen echten Lösungstext aus dem Content", () => {
    const solution =
      "Stars and Bars — 7 Sterne und 3-1 Trennstriche:\n$$\\binom{ 7+3-1 }{ 3-1 } = 36$$";
    const segments = splitMath(solution);
    expect(segments).toHaveLength(2);
    expect(segments[1]).toEqual({
      kind: "math",
      value: "\\binom{ 7+3-1 }{ 3-1 } = 36",
      display: true,
    });
  });
});
