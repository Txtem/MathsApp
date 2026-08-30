import { describe, expect, it } from "vitest";

import type { TopicGroupChoice } from "@/components/topic-groups";
import type { TopicStats } from "@/lib/selection/scoring";

import {
  type AnsweredDuration,
  countSnaps,
  INTERRUPTED_FACTOR,
  median,
  medianTime,
  SNAP_MIN_COUNT,
  SNAP_SHARE,
  TIME_MIN_SAMPLES,
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
    const groups = toStatsGroups(GRUPPEN, totals([]), recent([]), [], NOW);

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
    const groups = toStatsGroups(GRUPPEN, totals([]), recent([]), [], NOW);
    expect(groups[0]).toMatchObject({ topic: "kombinatorik", label: "Kombinatorik" });
  });

  it("rechnet die Gesamtquote aus den Gesamtzahlen", () => {
    const groups = toStatsGroups(
      GRUPPEN,
      totals([{ topic: "kombinatorik.permutation", attempts: 8, correct: 6, dueAt: MORGEN }]),
      recent([]),
      [],
      NOW,
    );

    expect(groups[0].rows[0]).toMatchObject({ attempts: 8, overallRate: 0.75 });
  });

  it("rechnet die Quote der letzten zehn aus dem Fenster", () => {
    const groups = toStatsGroups(
      GRUPPEN,
      totals([{ topic: "kombinatorik.permutation", attempts: 30, correct: 15, dueAt: MORGEN }]),
      recent([stats("kombinatorik.permutation", 9, 10)]),
      [],
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
      [],
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
        [],
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

/** Eine beantwortete Aufgabe. `targetMs` ist die Zielzeit des Templates. */
function attempt(overrides: Partial<AnsweredDuration> = {}): AnsweredDuration {
  return {
    topic: "kombinatorik.permutation",
    durationMs: 30_000,
    targetMs: 60_000,
    isCorrect: true,
    ...overrides,
  };
}

/** `count` richtige Antworten, jede mit dem Vielfachen `ratio` der Zielzeit. */
function richtige(count: number, ratio: number): AnsweredDuration[] {
  return Array.from({ length: count }, () => attempt({ durationMs: 60_000 * ratio }));
}

describe("medianTime", () => {
  it("zeigt nichts, solange zu wenige richtige Antworten vorliegen", () => {
    const zeit = medianTime(richtige(TIME_MIN_SAMPLES - 1, 1));
    expect(zeit.relative).toBeNull();
    expect(zeit.counted).toBe(TIME_MIN_SAMPLES - 1);
  });

  it("zeigt ab der Mindestzahl", () => {
    expect(medianTime(richtige(TIME_MIN_SAMPLES, 1)).relative).toBe(1);
  });

  it("rechnet relativ zur Zielzeit, nicht in Sekunden", () => {
    // Dieselbe absolute Dauer, aber halb so lange Zielzeit ⇒ doppelt so lang.
    const gemischt = [
      ...Array.from({ length: 3 }, () => attempt({ durationMs: 30_000, targetMs: 30_000 })),
      ...Array.from({ length: 3 }, () => attempt({ durationMs: 30_000, targetMs: 30_000 })),
    ];
    expect(medianTime(gemischt).relative).toBe(1);

    const langsam = richtige(5, 1.5);
    expect(medianTime(langsam).relative).toBe(1.5);
  });

  it("rechnet nur mit richtigen Antworten", () => {
    // Fünf richtige bei Zielzeit, dazu zwanzig sehr schnelle falsche. Die alte
    // Definition hätte den Median dadurch nach unten gezogen; das war der
    // Anlass für D-21.
    const falsche = Array.from({ length: 20 }, () =>
      attempt({ durationMs: 1_000, isCorrect: false }),
    );
    const zeit = medianTime([...richtige(5, 1), ...falsche]);

    expect(zeit.relative).toBe(1);
    expect(zeit.counted).toBe(5);
  });

  it("schnell und falsch verbessert die Zeit nicht", () => {
    const ohne = medianTime(richtige(9, 1.4));
    const mit = medianTime([
      ...richtige(9, 1.4),
      ...Array.from({ length: 50 }, () => attempt({ durationMs: 500, isCorrect: false })),
    ]);
    expect(mit.relative).toBe(ohne.relative);
  });

  it("lässt unterbrochene Aufgaben aus dem Median und zählt sie", () => {
    const zeit = medianTime([
      ...richtige(5, 1),
      attempt({ durationMs: 60_000 * INTERRUPTED_FACTOR }),
      attempt({ durationMs: 60_000 * 100 }),
    ]);

    expect(zeit.relative).toBe(1);
    expect(zeit.counted).toBe(5);
    expect(zeit.interrupted).toBe(2);
  });

  it("zählt genau am Zehnfachen schon als unterbrochen", () => {
    const zeit = medianTime([
      ...richtige(5, 1),
      attempt({ durationMs: 60_000 * (INTERRUPTED_FACTOR - 0.01) }),
    ]);
    expect(zeit.interrupted).toBe(0);
    expect(zeit.counted).toBe(6);
  });

  it("kann durch Unterbrechungen unter die Mindestzahl fallen", () => {
    // Fünf richtige, davon vier unterbrochen: Dann steht die Zahl nicht mehr.
    const zeit = medianTime([
      ...richtige(1, 1),
      ...Array.from({ length: 4 }, () => attempt({ durationMs: 60_000 * 50 })),
    ]);
    expect(zeit.relative).toBeNull();
    expect(zeit.interrupted).toBe(4);
  });

  it("lässt Aufgaben ohne Template aus", () => {
    // Ohne Zielzeit gibt es kein Verhältnis.
    const zeit = medianTime([...richtige(5, 1), attempt({ targetMs: null, durationMs: 1 })]);
    expect(zeit.counted).toBe(5);
    expect(zeit.relative).toBe(1);
  });

  it("liefert ohne Daten nichts", () => {
    expect(medianTime([])).toEqual({ relative: null, counted: 0, interrupted: 0 });
  });
});

describe("countSnaps", () => {
  const schnellFalsch = (topic: string) =>
    attempt({ topic, isCorrect: false, durationMs: 60_000 * SNAP_SHARE - 1 });

  it("zählt falsche Antworten deutlich unter der Zielzeit", () => {
    const counts = countSnaps([schnellFalsch("a"), schnellFalsch("a"), schnellFalsch("b")]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
  });

  it("zählt richtige Antworten nicht, auch schnelle nicht", () => {
    const counts = countSnaps([attempt({ topic: "a", durationMs: 100, isCorrect: true })]);
    expect(counts.get("a")).toBeUndefined();
  });

  it("zählt langsame falsche Antworten nicht", () => {
    // Wer lange gerechnet und sich verrechnet hat, hat nicht geraten.
    const counts = countSnaps([
      attempt({ topic: "a", isCorrect: false, durationMs: 60_000 * SNAP_SHARE }),
      attempt({ topic: "a", isCorrect: false, durationMs: 55_000 }),
    ]);
    expect(counts.get("a")).toBeUndefined();
  });

  it("braucht eine Zielzeit", () => {
    const counts = countSnaps([
      attempt({ topic: "a", isCorrect: false, durationMs: 1, targetMs: null }),
    ]);
    expect(counts.get("a")).toBeUndefined();
  });
});

describe("Schnellschüsse in der Zeile", () => {
  function rowFor(anzahl: number) {
    const answered = Array.from({ length: anzahl }, () =>
      attempt({ topic: "kombinatorik.permutation", isCorrect: false, durationMs: 100 }),
    );
    const groups = toStatsGroups(
      GRUPPEN,
      totals([{ topic: "kombinatorik.permutation", attempts: 10, correct: 2, dueAt: MORGEN }]),
      recent([]),
      answered,
      NOW,
    );
    return groups[0].rows[0];
  }

  it("zeigt nichts, solange es zu wenige sind", () => {
    expect(rowFor(SNAP_MIN_COUNT - 1).snapAnswers).toBeNull();
  });

  it("zeigt sie ab der Mindestzahl", () => {
    expect(rowFor(SNAP_MIN_COUNT).snapAnswers).toBe(SNAP_MIN_COUNT);
    expect(rowFor(7).snapAnswers).toBe(7);
  });

  it("bleibt bei einem Thema ohne Schnellschüsse leer", () => {
    const groups = toStatsGroups(GRUPPEN, totals([]), recent([]), [], NOW);
    expect(groups[0].rows.every((row) => row.snapAnswers === null)).toBe(true);
  });
});

describe("toSummary", () => {
  it("summiert über alle Themen", () => {
    const summary = toSummary(
      [
        { topic: "a", attempts: 6, correct: 3, dueAt: null },
        { topic: "b", attempts: 4, correct: 4, dueAt: null },
      ],
      richtige(5, 1),
    );

    expect(summary).toMatchObject({ attempts: 10, correct: 7, overallRate: 0.7 });
  });

  it("liefert ohne Versuche weder Quote noch Zeit", () => {
    expect(toSummary([], [])).toEqual({
      attempts: 0,
      correct: 0,
      overallRate: null,
      time: { relative: null, counted: 0, interrupted: 0 },
    });
  });

  it("reicht die Medianzeit durch", () => {
    expect(toSummary([], richtige(6, 1.25)).time.relative).toBe(1.25);
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
