import { describe, expect, it } from "vitest";

import { answerFormatHint } from "./answer-format";

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
    expect(answerFormatHint("integer")).toContain("5!");
  });

  it("verlangt bei fraction die gekürzte Form", () => {
    expect(answerFormatHint("fraction")).toContain("a/b");
  });

  it("hat für jeden in M1 unterstützten Typ einen Hinweis", () => {
    for (const type of ["integer", "numeric", "fraction", "choice"] as const) {
      expect(answerFormatHint(type), type).not.toBe("");
    }
  });
});
