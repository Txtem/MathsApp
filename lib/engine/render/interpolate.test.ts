import { describe, expect, it } from "vitest";

import { TemplateConfigError, TemplateRenderError } from "../errors";
import { interpolate, placeholders } from "./interpolate";

describe("interpolate", () => {
  it("ersetzt Platzhalter durch Werte", () => {
    expect(
      interpolate("Auf wie viele Arten können {{n}} Personen Platz nehmen?", { n: 7 }),
    ).toBe("Auf wie viele Arten können 7 Personen Platz nehmen?");
  });

  it("ersetzt denselben Platzhalter mehrfach", () => {
    expect(interpolate("{{n}}! = {{result}}, also {{n}} Elemente", { n: 5, result: "120" })).toBe(
      "5! = 120, also 5 Elemente",
    );
  });

  it("stellt auch Strings und Booleans dar", () => {
    expect(interpolate("{{label}} / {{ordered}}", { label: "rot", ordered: false })).toBe(
      "rot / false",
    );
  });

  it("lässt Text ohne Platzhalter unverändert", () => {
    expect(interpolate("Kein Platzhalter hier.", {})).toBe("Kein Platzhalter hier.");
  });

  it("wirft bei einem Platzhalter ohne Wert", () => {
    expect(() => interpolate("{{n}} + {{m}}", { n: 1 })).toThrow(TemplateRenderError);
    // Bleibt für bestehende Aufrufer ein TemplateConfigError.
    expect(() => interpolate("{{n}} + {{m}}", { n: 1 })).toThrow(TemplateConfigError);
  });

  it("nutzt keine geerbten Objekteigenschaften als Wert", () => {
    expect(() => interpolate("{{tostring}}", {})).toThrow(TemplateRenderError);
    expect(() => interpolate("{{constructor}}", {})).toThrow(TemplateRenderError);
  });
});

describe("interpolate — LaTeX bleibt unberührt", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["$\frac{1}{2}$", "$\frac{1}{2}$"],
    ["$\sqrt{2}$", "$\sqrt{2}$"],
    ["Menge {1, 2, 3} und {}", "Menge {1, 2, 3} und {}"],
    ["$x^{2}$", "$x^{2}$"],
  ];

  it.each(cases)("%s bleibt %s", (input, expected) => {
    expect(interpolate(input, {})).toBe(expected);
  });

  it("mischt Platzhalter und LaTeX-Argumentklammern", () => {
    expect(interpolate("$$\binom{{{n}}}{{{k}}} = \frac{1}{2}$$", { n: 9, k: 3 })).toBe(
      "$$\binom{9}{3} = \frac{1}{2}$$",
    );
  });

  it("rendert die Fakultätsformel aus SPEC-M1", () => {
    expect(
      interpolate("$${{n}}! = {{result}}$$", { n: 5, result: "120" }),
    ).toBe("$$5! = 120$$");
  });
});

describe("interpolate — Assertion auf übrig gebliebene Klammern", () => {
  const invalid: readonly string[] = [
    "{{ n }}", // Leerzeichen
    "{{N}}", // Großbuchstabe
    "{{2n}}", // beginnt mit Ziffer
    "{{n-1}}", // Bindestrich
    "{{n}", // halb offen
  ];

  it.each(invalid)("%s wird nicht still stehen gelassen", (text) => {
    expect(() => interpolate(text, { n: 5 })).toThrow(TemplateRenderError);
  });

  it("meldet auch einen Rest, der erst durch einen Wert entsteht", () => {
    // Der Wert selbst darf keine offene Klammer einschleusen.
    expect(() => interpolate("{{a}}", { a: "{{b}}" })).toThrow(TemplateRenderError);
  });
});

describe("placeholders", () => {
  it("sammelt alle Namen ohne Dubletten", () => {
    expect(placeholders("{{n}} und {{k}} und nochmal {{n}}")).toEqual(new Set(["n", "k"]));
  });

  it("zählt einfache Klammern nicht mit", () => {
    expect(placeholders("\frac{1}{2} mit {{n}}")).toEqual(new Set(["n"]));
  });

  it("liefert für Text ohne Platzhalter die leere Menge", () => {
    expect(placeholders("nichts").size).toBe(0);
  });
});
