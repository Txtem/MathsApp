import { describe, expect, it } from "vitest";

import { makeRng } from "@/lib/engine/generate/rng";
import type { Template } from "@/lib/engine/types";

import { AVOID_COUNT, selectTemplate, weightedPick } from "./next-template";
import { templateWeight, type TopicStats } from "./scoring";

/**
 * Was die Auswahl über viele Ziehungen tatsächlich tut.
 *
 * Anlass war eine schwache Messung an der laufenden App: Die Schwierigkeit
 * stieg mit der Erfolgsquote, aber viel weniger als die Gewichte erwarten
 * ließen. Die naheliegende Erklärung — zu wenige Templates je Thema — ist hier
 * geprüft und **widerlegt** worden. Der Grund ist die Wiederholungsvermeidung,
 * und sie wirkt auch dann noch, wenn ein Thema zwanzig Templates hat.
 *
 * Erster Teil: Ohne Vermeidung wird exakt nach Gewicht gezogen. Damit ist die
 * Ziehfunktion selbst aus dem Verdacht.
 *
 * Zweiter Teil: Mit Vermeidung wird gemessen, wie viel von der Gewichtung
 * übrig bleibt — bei verschiedenen Poolgrößen.
 *
 * Der Zufall ist geseedet. Die Zahlen sind reproduzierbar, der Test kann nicht
 * gelegentlich umfallen.
 */

const NOW = new Date("2026-08-30T12:00:00.000Z");
const TOPIC = "kombinatorik.permutation";
const DRAWS = 20_000;

/** Quote 1.0 ⇒ Zielschwierigkeit 4. */
const BEHERRSCHT: TopicStats = {
  topic: TOPIC,
  recentCorrect: 10,
  recentAnswered: 10,
  dueAt: null,
  lastSeenAt: null,
};

const TARGET = 4;

const base = {
  version: 1,
  target_time_seconds: 30,
  compute_ref: "arithmetik.add",
  answer_type: "integer",
  param_spec: { a: { type: "int", min: 1, max: 9 }, b: { type: "int", min: 1, max: 9 } },
  constraints: [],
  question_text: "{{a}} + {{b}}",
  topic: TOPIC,
} satisfies Omit<Template, "id" | "difficulty">;

function template(id: string, difficulty: number): Template {
  return { ...base, id, difficulty };
}

/** Fünf Templates der Schwierigkeiten 1 bis 5. */
const FUENF = [1, 2, 3, 4, 5].map((difficulty) => template(`d${difficulty}`, difficulty));

/** `n` Templates, Schwierigkeiten zyklisch aus 1 bis 5. */
function pool(n: number): Template[] {
  return Array.from({ length: n }, (_, i) => template(`t${i}`, (i % 5) + 1));
}

/**
 * Vier Standardfehler der Binomialverteilung. Bei geseedetem Zufall ist das
 * reichlich — die Schranke steht hier, damit nachvollziehbar ist, warum die
 * Toleranz so groß ist und nicht größer.
 */
function toleranz(anteil: number, ziehungen: number): number {
  return 4 * Math.sqrt((anteil * (1 - anteil)) / ziehungen);
}

function expectShare(counts: Map<string, number>, id: string, expected: number): void {
  const actual = (counts.get(id) ?? 0) / DRAWS;
  expect(Math.abs(actual - expected)).toBeLessThan(toleranz(expected, DRAWS));
}

function count(picked: readonly Template[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of picked) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  return counts;
}

function meanDifficulty(picked: readonly Template[]): number {
  return picked.reduce((sum, item) => sum + item.difficulty, 0) / picked.length;
}

/**
 * Spielt eine Übungssitzung durch: Jede Ziehung landet in der Liste der zuletzt
 * gestellten Templates und beeinflusst damit die nächste.
 */
function sitzung(
  templates: readonly Template[],
  seed: string,
  mitVermeidung: boolean,
): Template[] {
  const rng = makeRng(seed);
  let recent: string[] = [];
  const picked: Template[] = [];

  for (let i = 0; i < DRAWS; i++) {
    const chosen = selectTemplate(
      templates,
      {
        now: NOW,
        stats: [BEHERRSCHT],
        recentTemplateIds: mitVermeidung ? recent : [],
      },
      rng.next,
    );

    if (chosen === undefined) throw new Error("Die Auswahl hat kein Template geliefert.");
    picked.push(chosen);
    // Länger als AVOID_COUNT wird die Liste nicht gebraucht.
    recent = [chosen.id, ...recent].slice(0, AVOID_COUNT);
  }

  return picked;
}

/** Der Schwierigkeitsschnitt, den die reinen Gewichte ergeben. */
function gewichteterSchnitt(templates: readonly Template[]): number {
  const total = templates.reduce((sum, item) => sum + templateWeight(item.difficulty, TARGET), 0);
  return templates.reduce(
    (sum, item) => sum + (item.difficulty * templateWeight(item.difficulty, TARGET)) / total,
    0,
  );
}

/** Der Schnitt, den blindes Gleichverteilen ergäbe. */
function gleichverteilterSchnitt(templates: readonly Template[]): number {
  return templates.reduce((sum, item) => sum + item.difficulty, 0) / templates.length;
}

/**
 * Welcher Anteil des Abstands zwischen Gewichtung und Gleichverteilung geht
 * durch die Vermeidung verloren? `0` heißt: keine Verzerrung. `1` heißt: die
 * Gewichtung ist wirkungslos, gezogen wird effektiv gleichverteilt.
 */
function verlust(templates: readonly Template[], seed: string): number {
  const gemessen = meanDifficulty(sitzung(templates, seed, true));
  const gewichtet = gewichteterSchnitt(templates);
  const gleich = gleichverteilterSchnitt(templates);
  return (gewichtet - gemessen) / (gewichtet - gleich);
}

describe("ohne Vermeidung wird exakt nach Gewicht gezogen", () => {
  /**
   * Zielschwierigkeit 4, Schwierigkeiten 1 bis 5. Die Gewichte
   * `1 / (1 + |difficulty - 4|)` sind 1/4, 1/3, 1/2, 1, 1/2 — in Zwölfteln
   * 3, 4, 6, 12, 6, zusammen 31. Die Anteile sind hier von Hand nachgerechnet
   * und nicht aus der Formel abgeleitet, sonst prüfte der Test sich selbst.
   */
  const ERWARTET: ReadonlyArray<readonly [string, number]> = [
    ["d1", 3 / 31],
    ["d2", 4 / 31],
    ["d3", 6 / 31],
    ["d4", 12 / 31],
    ["d5", 6 / 31],
  ];

  it("die nachgerechneten Anteile stimmen mit der Formel überein", () => {
    const total = FUENF.reduce((sum, item) => sum + templateWeight(item.difficulty, TARGET), 0);
    for (const [id, expected] of ERWARTET) {
      const item = FUENF.find((candidate) => candidate.id === id) as Template;
      expect(templateWeight(item.difficulty, TARGET) / total).toBeCloseTo(expected, 10);
    }
  });

  it("weightedPick trifft die Gewichte", () => {
    const rng = makeRng("verteilung-weightedpick");
    const weights = FUENF.map((item) => templateWeight(item.difficulty, TARGET));

    const picked: Template[] = [];
    for (let i = 0; i < DRAWS; i++) {
      const chosen = weightedPick(FUENF, weights, rng.next);
      if (chosen === undefined) throw new Error("weightedPick hat nichts geliefert.");
      picked.push(chosen);
    }

    const counts = count(picked);
    for (const [id, expected] of ERWARTET) expectShare(counts, id, expected);
  });

  it("selectTemplate kommt auf dieselbe Verteilung", () => {
    // Der ganze Weg: Quote → Zielschwierigkeit → Gewicht → Ziehung. Weicht das
    // hier ab, liegt der Fehler zwischen Quote und Gewicht.
    const counts = count(sitzung(FUENF, "verteilung-selecttemplate", false));
    for (const [id, expected] of ERWARTET) expectShare(counts, id, expected);
  });

  it("spiegelt sich bei schwacher Quote", () => {
    // Quote 0 ⇒ Zielschwierigkeit 1. Gewichte 1, 1/2, 1/3, 1/4, 1/5 — in
    // Sechzigsteln 60, 30, 20, 15, 12, zusammen 137.
    const schwach: TopicStats = { ...BEHERRSCHT, recentCorrect: 0 };
    const rng = makeRng("verteilung-schwach");

    const picked: Template[] = [];
    for (let i = 0; i < DRAWS; i++) {
      const chosen = selectTemplate(FUENF, { now: NOW, stats: [schwach] }, rng.next);
      if (chosen === undefined) throw new Error("Die Auswahl hat kein Template geliefert.");
      picked.push(chosen);
    }

    const counts = count(picked);
    expectShare(counts, "d1", 60 / 137);
    expectShare(counts, "d5", 12 / 137);
  });
});

describe("die Wiederholungsvermeidung überlagert die Gewichtung", () => {
  /**
   * Gemessene Verluste (geseedet, 20 000 Ziehungen je Poolgröße):
   *
   * | Templates |   3 |   4 |   5 |   6 |   8 |  10 |  12 |  15 |  20 |
   * |-----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|
   * | Verlust   | 76% |100% | 73% | 61% | 48% | 33% | 28% | 21% | 16% |
   *
   * Die Erklärung „zu wenige Templates je Thema" trägt damit nicht: Der
   * Verlust ist bei vier Templates am größten, nicht bei zwei, und er ist auch
   * bei zwanzig noch messbar.
   */

  it("bei vier Templates bleibt von der Gewichtung nichts übrig", () => {
    // Vier Templates, drei gemiedene IDs: Nach drei Zügen ist genau ein
    // Kandidat übrig. Die Auswahl ist dann kein Ziehen mehr, sondern ein
    // erzwungener Reihum-Durchlauf.
    expect(verlust(pool(4), "sitzung-vier")).toBeGreaterThan(0.98);
  });

  it("bei vier Templates ist die Reihenfolge sogar deterministisch", () => {
    const picked = sitzung(pool(4), "sitzung-vier-reihenfolge", true);

    // Ab dem vierten Zug wiederholt sich kein Template innerhalb von vier
    // aufeinanderfolgenden Aufgaben — jedes Fenster enthält alle vier.
    for (let i = 100; i < 200; i++) {
      const fenster = new Set(picked.slice(i, i + 4).map((item) => item.id));
      expect(fenster.size).toBe(4);
    }
  });

  it("bleibt bei fünf und acht Templates erheblich", () => {
    expect(verlust(pool(5), "sitzung-fuenf")).toBeGreaterThan(0.6);
    expect(verlust(pool(8), "sitzung-acht")).toBeGreaterThan(0.35);
  });

  it("verschwindet auch bei zwanzig Templates nicht", () => {
    const gemessen = verlust(pool(20), "sitzung-zwanzig");
    expect(gemessen).toBeGreaterThan(0.08);
    // Und sie wird mit wachsendem Pool zumindest kleiner.
    expect(gemessen).toBeLessThan(verlust(pool(5), "sitzung-zwanzig"));
  });

  it("ohne Vermeidung trifft dieselbe Sitzung den gewichteten Schnitt", () => {
    // Gegenprobe: Es liegt an der Vermeidung, nicht an der Sitzungsform.
    for (const n of [4, 5, 8, 20]) {
      const templates = pool(n);
      const gemessen = meanDifficulty(sitzung(templates, `ohne-${n}`, false));
      expect(gemessen).toBeCloseTo(gewichteterSchnitt(templates), 1);
    }
  });
});
