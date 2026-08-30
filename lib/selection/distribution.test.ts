import { describe, expect, it } from "vitest";

import { makeRng } from "@/lib/engine/generate/rng";
import type { Template } from "@/lib/engine/types";

import { selectTemplate, weightedPick } from "./next-template";
import { RECENCY_FACTORS, templateWeight, type TopicStats } from "./scoring";

/**
 * Was die Auswahl über viele Ziehungen tatsächlich tut.
 *
 * Anlass war eine schwache Messung an der laufenden App: Die Schwierigkeit
 * stieg mit der Erfolgsquote, aber viel weniger als die Gewichte erwarten
 * ließen. Die naheliegende Erklärung — zu wenige Templates je Thema — ist hier
 * geprüft und **widerlegt** worden. Der Grund war der harte Ausschluss der
 * zuletzt gestellten Templates, und er wirkte auch bei zwanzig noch.
 *
 * Erster Teil: Ohne Abwertung wird exakt nach Gewicht gezogen. Damit ist die
 * Ziehfunktion selbst aus dem Verdacht.
 *
 * Zweiter Teil: Mit der Abwertung, die den Ausschluss abgelöst hat (D-24), wird
 * gemessen, wie viel von der Gewichtung übrig bleibt — bei verschiedenen
 * Poolgrößen.
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
  mitAbwertung: boolean,
  factors?: readonly number[],
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
        recentTemplateIds: mitAbwertung ? recent : [],
        recencyFactors: factors,
      },
      rng.next,
    );

    if (chosen === undefined) throw new Error("Die Auswahl hat kein Template geliefert.");
    picked.push(chosen);
    // Weiter zurück als die Faktoren reichen, wird die Liste nicht gebraucht.
    recent = [chosen.id, ...recent].slice(0, RECENCY_FACTORS.length);
  }

  return picked;
}

/** Anteil der Züge, die dasselbe Template wie der Zug davor gestellt haben. */
function wiederholungsrate(picked: readonly Template[]): number {
  let wiederholt = 0;
  for (let i = 1; i < picked.length; i++) {
    if (picked[i].id === picked[i - 1].id) wiederholt++;
  }
  return wiederholt / (picked.length - 1);
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
function verlust(
  templates: readonly Template[],
  seed: string,
  factors?: readonly number[],
): number {
  const gemessen = meanDifficulty(sitzung(templates, seed, true, factors));
  const gewichtet = gewichteterSchnitt(templates);
  const gleich = gleichverteilterSchnitt(templates);
  return (gewichtet - gemessen) / (gewichtet - gleich);
}

describe("ohne Abwertung wird exakt nach Gewicht gezogen", () => {
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

/** Zum Vergleich: Abwertung, die nichts abwertet. */
const OHNE_ABSCHLAG: readonly number[] = [1, 1, 1];

describe("die Abwertung lässt die Gewichtung stehen", () => {
  /**
   * 20 000 geseedete Ziehungen je Poolgröße. Der Anteil der Gewichtung, der
   * verloren geht — vorher der harte Ausschluss der letzten drei Templates,
   * jetzt die Abwertung mit den gemessenen Faktoren:
   *
   * | Templates                 |    3 |    4 |    5 |    6 |    8 |   10 |   12 |   15 |   20 |
   * |---------------------------|------|------|------|------|------|------|------|------|------|
   * | vorher, harter Ausschluss | 76 % |100 % | 73 % | 61 % | 48 % | 33 % | 28 % | 21 % | 16 % |
   * | jetzt, 0.7 / 0.9 / 0.9    | 10 % | 11 % |  8 % |  9 % |  5 % |  4 % |  5 % |  3 % |  0 % |
   *
   * Das Messverfahren hat einen Boden: Ohne jede Abwertung misst dieselbe
   * Sitzung zwischen -4 % und +2 %. Die Schranke von 15 % liegt also rund
   * dreizehn Punkte über dem Rauschen, nicht fünfzehn. Die Suche über die
   * Faktoren und der Tausch gegen die Wiederholungsrate stehen in
   * `DECISIONS.md`, D-24.
   */

  it("hält den Verlust bei vier bis acht Templates unter 15 %", () => {
    // Das Abnahmekriterium. Vorher lag es bei 48 % bis 100 %.
    for (const n of [4, 5, 6, 8]) {
      expect(verlust(pool(n), `kriterium-${n}`)).toBeLessThan(0.15);
    }
  });

  it("hält es auch bei drei und bei zwanzig Templates", () => {
    // Nicht Teil des Kriteriums, aber gemessen: Der Verlust wächst nach unten
    // hin nicht davon.
    expect(verlust(pool(3), "sitzung-drei")).toBeLessThan(0.15);
    expect(verlust(pool(20), "sitzung-zwanzig")).toBeLessThan(0.15);
  });

  it("die Reihenfolge ist nicht mehr deterministisch", () => {
    const picked = sitzung(pool(4), "sitzung-vier-reihenfolge", true);

    // Die Gegenprobe zum alten Verhalten: Damals enthielt **jedes** Fenster von
    // vier Aufgaben alle vier Templates. Jetzt gilt das nicht mehr durchgängig.
    const fenster = [];
    for (let i = 100; i < 200; i++) {
      fenster.push(new Set(picked.slice(i, i + 4).map((item) => item.id)).size);
    }
    expect(fenster.some((groesse) => groesse < 4)).toBe(true);
  });

  it("senkt die unmittelbare Wiederholung, hebt sie aber nicht auf", () => {
    // Gemessen gegen dieselbe Sitzung ohne Abschlag — das ist die Größe, die
    // die Faktoren überhaupt beeinflussen sollen.
    for (const n of [4, 8]) {
      const mit = wiederholungsrate(sitzung(pool(n), `wiederholung-${n}`, true));
      const ohne = wiederholungsrate(
        sitzung(pool(n), `wiederholung-${n}`, true, OHNE_ABSCHLAG),
      );

      expect(mit).toBeGreaterThan(0);
      expect(mit).toBeLessThan(ohne);
    }
  });

  it("ohne Abwertung trifft dieselbe Sitzung den gewichteten Schnitt", () => {
    // Gegenprobe: Es liegt an der Abwertung, nicht an der Sitzungsform.
    for (const n of [4, 5, 8, 20]) {
      const templates = pool(n);
      const gemessen = meanDifficulty(sitzung(templates, `ohne-${n}`, false));
      expect(gemessen).toBeCloseTo(gewichteterSchnitt(templates), 1);
    }
  });

  it("ein schärferer Abschlag kostet Gewichtung — der Tausch ist gemessen", () => {
    // Die Startwerte aus dem Arbeitsplan zum Vergleich: Sie halbieren die
    // Wiederholung noch einmal und reißen dafür das Kriterium.
    const scharf: readonly number[] = [0.2, 0.5, 0.8];

    expect(verlust(pool(4), "tausch", scharf)).toBeGreaterThan(0.15);
    expect(wiederholungsrate(sitzung(pool(4), "tausch-w", true, scharf))).toBeLessThan(
      wiederholungsrate(sitzung(pool(4), "tausch-w", true)),
    );
  });
});
