import { describe, expect, it } from "vitest";

import { readSource } from "@/lib/__testing__/sources";

import { type ClosedAttempt, toTimings } from "./answer-times";
import { countSnaps, medianTime, SNAP_SHARE } from "./stats-rows";

const TARGET = 60_000;
const target = () => TARGET;

function closed(overrides: Partial<ClosedAttempt>): ClosedAttempt {
  return {
    templateId: "aufg_00003",
    topic: "a",
    status: "ANSWERED",
    isCorrect: true,
    tries: 1,
    hintsUsed: 0,
    durationMs: 30_000,
    firstMissed: false,
    firstDurationMs: null,
    ...overrides,
  };
}

const SCHNELL = TARGET * SNAP_SHARE - 1;

describe("toTimings — erste Antworten für die Schnellschüsse", () => {
  it("nimmt bei einem zweiten Versuch die Zeit der ersten Antwort", () => {
    const { firstAnswers } = toTimings(
      [closed({ tries: 2, firstMissed: true, firstDurationMs: SCHNELL, durationMs: 50_000 })],
      target,
    );
    expect(firstAnswers).toEqual([
      { topic: "a", targetMs: TARGET, durationMs: SCHNELL, isCorrect: false },
    ]);
  });

  it("lässt einen geratenen ersten Versuch nicht verschwinden, wenn der zweite sitzt", () => {
    const attempts = Array.from({ length: 3 }, () =>
      closed({ tries: 2, isCorrect: true, firstMissed: true, firstDurationMs: SCHNELL }),
    );
    expect(countSnaps(toTimings(attempts, target).firstAnswers).get("a")).toBe(3);
  });

  it("zählt eine im ersten Versuch schnelle falsche Antwort wie bisher", () => {
    const { firstAnswers } = toTimings(
      [closed({ isCorrect: false, durationMs: SCHNELL })],
      target,
    );
    expect(firstAnswers).toEqual([
      { topic: "a", targetMs: TARGET, durationMs: SCHNELL, isCorrect: false },
    ]);
  });

  it("nimmt einen schnellen ersten Fehlversuch auch nach dem Aufgeben mit", () => {
    const { firstAnswers } = toTimings(
      [closed({ status: "SKIPPED", isCorrect: null, durationMs: null, firstMissed: true, firstDurationMs: SCHNELL })],
      target,
    );
    expect(firstAnswers).toHaveLength(1);
  });

  it("hat keine erste Antwort, wenn ohne Antwort aufgegeben wurde", () => {
    const { firstAnswers } = toTimings(
      [closed({ status: "SKIPPED", isCorrect: null, durationMs: null })],
      target,
    );
    expect(firstAnswers).toEqual([]);
  });

  it("zählt eine schnelle richtige erste Antwort nicht als Schnellschuss", () => {
    const { firstAnswers } = toTimings([closed({ durationMs: SCHNELL })], target);
    expect(countSnaps(firstAnswers).size).toBe(0);
  });
});

describe("toTimings — schließende Antworten für die Medianzeit", () => {
  it("rechnet mit der Zeit bis zur letzten Antwort, auch im zweiten Versuch", () => {
    const attempts = Array.from({ length: 5 }, () =>
      closed({ tries: 2, firstMissed: true, firstDurationMs: 10_000, durationMs: 90_000 }),
    );
    expect(medianTime(toTimings(attempts, target).finalAnswers).relative).toBe(1.5);
  });

  it("nimmt Aufgegebene nicht in die Zeiten", () => {
    const { finalAnswers } = toTimings(
      [closed({ status: "SKIPPED", isCorrect: null, durationMs: null })],
      target,
    );
    expect(finalAnswers).toEqual([]);
  });

  it("reicht eine fehlende Zielzeit als null durch", () => {
    const { finalAnswers } = toTimings([closed({})], () => null);
    expect(finalAnswers[0]?.targetMs).toBeNull();
  });
});

describe("Die Statistik-Seite benutzt diese Zuordnung", () => {
  // Konvention zu Extraktionen: Die Tests oben gelten nur, wenn die Seite
  // genau diese Funktionen so verdrahtet.
  it("gibt erste Antworten an die Schnellschüsse, schließende an die Medianzeit", () => {
    const source = readSource("app/(app)/stats/page.tsx");

    expect(source).toContain("toTimings(closed,");
    expect(source).toMatch(/toStatsGroups\([\s\S]*?firstAnswers,[\s\S]*?\)/);
    expect(source).toContain("toSummary(totals, finalAnswers)");
    expect(source).toContain("summarizeOutcomes(closed)");
  });
});
