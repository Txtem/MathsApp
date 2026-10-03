import { describe, expect, it } from "vitest";

import { fromStorageString, toDecimalString } from "@/lib/engine/expr/rational";
import { hintCount, instantiate, renderHint } from "@/lib/engine/instantiate";
import type { Template } from "@/lib/engine/types";

import { readContent } from "./read";

/**
 * Tipps verraten nie das Ergebnis (D-31).
 *
 * Prüfung 11 in `checks.ts` verhindert `{{result}}` und Anzeigewerte im Tipp,
 * aber nicht, dass jemand die Zahl ausrechnet und hineinschreibt. Deshalb hier
 * die unabhängige Gegenprobe über 200 Seeds je Template: Kein gerenderter Tipp
 * enthält die gerenderte Lösung als Zeichenfolge.
 *
 * **Ausnahme:** Lösungen mit weniger als drei Ziffern werden übersprungen. Eine
 * 6 steht auch in Parametern („6 Personen"), dort gäbe es nur Fehlalarme. Für
 * diese kleinen Ergebnisse bleibt nur Prüfung 11 und das Lesen.
 */

const SEEDS = Array.from({ length: 200 }, (_, i) => `seed-${i}`);

/** Darunter ist eine Lösung als Zeichenfolge nicht aussagekräftig genug. */
const MIN_DIGITS = 3;

/** Die Formen, in denen die Lösung angezeigt wird: exakt, und gerundet bei `round_to`. */
function solutionForms(expectedAnswer: string, roundTo: number | undefined): string[] {
  const forms = [expectedAnswer];
  const value = fromStorageString(expectedAnswer);
  if (roundTo !== undefined && value) {
    const rounded = toDecimalString(value, roundTo);
    forms.push(rounded, rounded.replace(".", ","));
  }
  return forms.filter((form) => (form.match(/\d/g) ?? []).length >= MIN_DIGITS);
}

/** Alle Fundstellen, an denen ein gerenderter Tipp die Lösung enthält. */
function revealingHints(
  template: Template & { readonly round_to?: number },
  seeds: readonly string[],
): string[] {
  const found: string[] = [];
  for (const seed of seeds) {
    const instance = instantiate(template, seed);
    const forms = solutionForms(instance.expectedAnswer, template.round_to);
    for (let i = 0; i < hintCount(template); i++) {
      const hint = renderHint(template, instance.params, i) ?? "";
      for (const form of forms) {
        if (hint.includes(form)) found.push(`${seed}, Tipp ${i + 1}: "${form}" in "${hint}"`);
      }
    }
  }
  return found;
}

describe("renderHint", () => {
  const TEMPLATE: Template = {
    id: "aufg_99999",
    version: 1,
    topic: "kombinatorik.permutation",
    difficulty: 1,
    target_time_seconds: 60,
    compute_ref: "kombinatorik.permutation.factorial",
    answer_type: "integer",
    param_spec: { n: { type: "const", value: 6 } },
    constraints: [],
    question_text: "Auf wie viele Arten lassen sich {{n}} Personen anordnen?",
    hints: ["Kommt es auf die Reihenfolge an?", "Für Platz 1 gibt es {{n}} Möglichkeiten."],
  };

  it("rendert die Tipps mit den Parametern", () => {
    expect(renderHint(TEMPLATE, { n: 6 }, 1)).toBe("Für Platz 1 gibt es 6 Möglichkeiten.");
  });

  it("gibt undefined für einen Index ohne Tipp", () => {
    expect(renderHint(TEMPLATE, { n: 6 }, 2)).toBeUndefined();
    expect(renderHint({ ...TEMPLATE, hints: undefined }, { n: 6 }, 0)).toBeUndefined();
  });

  it("zählt null Tipps, wenn das Template keine hat", () => {
    expect(hintCount(TEMPLATE)).toBe(2);
    expect(hintCount({ ...TEMPLATE, hints: undefined })).toBe(0);
  });

  it("setzt weder result noch Anzeigewerte ein", () => {
    // Prüfung 11 lässt so ein Template nicht laden. Fehlte sie, würfe das
    // Rendern — ein lauter Fehler, kein stilles Leck.
    const tpl = { ...TEMPLATE, hints: ["Es sind {{result}}."] };
    expect(() => renderHint(tpl, { n: 6 }, 0)).toThrow(/result/);
  });

  it("Gegenprobe: erkennt ein ausgeschriebenes Ergebnis", () => {
    // 6! = 720. Wer die Zahl in den Tipp schreibt, muss hier auffallen.
    const verraeterisch = { ...TEMPLATE, hints: ["Es sind 720 Möglichkeiten."] };
    expect(revealingHints(verraeterisch, SEEDS.slice(0, 3))).toHaveLength(3);
    expect(revealingHints(TEMPLATE, SEEDS.slice(0, 3))).toEqual([]);
  });

  it("überspringt Ergebnisse unter drei Ziffern", () => {
    expect(solutionForms("24", undefined)).toEqual([]);
    expect(solutionForms("120", undefined)).toEqual(["120"]);
  });
});

const withHints = readContent().templates.filter((template) => template.hints.length > 0);

// Eine Suite je Template mit Tipps; solange es keine gibt, gibt es keine Suite.
for (const template of withHints) {
  describe(`${template.id} — Tipps über 200 Seeds`, () => {
    it("verrät in keinem Tipp die Lösung", () => {
      expect(revealingHints(template, SEEDS)).toEqual([]);
    });

    it("lässt keinen Platzhalter stehen", () => {
      for (const seed of SEEDS) {
        const { params } = instantiate(template, seed);
        for (let i = 0; i < hintCount(template); i++) {
          expect(renderHint(template, params, i)).not.toContain("{{");
        }
      }
    });
  });
}

describe("Tipps im Content als Ganzes", () => {
  it("gibt Arithmetik keine Tipps und allen anderen Templates zwei", () => {
    // Bei Addition und Subtraktion gibt es nichts zu erkennen und keinen Ansatz
    // zu verraten. Überall sonst gehören Erkennen und Ansatz dazu (D-31; Leitlinie in content/templates/_README.md).
    for (const template of readContent().templates) {
      const expected = template.topic.startsWith("arithmetik.") ? 0 : 2;
      expect(template.hints.length, template.id).toBe(expected);
    }
  });
});
