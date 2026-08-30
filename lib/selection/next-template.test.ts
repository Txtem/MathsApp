import { describe, expect, it } from "vitest";

import type { Template } from "@/lib/engine/types";

import { matchesTopic, selectTemplate, weightedPick } from "./next-template";
import { RECENCY_FACTORS, type TopicStats } from "./scoring";

/**
 * Eigene Fixtures statt echter Templates: Die Auswahl soll hier geprüft werden,
 * nicht der Content. Ein neues Template im Repo darf diese Tests nicht kippen.
 */
const base = {
  version: 1,
  difficulty: 1,
  target_time_seconds: 30,
  compute_ref: "arithmetik.add",
  answer_type: "integer",
  param_spec: { a: { type: "int", min: 1, max: 9 }, b: { type: "int", min: 1, max: 9 } },
  constraints: [],
  question_text: "{{a}} + {{b}}",
} satisfies Omit<Template, "id" | "topic">;

function template(id: string, topic: string, difficulty = 1): Template {
  return { ...base, id, topic, difficulty };
}

const NOW = new Date("2026-08-30T12:00:00.000Z");
const MORGEN = new Date("2026-08-31T12:00:00.000Z");

function stats(topic: string, overrides: Partial<TopicStats> = {}): TopicStats {
  return {
    topic,
    recentCorrect: 0,
    recentAnswered: 0,
    dueAt: null,
    lastSeenAt: null,
    ...overrides,
  };
}

/** Nimmt immer das erste Element des Pools — macht die Auswahl im Test eindeutig. */
const first = () => 0;
/** Nimmt das letzte Element. */
const last = () => 0.999;

describe("matchesTopic", () => {
  const cases: ReadonlyArray<readonly [string, string | null | undefined, boolean]> = [
    ["arithmetik.addition", null, true],
    ["arithmetik.addition", undefined, true],
    ["arithmetik.addition", "arithmetik", true],
    ["arithmetik.addition", "arithmetik.addition", true],
    ["arithmetik.addition", "arithmetik.subtraktion", false],
    ["arithmetik.addition", "kombinatorik", false],
    // kein reiner String-Prefix: "arithmetikx" darf nicht greifen
    ["arithmetikx.addition", "arithmetik", false],
  ];

  it.each(cases)("%s mit Filter %s → %s", (topic, filter, expected) => {
    expect(matchesTopic(topic, filter)).toBe(expected);
  });
});

describe("weightedPick", () => {
  const items = ["a", "b", "c"];

  it("gibt undefined ohne Kandidaten", () => {
    expect(weightedPick([], [], first)).toBeUndefined();
  });

  it("trifft bei gleichen Gewichten jedes Element", () => {
    expect(weightedPick(items, [1, 1, 1], () => 0)).toBe("a");
    expect(weightedPick(items, [1, 1, 1], () => 0.5)).toBe("b");
    expect(weightedPick(items, [1, 1, 1], () => 0.9)).toBe("c");
  });

  it("bevorzugt schwerere Gewichte", () => {
    // "b" belegt 8 von 10 Anteilen, also fast das ganze Intervall.
    expect(weightedPick(items, [1, 8, 1], () => 0.2)).toBe("b");
    expect(weightedPick(items, [1, 8, 1], () => 0.85)).toBe("b");
    expect(weightedPick(items, [1, 8, 1], () => 0.05)).toBe("a");
    expect(weightedPick(items, [1, 8, 1], () => 0.95)).toBe("c");
  });

  it("überspringt Gewichte von null", () => {
    expect(weightedPick(items, [0, 1, 0], () => 0)).toBe("b");
    expect(weightedPick(items, [0, 1, 0], () => 0.99)).toBe("b");
  });

  it("liefert bei lauter Nullgewichten trotzdem etwas", () => {
    expect(weightedPick(items, [0, 0, 0], first)).toBe("a");
  });

  it("verteilt über viele Ziehungen ungefähr nach Gewicht", () => {
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 1000; i++) {
      const picked = weightedPick(["a", "b"], [1, 3], () => i / 1000);
      counts[picked as "a" | "b"]++;
    }
    // 1:3 heißt rund 250 zu 750.
    expect(counts.a).toBeGreaterThan(200);
    expect(counts.a).toBeLessThan(300);
  });
});

describe("selectTemplate", () => {
  const templates = [
    template("add-1", "arithmetik.addition"),
    template("sub-1", "arithmetik.subtraktion"),
  ];

  it("gibt undefined, wenn kein Template zum Filter passt", () => {
    expect(
      selectTemplate(templates, { topicFilter: "kombinatorik", now: NOW }, first),
    ).toBeUndefined();
    expect(selectTemplate([], { now: NOW }, first)).toBeUndefined();
  });

  it("wendet den Topic-Filter an", () => {
    expect(
      selectTemplate(templates, { topicFilter: "arithmetik.subtraktion", now: NOW }, first)?.id,
    ).toBe("sub-1");
    expect(
      selectTemplate(templates, { topicFilter: "arithmetik", now: NOW }, first)?.topic,
    ).toMatch(/^arithmetik\./);
  });

  describe("Themenwahl", () => {
    it("stellt das schwächere Thema", () => {
      const chosen = selectTemplate(
        templates,
        {
          now: NOW,
          stats: [
            stats("arithmetik.addition", { recentAnswered: 10, recentCorrect: 10, dueAt: MORGEN }),
            stats("arithmetik.subtraktion", { recentAnswered: 10, recentCorrect: 1 }),
          ],
        },
        first,
      );

      expect(chosen?.topic).toBe("arithmetik.subtraktion");
    });

    it("stellt ein unerprobtes Thema vor einem beherrschten", () => {
      const chosen = selectTemplate(
        templates,
        {
          now: NOW,
          stats: [
            stats("arithmetik.addition", { recentAnswered: 10, recentCorrect: 10, dueAt: MORGEN }),
          ],
        },
        first,
      );

      expect(chosen?.topic).toBe("arithmetik.subtraktion");
    });

    it("behandelt ein Thema ohne Statistik wie ein unerprobtes", () => {
      const ohne = selectTemplate(templates, { now: NOW }, first);
      const mitLeeren = selectTemplate(
        templates,
        {
          now: NOW,
          stats: [stats("arithmetik.addition"), stats("arithmetik.subtraktion")],
        },
        first,
      );

      expect(ohne?.id).toBe(mitLeeren?.id);
    });

    it("ignoriert Statistiken zu Themen, die der Filter ausschließt", () => {
      const chosen = selectTemplate(
        templates,
        {
          topicFilter: "arithmetik.addition",
          now: NOW,
          stats: [stats("arithmetik.subtraktion", { recentAnswered: 10, recentCorrect: 0 })],
        },
        first,
      );

      expect(chosen?.topic).toBe("arithmetik.addition");
    });
  });

  describe("Schwierigkeit innerhalb des Themas", () => {
    const gestaffelt = [
      template("leicht", "kombinatorik.permutation", 1),
      template("mittel", "kombinatorik.permutation", 2),
      template("schwer", "kombinatorik.permutation", 4),
    ];

    /** Zieht 400-mal und zählt, welches Template wie oft kommt. */
    function verteilung(topicStats: TopicStats): Record<string, number> {
      const counts: Record<string, number> = { leicht: 0, mittel: 0, schwer: 0 };
      for (let i = 0; i < 400; i++) {
        const picked = selectTemplate(gestaffelt, { now: NOW, stats: [topicStats] }, () => i / 400);
        if (picked) counts[picked.id]++;
      }
      return counts;
    }

    it("bevorzugt bei schwacher Quote das leichte Template", () => {
      const counts = verteilung(
        stats("kombinatorik.permutation", { recentAnswered: 10, recentCorrect: 1 }),
      );
      expect(counts.leicht).toBeGreaterThan(counts.mittel);
      expect(counts.mittel).toBeGreaterThan(counts.schwer);
    });

    it("bevorzugt bei hoher Quote das schwere Template", () => {
      const counts = verteilung(
        stats("kombinatorik.permutation", { recentAnswered: 10, recentCorrect: 10 }),
      );
      expect(counts.schwer).toBeGreaterThan(counts.mittel);
      expect(counts.schwer).toBeGreaterThan(counts.leicht);
    });

    it("schließt kein Template ganz aus", () => {
      const counts = verteilung(
        stats("kombinatorik.permutation", { recentAnswered: 10, recentCorrect: 10 }),
      );
      expect(counts.leicht).toBeGreaterThan(0);
    });

    it("fällt ohne Template auf der Zielschwierigkeit auf das nächstliegende zurück", () => {
      // Zielschwierigkeit 4, vorhanden sind nur 1 und 2.
      const nurLeicht = [
        template("eins", "kombinatorik.permutation", 1),
        template("zwei", "kombinatorik.permutation", 2),
      ];
      const counts = { eins: 0, zwei: 0 };
      for (let i = 0; i < 400; i++) {
        const picked = selectTemplate(
          nurLeicht,
          {
            now: NOW,
            stats: [stats("kombinatorik.permutation", { recentAnswered: 10, recentCorrect: 10 })],
          },
          () => i / 400,
        );
        if (picked) counts[picked.id as "eins" | "zwei"]++;
      }
      expect(counts.zwei).toBeGreaterThan(counts.eins);
    });
  });

  describe("Abwertung zuletzt gestellter Templates", () => {
    const drei = [
      template("t1", "kombinatorik.permutation"),
      template("t2", "kombinatorik.permutation"),
      template("t3", "kombinatorik.permutation"),
    ];

    /**
     * Zählt 400 Ziehungen, indem `random()` den Wertebereich [0, 1) gleichmäßig
     * abfährt. Damit trifft die Zählung die Gewichte exakt statt ungefähr — der
     * Test kann nicht gelegentlich umfallen.
     */
    function anteile(recentTemplateIds: readonly string[]): Record<string, number> {
      const counts: Record<string, number> = { t1: 0, t2: 0, t3: 0 };
      for (let i = 0; i < 400; i++) {
        const picked = selectTemplate(drei, { recentTemplateIds, now: NOW }, () => i / 400);
        if (picked) counts[picked.id] += 1;
      }
      return counts;
    }

    it("schließt das zuletzt gestellte Template nicht aus", () => {
      // Vorher war das ein harter Ausschluss und die Antwort wäre "t2" gewesen.
      expect(selectTemplate(drei, { recentTemplateIds: ["t1"], now: NOW }, first)?.id).toBe("t1");
    });

    it("zieht es aber deutlich seltener", () => {
      const counts = anteile(["t1"]);

      // Gewichte 0.2, 1, 1 — zusammen 2.2. Von Hand: 0.2/2.2 ≈ 9 %, also rund
      // 36 von 400, gegen 133 bei Gleichstand.
      expect(counts.t1).toBeGreaterThan(30);
      expect(counts.t1).toBeLessThan(42);
      expect(counts.t2).toBeGreaterThan(counts.t1 * 4);
    });

    it("wertet zwei und drei Züge zurück schwächer ab", () => {
      const counts = anteile(["t3", "t2", "t1"]);

      // Gewichte 0.8, 0.5, 0.2 für t1, t2, t3 — die Reihenfolge der Abwertung
      // folgt der Liste, jüngste zuerst.
      expect(counts.t1).toBeGreaterThan(counts.t2);
      expect(counts.t2).toBeGreaterThan(counts.t3);
      expect(RECENCY_FACTORS).toEqual([0.2, 0.5, 0.8]);
    });

    it("wertet nach drei Zügen gar nicht mehr ab", () => {
      const counts = anteile(["a", "b", "c", "t1"]);

      expect(counts).toEqual({ t1: 134, t2: 133, t3: 133 });
    });

    it("kennt keinen Sonderfall mehr, wenn alle drei zuletzt dran waren", () => {
      // Früher fiel hier die Sperre weg und beide Zufallszahlen ergaben "t3".
      // Jetzt wird schlicht weiter gewichtet gezogen — mit den Abschlägen.
      const alle = ["t1", "t2", "t3"];
      expect(selectTemplate(drei, { recentTemplateIds: alle, now: NOW }, first)?.id).toBe("t1");
      expect(selectTemplate(drei, { recentTemplateIds: alle, now: NOW }, last)?.id).toBe("t3");
    });

    it("liefert auch dann eine Aufgabe, wenn das Thema nur ein Template hat", () => {
      const eins = [template("t1", "kombinatorik.permutation")];
      expect(selectTemplate(eins, { recentTemplateIds: ["t1"], now: NOW }, first)?.id).toBe("t1");
    });
  });

  it("bleibt bei gleicher Zufallszahl bei derselben Wahl", () => {
    const a = selectTemplate(templates, { now: NOW }, () => 0.4);
    const b = selectTemplate(templates, { now: NOW }, () => 0.4);
    expect(a?.id).toBe(b?.id);
  });
});
