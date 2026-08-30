import { describe, expect, it } from "vitest";

import type { TopicGroupChoice } from "@/components/topic-groups";
import type { TopicStats } from "@/lib/selection/scoring";

import {
  type AnsweredDuration,
  median,
  type TopicTotals,
  toStatsGroups,
  toSummary,
} from "./stats-rows";

const NOW = new Date("2026-08-30T12:00:00.000Z");
const GESTERN = new Date("2026-08-29T12:00:00.000Z");
const MORGEN = new Date("2026-08-31T12:00:00.000Z");

const GRUPPEN: readonly TopicGroupChoice[] = [
  {
    topic: "kombinatorik",
    label: "Kombinatorik",
    templateCount: 5,
    leaves: [
      { topic: "kombinatorik.permutation", label: "Permutationen", templateCount: 2 },
      { topic: "kombinatorik.variation", label: "Variationen", templateCount: 3 },
    ],
  },
];

function totals(entries: readonly TopicTotals[]): ReadonlyMap<string, TopicTotals> {
  return new Map(entries.map((entry) => [entry.topic, entry]));
}

function recent(entries: readonly TopicStats[]): ReadonlyMap<string, TopicStats> {
  return new Map(entries.map((entry) => [entry.topic, entry]));
}

function stats(topic: string, correct: number, answered: number): TopicStats {
  return {
    topic,
    recentCorrect: correct,
    recentAnswered: answered,
    dueAt: null,
    lastSeenAt: null,
  };
}

describe("toStatsGroups", () => {
  it("zeigt jedes Thema mit Aufgaben, auch ohne einen einzigen Versuch", () => {
    const groups = toStatsGroups(GRUPPEN, totals([]), recent([]), NOW);

    expect(groups).toHaveLength(1);
    expect(groups[0].rows.map((row) => row.topic)).toEqual([
      "kombinatorik.permutation",
      "kombinatorik.variation",
    ]);
    expect(groups[0].rows[0]).toMatchObject({
      label: "Permutationen",
      attempts: 0,
      overallRate: null,
      recentRate: null,
      dueAt: null,
      isDue: true,
    });
  });

  it("übernimmt Gruppierung und Beschriftung aus der Themenauswahl", () => {
    const groups = toStatsGroups(GRUPPEN, totals([]), recent([]), NOW);
    expect(groups[0]).toMatchObject({ topic: "kombinatorik", label: "Kombinatorik" });
  });

  it("rechnet die Gesamtquote aus den Gesamtzahlen", () => {
    const groups = toStatsGroups(
      GRUPPEN,
      totals([{ topic: "kombinatorik.permutation", attempts: 8, correct: 6, dueAt: MORGEN }]),
      recent([]),
      NOW,
    );

    expect(groups[0].rows[0]).toMatchObject({ attempts: 8, overallRate: 0.75 });
  });

  it("rechnet die Quote der letzten zehn aus dem Fenster", () => {
    const groups = toStatsGroups(
      GRUPPEN,
      totals([{ topic: "kombinatorik.permutation", attempts: 30, correct: 15, dueAt: MORGEN }]),
      recent([stats("kombinatorik.permutation", 9, 10)]),
      NOW,
    );

    // Gesamt 50 %, zuletzt 90 % — die Seite muss beides zeigen können.
    expect(groups[0].rows[0]).toMatchObject({ overallRate: 0.5, recentRate: 0.9 });
  });

  it("erfindet für ein unerprobtes Thema keine 50 Prozent", () => {
    // `successRate` aus der Auswahl gibt bei wenigen Versuchen 0.5 zurück.
    // Das ist ein Steuerungswert und darf hier nicht auftauchen.
    const groups = toStatsGroups(
      GRUPPEN,
      totals([]),
      recent([stats("kombinatorik.permutation", 1, 1)]),
      NOW,
    );

    expect(groups[0].rows[0].recentRate).toBe(1);
    expect(groups[0].rows[1].recentRate).toBeNull();
  });

  describe("Fälligkeit", () => {
    function rowFor(dueAt: Date | null): { readonly isDue: boolean; readonly dueAt: Date | null } {
      const groups = toStatsGroups(
        GRUPPEN,
        totals([{ topic: "kombinatorik.permutation", attempts: 3, correct: 2, dueAt }]),
        recent([]),
        NOW,
      );
      return groups[0].rows[0];
    }

    it("ist fällig, wenn der Termin erreicht ist", () => {
      expect(rowFor(GESTERN).isDue).toBe(true);
      expect(rowFor(new Date(NOW)).isDue).toBe(true);
    });

    it("ist nicht fällig, wenn der Termin in der Zukunft liegt", () => {
      expect(rowFor(MORGEN)).toMatchObject({ isDue: false, dueAt: MORGEN });
    });

    it("ist ohne Termin fällig", () => {
      expect(rowFor(null).isDue).toBe(true);
    });
  });
});

describe("median", () => {
  it("gibt null bei leerer Eingabe", () => {
    expect(median([])).toBeNull();
  });

  it("nimmt bei ungerader Anzahl den mittleren Wert", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("mittelt bei gerader Anzahl die beiden mittleren", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("sortiert selbst und verändert die Eingabe nicht", () => {
    const werte = [9, 1, 5];
    expect(median(werte)).toBe(5);
    expect(werte).toEqual([9, 1, 5]);
  });

  it("sortiert numerisch, nicht als Text", () => {
    // Die Standardsortierung von JavaScript ergäbe hier 100.
    expect(median([9, 100, 20])).toBe(20);
  });
});

describe("toSummary", () => {
  const durations: readonly AnsweredDuration[] = [
    { durationMs: 20_000, targetMs: 30_000 },
    { durationMs: 40_000, targetMs: 60_000 },
    { durationMs: 90_000, targetMs: 60_000 },
  ];

  it("summiert über alle Themen", () => {
    const summary = toSummary(
      [
        { topic: "a", attempts: 6, correct: 3, dueAt: null },
        { topic: "b", attempts: 4, correct: 4, dueAt: null },
      ],
      durations,
    );

    expect(summary).toMatchObject({ attempts: 10, correct: 7, overallRate: 0.7 });
  });

  it("liefert ohne Versuche keine Quote", () => {
    expect(toSummary([], [])).toMatchObject({
      attempts: 0,
      correct: 0,
      overallRate: null,
      medianDurationMs: null,
      medianTargetMs: null,
    });
  });

  it("stellt gemessene Zeit und Zielzeit gegenüber", () => {
    const summary = toSummary([], durations);
    expect(summary.medianDurationMs).toBe(40_000);
    expect(summary.medianTargetMs).toBe(60_000);
  });

  it("lässt Aufgaben ohne Template aus dem Zeitvergleich", () => {
    // Ohne Template gibt es keine Zielzeit — die gemessene Zeit stünde sonst
    // gegen den Wert einer anderen Aufgabe.
    const summary = toSummary([], [...durations, { durationMs: 1, targetMs: null }]);
    expect(summary.medianDurationMs).toBe(40_000);
  });

  it("zählt Themen ohne Versuche nicht gegen die Quote", () => {
    const summary = toSummary(
      [
        { topic: "a", attempts: 4, correct: 2, dueAt: null },
        { topic: "b", attempts: 0, correct: 0, dueAt: null },
      ],
      [],
    );
    expect(summary.overallRate).toBe(0.5);
  });
});
