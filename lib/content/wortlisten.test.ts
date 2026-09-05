import { describe, expect, it } from "vitest";

import { binomial } from "@/lib/engine/expr/bigmath";
import { instantiate } from "@/lib/engine/instantiate";
import type { Template } from "@/lib/engine/types";

import { readContent } from "./read";

/**
 * Die Wortlisten der beiden Buchstaben-Permutationen, gegen zwei Rechenwege
 * geprüft, die **nicht** die Compute-Funktion sind.
 *
 * Das ist der Lehrfall D-15: Damals teilten Template und Test dieselbe falsche
 * Annahme über die Buchstabengruppen von MISSISSIPPI, die Suite blieb grün und
 * die Aufgabe war falsch. Ein Test, der `letterPermutations` gegen sich selbst
 * prüft, würde denselben Fehler wieder durchlassen — deshalb steht hier keine
 * Tabelle erwarteter Zahlen, sondern zwei eigenständige Verfahren:
 *
 * 1. **Abzählen.** Alle Permutationen der Buchstaben erzeugen, Doppelte
 *    verwerfen, zählen. Bis sieben Buchstaben bezahlbar, und völlig unabhängig
 *    von jeder Formel.
 * 2. **Platzieren.** Jede Buchstabengruppe nacheinander in die noch freien
 *    Plätze setzen: `C(frei, k₁) · C(frei−k₁, k₂) · …`. Eine andere Zerlegung
 *    als `n!` durch die Fakultäten zu teilen, und für jede Wortlänge machbar.
 *
 * Beide wurden vor dem Schreiben der Templates zusätzlich außerhalb des Repos
 * nachgerechnet; MISSISSIPPI ergibt 34650, wie in D-15 dokumentiert.
 */

const { templates } = readContent();

const KURZ = "aufg_00013";
const LANG = "aufg_00004";

function templateFor(id: string): Template {
  const found = templates.find((template) => template.id === id);
  if (found === undefined) throw new Error(`Template ${id} fehlt.`);
  return found;
}

/** Die Wörter aus dem `choice`-Parameter eines Templates. */
function woerterOf(template: Template): readonly string[] {
  const spec = template.param_spec.wort;
  if (spec === undefined || spec.type !== "choice") {
    throw new Error(`${template.id} hat keinen choice-Parameter "wort".`);
  }
  return spec.values.map(String);
}

/** Buchstabenhäufigkeiten, absteigend — die Reihenfolge spielt keine Rolle. */
function haeufigkeiten(wort: string): number[] {
  const counts = new Map<string, number>();
  for (const letter of wort) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  return [...counts.values()];
}

/** Weg 1: alle Permutationen erzeugen und die verschiedenen zählen. */
function durchAbzaehlen(wort: string): bigint {
  const gesehen = new Set<string>();

  const bauen = (rest: readonly string[], bisher: string): void => {
    if (rest.length === 0) {
      gesehen.add(bisher);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      bauen([...rest.slice(0, i), ...rest.slice(i + 1)], bisher + rest[i]);
    }
  };

  bauen([...wort], "");
  return BigInt(gesehen.size);
}

/** Weg 2: jede Buchstabengruppe in die noch freien Plätze setzen. */
function durchPlatzieren(wort: string): bigint {
  let frei = BigInt(wort.length);
  let ergebnis = 1n;

  for (const anzahl of haeufigkeiten(wort)) {
    ergebnis *= binomial(frei, BigInt(anzahl));
    frei -= BigInt(anzahl);
  }

  return ergebnis;
}

/** Was das Template unter irgendeinem Seed für dieses Wort liefert. */
function ausDemTemplate(template: Template, wort: string): string {
  for (let i = 0; i < 4000; i++) {
    const instance = instantiate(template, `wortliste-${wort}-${i}`);
    if (instance.params.wort === wort) return instance.expectedAnswer;
  }
  throw new Error(`${template.id} hat "${wort}" in 4000 Seeds nie gezogen.`);
}

describe.each([
  [KURZ, "kurze Wörter"],
  [LANG, "längere Wörter"],
])("%s — %s", (id) => {
  const template = templateFor(id);
  const woerter = woerterOf(template);

  it("hat mehr als zwanzig Wörter", () => {
    expect(woerter.length).toBeGreaterThan(20);
  });

  it("nennt kein Wort zweimal", () => {
    expect(new Set(woerter).size).toBe(woerter.length);
  });

  it("hat in jedem Wort mindestens einen doppelten Buchstaben", () => {
    // Ohne Wiederholung wäre es eine gewöhnliche Permutation und gehörte in
    // aufg_00003 — die Aufgabe hätte keinen Gegenstand.
    for (const wort of woerter) {
      expect(haeufigkeiten(wort).some((anzahl) => anzahl > 1)).toBe(true);
    }
  });

  it("benutzt nur Großbuchstaben ohne Umlaute", () => {
    for (const wort of woerter) expect(wort).toMatch(/^[A-Z]+$/);
  });

  it.each(woerter.map((wort) => [wort] as const))(
    "%s: das Template rechnet dasselbe wie die beiden unabhängigen Wege",
    (wort) => {
      const platziert = durchPlatzieren(wort);
      expect(ausDemTemplate(template, wort)).toBe(platziert.toString());

      // Abzählen nur, wo es bezahlbar ist — 8! wären schon 40 320 Strings.
      if (wort.length <= 7) {
        expect(durchAbzaehlen(wort)).toBe(platziert);
      }
    },
  );
});

describe("die beiden Listen zusammen", () => {
  const kurz = woerterOf(templateFor(KURZ));
  const lang = woerterOf(templateFor(LANG));

  it("teilen sich kein Wort", () => {
    const doppelt = kurz.filter((wort) => lang.includes(wort));
    expect(doppelt).toEqual([]);
  });

  it("trennen sauber an der Ergebnisgrenze 60", () => {
    // Die Grenze steht auch in den `constraints` beider Templates. Hier wird
    // geprüft, dass die Listen sie schon von sich aus einhalten — sonst würde
    // `instantiate` Wörter still verwerfen und der Parameterraum wäre kleiner
    // als die Liste lang ist.
    for (const wort of kurz) expect(durchPlatzieren(wort)).toBeLessThanOrEqual(60n);
    for (const wort of lang) expect(durchPlatzieren(wort)).toBeGreaterThan(60n);
    for (const wort of lang) expect(durchPlatzieren(wort)).toBeLessThanOrEqual(50_000n);
  });

  it("deckt MISSISSIPPI mit dem Wert aus D-15 ab", () => {
    expect(lang).toContain("MISSISSIPPI");
    expect(durchPlatzieren("MISSISSIPPI").toString()).toBe("34650");
  });
});
