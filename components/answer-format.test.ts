import { describe, expect, it } from "vitest";

import type { AnswerType } from "@/lib/engine/types";

import { answerFormatHint } from "./answer-format";

const TYPEN: readonly AnswerType[] = ["integer", "numeric", "fraction", "choice"];

describe("answerFormatHint", () => {
  it("nennt bei numeric die Stellenzahl, wenn round_to gesetzt ist", () => {
    expect(answerFormatHint("numeric", 4)).toContain("4 Nachkommastellen");
    expect(answerFormatHint("numeric")).not.toContain("Nachkommastellen");
  });

  it("warnt bei numeric vor Prozentangaben", () => {
    expect(answerFormatHint("numeric", 4)).toContain("Prozentwert");
    expect(answerFormatHint("numeric")).toContain("Prozentwert");
  });

  it("erklärt die erlaubten Ausdrücke bei integer", () => {
    const hint = answerFormatHint("integer");
    expect(hint).toContain("5!");
    expect(hint).toContain("combinations(10,3)");
  });

  it("nennt bei integer, dass die Schreibweise egal ist", () => {
    // Seit M2e C-6 wird der Funktionsname kleingeschrieben nachgeschlagen.
    expect(answerFormatHint("integer")).toMatch(/groß oder klein/i);
  });

  it("hat für jeden unterstützten Typ einen Hinweis", () => {
    for (const type of TYPEN) expect(answerFormatHint(type), type).not.toBe("");
  });

  describe("kein LaTeX", () => {
    /**
     * Der Anlass: `\frac{69}{420}` wurde eingetippt und nicht gelesen. Der
     * Hinweis erscheint an zwei Stellen — unter dem Eingabefeld und in der
     * Meldung „Das konnte ich nicht lesen" —, also genau dort, wo der Fall
     * auftritt.
     */
    it("sagt es bei jedem rechnenden Typ", () => {
      for (const type of ["integer", "numeric", "fraction"] as const) {
        expect(answerFormatHint(type), type).toContain("LaTeX");
      }
      expect(answerFormatHint("numeric", 4)).toContain("LaTeX");
    });

    it("zeigt bei fraction die abgelehnte Schreibweise wörtlich", () => {
      const hint = answerFormatHint("fraction");
      // Ein echter Backslash, kein Seitenvorschub — im Quelltext verdoppelt.
      expect(hint).toContain("\\frac{69}{420}");
      expect(hint).not.toContain("\f");
    });

    it("zeigt bei fraction die akzeptierte Schreibweise daneben", () => {
      const hint = answerFormatHint("fraction");
      expect(hint).toContain("69/420");
      expect(hint).toContain("1/3+1/12");
    });
  });

  it("bleibt kurz genug für eine Zeile unter dem Feld", () => {
    // Der Hinweis steht in einem schmalen `<p>`; drei Zeilen Text lesen sich
    // dort niemand durch.
    for (const type of TYPEN) {
      expect(answerFormatHint(type).length, type).toBeLessThan(160);
    }
  });
});
