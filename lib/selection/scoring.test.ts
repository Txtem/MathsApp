import { describe, expect, it } from "vitest";

import {
  chooseTopic,
  isDue,
  MIN_ATTEMPTS_FOR_RATE,
  RECENCY_FACTORS,
  recencyFactor,
  successRate,
  targetDifficulty,
  templateWeight,
  type TopicStats,
  topicScore,
  UNTESTED_RATE,
} from "./scoring";

const NOW = new Date("2026-08-30T12:00:00.000Z");
const GESTERN = new Date("2026-08-29T12:00:00.000Z");
const MORGEN = new Date("2026-08-31T12:00:00.000Z");

function stats(overrides: Partial<TopicStats> = {}): TopicStats {
  return {
    topic: "kombinatorik.permutation",
    recentCorrect: 0,
    recentAnswered: 0,
    dueAt: null,
    lastSeenAt: null,
    ...overrides,
  };
}

describe("successRate", () => {
  it("gibt 0.5, solange zu wenige Versuche vorliegen", () => {
    for (let answered = 0; answered < MIN_ATTEMPTS_FOR_RATE; answered++) {
      expect(successRate(stats({ recentAnswered: answered, recentCorrect: answered }))).toBe(
        UNTESTED_RATE,
      );
    }
  });

  it("rechnet ab dem dritten Versuch echt", () => {
    expect(successRate(stats({ recentAnswered: 3, recentCorrect: 2 }))).toBeCloseTo(2 / 3);
    expect(successRate(stats({ recentAnswered: 10, recentCorrect: 9 }))).toBe(0.9);
  });

  it("kennt 0 und 1", () => {
    expect(successRate(stats({ recentAnswered: 10, recentCorrect: 0 }))).toBe(0);
    expect(successRate(stats({ recentAnswered: 10, recentCorrect: 10 }))).toBe(1);
  });

  it("lässt drei Fehlversuche nicht als Zufall durchgehen", () => {
    // Die Grenze ist bewusst niedrig: Wer dreimal daneben liegt, soll das
    // Thema häufiger bekommen, nicht erst nach zehn Versuchen.
    expect(successRate(stats({ recentAnswered: 3, recentCorrect: 0 }))).toBe(0);
  });
});

describe("isDue", () => {
  it("ohne Eintrag fällig", () => {
    expect(isDue(stats({ dueAt: null }), NOW)).toBe(true);
  });

  it("in der Vergangenheit fällig, in der Zukunft nicht", () => {
    expect(isDue(stats({ dueAt: GESTERN }), NOW)).toBe(true);
    expect(isDue(stats({ dueAt: MORGEN }), NOW)).toBe(false);
  });

  it("genau jetzt zählt als fällig", () => {
    expect(isDue(stats({ dueAt: new Date(NOW) }), NOW)).toBe(true);
  });
});

describe("topicScore", () => {
  it("bewertet das schwächste fällige Thema am höchsten", () => {
    const schwach = stats({ recentAnswered: 10, recentCorrect: 0, dueAt: GESTERN });
    expect(topicScore(schwach, NOW)).toBe(3);
  });

  it("bewertet ein sicheres, nicht fälliges Thema mit null", () => {
    const stark = stats({ recentAnswered: 10, recentCorrect: 10, dueAt: MORGEN });
    expect(topicScore(stark, NOW)).toBe(0);
  });

  it("gibt einem unerprobten Thema 2 — 1 aus der Quote, 1 aus der Fälligkeit", () => {
    expect(topicScore(stats(), NOW)).toBe(2);
  });

  it("wiegt Schwäche schwerer als Fälligkeit", () => {
    // Halb so gute Quote, aber nicht fällig, schlägt gute Quote plus fällig.
    const schwachNichtFaellig = stats({ recentAnswered: 10, recentCorrect: 2, dueAt: MORGEN });
    const starkFaellig = stats({ recentAnswered: 10, recentCorrect: 9, dueAt: GESTERN });
    expect(topicScore(schwachNichtFaellig, NOW)).toBeGreaterThan(topicScore(starkFaellig, NOW));
  });
});

describe("chooseTopic", () => {
  it("gibt undefined ohne Kandidaten", () => {
    expect(chooseTopic([], NOW)).toBeUndefined();
  });

  it("nimmt den höchsten Score", () => {
    const stark = stats({ topic: "a", recentAnswered: 10, recentCorrect: 10, dueAt: MORGEN });
    const schwach = stats({ topic: "b", recentAnswered: 10, recentCorrect: 1, dueAt: MORGEN });
    expect(chooseTopic([stark, schwach], NOW)?.topic).toBe("b");
    expect(chooseTopic([schwach, stark], NOW)?.topic).toBe("b");
  });

  it("entscheidet bei Gleichstand für das länger nicht gestellte Thema", () => {
    const neulich = stats({ topic: "a", lastSeenAt: NOW });
    const laenger = stats({ topic: "b", lastSeenAt: GESTERN });
    expect(chooseTopic([neulich, laenger], NOW)?.topic).toBe("b");
    expect(chooseTopic([laenger, neulich], NOW)?.topic).toBe("b");
  });

  it("behandelt ein nie gestelltes Thema als das älteste", () => {
    const nie = stats({ topic: "a", lastSeenAt: null });
    const gestern = stats({ topic: "b", lastSeenAt: GESTERN });
    expect(chooseTopic([gestern, nie], NOW)?.topic).toBe("a");
    expect(chooseTopic([nie, gestern], NOW)?.topic).toBe("a");
  });

  it("bleibt bei völligem Gleichstand bei der Eingabereihenfolge", () => {
    const a = stats({ topic: "a" });
    const b = stats({ topic: "b" });
    expect(chooseTopic([a, b], NOW)?.topic).toBe("a");
    expect(chooseTopic([b, a], NOW)?.topic).toBe("b");
  });

  it("zieht ein fälliges Thema einem gleich starken, nicht fälligen vor", () => {
    const faellig = stats({ topic: "a", recentAnswered: 10, recentCorrect: 8, dueAt: GESTERN });
    const nicht = stats({ topic: "b", recentAnswered: 10, recentCorrect: 8, dueAt: MORGEN });
    expect(chooseTopic([nicht, faellig], NOW)?.topic).toBe("a");
  });
});

describe("targetDifficulty", () => {
  const cases: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [0.39, 1],
    [0.4, 2],
    [0.5, 2],
    [0.69, 2],
    // Die untere Grenze gehört zur höheren Stufe.
    [0.7, 3],
    [0.85, 3],
    [0.9, 3],
    [0.91, 4],
    [1, 4],
  ];

  it.each(cases)("Quote %s ergibt Schwierigkeit %s", (rate, expected) => {
    expect(targetDifficulty(rate)).toBe(expected);
  });

  it("steigt monoton", () => {
    let previous = 0;
    for (let rate = 0; rate <= 1.0001; rate += 0.01) {
      const current = targetDifficulty(rate);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it("gibt einem unerprobten Thema die Mitte", () => {
    expect(targetDifficulty(UNTESTED_RATE)).toBe(2);
  });
});

describe("templateWeight", () => {
  it("gewichtet die Zielschwierigkeit am höchsten", () => {
    expect(templateWeight(3, 3)).toBe(1);
  });

  it("fällt mit dem Abstand ab", () => {
    expect(templateWeight(2, 3)).toBe(1 / 2);
    expect(templateWeight(4, 3)).toBe(1 / 2);
    expect(templateWeight(1, 3)).toBe(1 / 3);
    expect(templateWeight(5, 1)).toBe(1 / 5);
  });

  it("wird nie null — kein Template ist ganz ausgeschlossen", () => {
    for (let difficulty = 1; difficulty <= 5; difficulty++) {
      expect(templateWeight(difficulty, 1)).toBeGreaterThan(0);
    }
  });
});

describe("recencyFactor", () => {
  const zuletzt = ["t1", "t2", "t3"];

  it("wertet nach dem Abstand zur letzten Verwendung ab", () => {
    expect(recencyFactor("t1", zuletzt)).toBe(RECENCY_FACTORS[0]);
    expect(recencyFactor("t2", zuletzt)).toBe(RECENCY_FACTORS[1]);
    expect(recencyFactor("t3", zuletzt)).toBe(RECENCY_FACTORS[2]);
  });

  it("lässt alles Ältere und alles Ungestellte unangetastet", () => {
    expect(recencyFactor("t4", ["t1", "t2", "t3", "t4"])).toBe(1);
    expect(recencyFactor("t9", zuletzt)).toBe(1);
    expect(recencyFactor("t1", [])).toBe(1);
  });

  it("zählt bei Wiederholungen die jüngste Verwendung", () => {
    // "t1" steht zweimal drin — der stärkere Abschlag gewinnt.
    expect(recencyFactor("t1", ["t1", "t2", "t1"])).toBe(RECENCY_FACTORS[0]);
    expect(recencyFactor("t2", ["t1", "t1", "t2"])).toBe(RECENCY_FACTORS[2]);
  });

  it("wird nie null — auch das eben gestellte Template bleibt möglich", () => {
    for (const faktor of RECENCY_FACTORS) expect(faktor).toBeGreaterThan(0);
    expect(recencyFactor("t1", zuletzt)).toBeGreaterThan(0);
  });
});
