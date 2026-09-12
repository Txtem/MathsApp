import { describe, expect, it } from "vitest";

import { expectedDisplay, withDecimalComma } from "./expected-answer";

describe("withDecimalComma", () => {
  it("macht aus dem Punkt ein Komma", () => {
    expect(withDecimalComma("0.5055")).toBe("0,5055");
    expect(withDecimalComma("-1.25")).toBe("-1,25");
  });

  it("lässt eine ganze Zahl in Ruhe", () => {
    expect(withDecimalComma("42")).toBe("42");
  });

  it("lässt einen Bruch in Ruhe", () => {
    expect(withDecimalComma("46/91")).toBe("46/91");
  });
});

describe("expectedDisplay", () => {
  it("zeigt ohne round_to nur den exakten Wert", () => {
    expect(expectedDisplay("46/91")).toEqual({ primary: "46/91", exact: null });
    expect(expectedDisplay("120")).toEqual({ primary: "120", exact: null });
  });

  it("stellt bei round_to die gerundete Zahl voran", () => {
    // Das ist der Fall aus der Übungsphase: gefragt war die Dezimalzahl.
    expect(expectedDisplay("46/91", "0.5055")).toEqual({
      primary: "0,5055",
      exact: "46/91",
    });
  });

  it("behält den exakten Wert als Bruch, ohne Komma", () => {
    expect(expectedDisplay("5/12", "0.4167").exact).toBe("5/12");
  });

  it("lässt den Zusatz weg, wenn beide Formen gleich sind", () => {
    // „2 (exakt 2)" erklärt nichts.
    expect(expectedDisplay("2", "2")).toEqual({ primary: "2", exact: null });
  });

  it("zeigt den Zusatz, wenn die Rundung sichtbar etwas weglässt", () => {
    expect(expectedDisplay("2", "2.0000")).toEqual({ primary: "2,0000", exact: "2" });
  });

  it("kommt mit negativen Werten zurecht", () => {
    expect(expectedDisplay("-3/4", "-0.75")).toEqual({ primary: "-0,75", exact: "-3/4" });
  });
});
