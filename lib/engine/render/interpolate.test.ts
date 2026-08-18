import { describe, expect, it } from "vitest";

import { TemplateConfigError } from "../errors";
import { interpolate, placeholders } from "./interpolate";

describe("interpolate", () => {
  it("ersetzt Platzhalter durch Werte", () => {
    expect(
      interpolate("Auf wie viele Arten können {n} Personen Platz nehmen?", { n: 7 }),
    ).toBe("Auf wie viele Arten können 7 Personen Platz nehmen?");
  });

  it("ersetzt denselben Platzhalter mehrfach", () => {
    expect(interpolate("{n}! = {result}, also {n} Elemente", { n: 5, result: "120" })).toBe(
      "5! = 120, also 5 Elemente",
    );
  });

  it("stellt auch Strings und Booleans dar", () => {
    expect(interpolate("{label} / {ordered}", { label: "rot", ordered: false })).toBe("rot / false");
  });

  it("lässt Text ohne Platzhalter unverändert", () => {
    expect(interpolate("Kein Platzhalter hier.", {})).toBe("Kein Platzhalter hier.");
  });

  it("wirft bei einem Platzhalter ohne Wert", () => {
    expect(() => interpolate("{n} + {m}", { n: 1 })).toThrow(TemplateConfigError);
  });

  it("ignoriert Klammern, die keine Platzhalter sind", () => {
    expect(interpolate("Menge {1, 2, 3} und {}", {})).toBe("Menge {1, 2, 3} und {}");
  });

  it("nutzt keine geerbten Objekteigenschaften als Wert", () => {
    expect(() => interpolate("{toString}", {})).toThrow(TemplateConfigError);
    expect(() => interpolate("{constructor}", {})).toThrow(TemplateConfigError);
  });
});

describe("placeholders", () => {
  it("sammelt alle Namen ohne Dubletten", () => {
    expect(placeholders("{n} und {k} und nochmal {n}")).toEqual(new Set(["n", "k"]));
  });

  it("liefert für Text ohne Platzhalter die leere Menge", () => {
    expect(placeholders("nichts").size).toBe(0);
  });
});
