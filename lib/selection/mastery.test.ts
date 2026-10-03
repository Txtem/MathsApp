import { describe, expect, it } from "vitest";

import {
  advanceMastery,
  INITIAL_INTERVAL_DAYS,
  MAX_INTERVAL_DAYS,
  type MasteryState,
} from "./mastery";

const NOW = new Date("2026-08-30T12:00:00.000Z");

/** Richtig im ersten Versuch ohne Tipp: zählt für beides. */
const RICHTIG = { correct: true, success: true } as const;
const FALSCH = { correct: false, success: false } as const;
/** Richtig, aber im zweiten Versuch oder mit Tipp: Anzeige ja, Steuerung nein. */
const RICHTIG_OHNE_ERFOLG = { correct: true, success: false } as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Wie viele Tage liegt `dueAt` in der Zukunft? */
function daysUntilDue(dueAt: Date, now = NOW): number {
  return (dueAt.getTime() - now.getTime()) / MS_PER_DAY;
}

describe("advanceMastery", () => {
  describe("ohne bisherigen Eintrag", () => {
    it("zählt den ersten richtigen Versuch", () => {
      const next = advanceMastery(undefined, RICHTIG, NOW);
      expect(next.attempts).toBe(1);
      expect(next.correct).toBe(1);
    });

    it("zählt den ersten falschen Versuch, ohne correct zu erhöhen", () => {
      const next = advanceMastery(undefined, FALSCH, NOW);
      expect(next.attempts).toBe(1);
      expect(next.correct).toBe(0);
    });

    it("behandelt null wie undefined — so kommt es aus Prisma", () => {
      expect(advanceMastery(null, RICHTIG, NOW)).toEqual(advanceMastery(undefined, RICHTIG, NOW));
    });

    it("startet beim Startintervall und verdoppelt es bei richtig", () => {
      expect(advanceMastery(undefined, RICHTIG, NOW).intervalDays).toBe(INITIAL_INTERVAL_DAYS * 2);
    });
  });

  describe("Intervall", () => {
    const state = (intervalDays: number): MasteryState => ({
      attempts: 5,
      correct: 3,
      intervalDays,
    });

    it("verdoppelt bei richtig", () => {
      expect(advanceMastery(state(4), RICHTIG, NOW).intervalDays).toBe(8);
    });

    it("setzt bei falsch auf einen Tag zurück, egal wie hoch es stand", () => {
      expect(advanceMastery(state(32), FALSCH, NOW).intervalDays).toBe(INITIAL_INTERVAL_DAYS);
      expect(advanceMastery(state(1), FALSCH, NOW).intervalDays).toBe(INITIAL_INTERVAL_DAYS);
    });

    it("deckelt bei 60 Tagen", () => {
      expect(advanceMastery(state(32), RICHTIG, NOW).intervalDays).toBe(MAX_INTERVAL_DAYS);
      expect(advanceMastery(state(MAX_INTERVAL_DAYS), RICHTIG, NOW).intervalDays).toBe(
        MAX_INTERVAL_DAYS,
      );
    });

    it("wächst über eine Serie richtiger Antworten 1 → 2 → 4 → 8, nicht schneller", () => {
      let current: MasteryState = { attempts: 0, correct: 0, intervalDays: 1 };
      const seen: number[] = [];

      for (let i = 0; i < 4; i++) {
        const next = advanceMastery(current, RICHTIG, NOW);
        seen.push(next.intervalDays);
        current = next;
      }

      expect(seen).toEqual([2, 4, 8, 16]);
    });

    it("erreicht den Deckel und bleibt dort", () => {
      let current: MasteryState = { attempts: 0, correct: 0, intervalDays: 1 };
      for (let i = 0; i < 20; i++) current = advanceMastery(current, RICHTIG, NOW);
      expect(current.intervalDays).toBe(MAX_INTERVAL_DAYS);
    });
  });

  describe("Termine", () => {
    it("setzt lastSeenAt auf den übergebenen Zeitpunkt", () => {
      expect(advanceMastery(undefined, RICHTIG, NOW).lastSeenAt).toEqual(NOW);
    });

    it("legt dueAt genau intervalDays in die Zukunft", () => {
      const next = advanceMastery({ attempts: 1, correct: 1, intervalDays: 8 }, RICHTIG, NOW);
      expect(next.intervalDays).toBe(16);
      expect(daysUntilDue(next.dueAt)).toBe(16);
    });

    it("macht ein verfehltes Thema morgen wieder fällig", () => {
      const next = advanceMastery({ attempts: 9, correct: 9, intervalDays: 60 }, FALSCH, NOW);
      expect(daysUntilDue(next.dueAt)).toBe(1);
    });

    it("rechnet nicht mit der echten Uhr", () => {
      const other = new Date("2020-01-01T00:00:00.000Z");
      expect(advanceMastery(undefined, RICHTIG, other).lastSeenAt).toEqual(other);
    });
  });

  it("lässt den übergebenen Stand unangetastet", () => {
    const current: MasteryState = { attempts: 2, correct: 1, intervalDays: 4 };
    advanceMastery(current, RICHTIG, NOW);
    expect(current).toEqual({ attempts: 2, correct: 1, intervalDays: 4 });
  });

  describe("richtig, aber nicht als Erfolg (zweiter Versuch oder Tipp)", () => {
    const GEUEBT = { attempts: 3, correct: 2, intervalDays: 8 };

    it("zählt in correct mit — für die Anzeige ist richtig richtig", () => {
      const next = advanceMastery(GEUEBT, RICHTIG_OHNE_ERFOLG, NOW);
      expect(next.attempts).toBe(4);
      expect(next.correct).toBe(3);
    });

    it("setzt das Intervall trotzdem zurück — das Thema kommt morgen wieder", () => {
      const next = advanceMastery(GEUEBT, RICHTIG_OHNE_ERFOLG, NOW);
      expect(next.intervalDays).toBe(INITIAL_INTERVAL_DAYS);
      expect(daysUntilDue(next.dueAt)).toBe(INITIAL_INTERVAL_DAYS);
    });
  });

  /**
   * Der Termin wird über Millisekunden gerechnet, nicht über Kalendertage
   * (D-20). Über eine Zeitumstellung hinweg hat ein lokaler Kalendertag
   * 23 oder 25 Stunden — wer `setDate()` benutzt, verschiebt den Termin.
   */
  describe("über die Zeitumstellung hinweg", () => {
    // In Europa wird in der Nacht zum 29.03.2026 auf Sommerzeit gestellt.
    const VORHER = new Date("2026-03-28T12:00:00.000Z");

    it("hält den Millisekundenabstand exakt ein", () => {
      const next = advanceMastery({ attempts: 4, correct: 4, intervalDays: 1 }, RICHTIG, VORHER);

      expect(next.intervalDays).toBe(2);
      expect(next.dueAt.getTime() - VORHER.getTime()).toBe(2 * MS_PER_DAY);
    });

    it("verschiebt den Termin nicht um eine Stunde Ortszeit", () => {
      const next = advanceMastery(undefined, FALSCH, VORHER);

      // Ein Kalendertag später wäre in Ortszeit dieselbe Stunde — hier ist es
      // eine Stunde später, weil die Nacht nur 23 Stunden hatte. Genau das ist
      // gewollt: Der Abstand ist die Größe, die zählt.
      expect(next.dueAt.toISOString()).toBe("2026-03-29T12:00:00.000Z");
      expect(next.dueAt.getTime() - VORHER.getTime()).toBe(MS_PER_DAY);
    });

    it("rechnet auch bei gebrochenem Intervall in Millisekunden", () => {
      const next = advanceMastery({ attempts: 1, correct: 0, intervalDays: 0.25 }, RICHTIG, VORHER);

      expect(next.dueAt.getTime() - VORHER.getTime()).toBe(0.5 * MS_PER_DAY);
    });
  });
});
