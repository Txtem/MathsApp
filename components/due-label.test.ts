import { describe, expect, it } from "vitest";

import { dueLabel } from "./due-label";

const NOW = new Date("2026-08-30T12:00:00.000Z");
const STUNDE = 60 * 60 * 1000;

/** Ein Termin `stunden` Stunden nach `NOW`. */
function in_(stunden: number): Date {
  return new Date(NOW.getTime() + stunden * STUNDE);
}

/** Führt `arbeit` unter einer bestimmten Zeitzone aus und stellt sie danach zurück. */
function unter<T>(zeitzone: string, arbeit: () => T): T {
  const vorher = process.env.TZ;
  process.env.TZ = zeitzone;
  try {
    return arbeit();
  } finally {
    process.env.TZ = vorher;
  }
}

describe("dueLabel", () => {
  describe("fällig", () => {
    it("nennt ein Thema ohne Termin fällig — es wurde nie geübt", () => {
      expect(dueLabel(null, NOW)).toBe("fällig");
    });

    it("nennt einen vergangenen Termin fällig", () => {
      expect(dueLabel(in_(-1), NOW)).toBe("fällig");
      expect(dueLabel(in_(-24 * 30), NOW)).toBe("fällig");
    });

    it("nennt den Termin genau jetzt fällig", () => {
      expect(dueLabel(new Date(NOW.getTime()), NOW)).toBe("fällig");
    });
  });

  describe("die nächsten zwei Tage", () => {
    it("sagt „morgen", () => {
      expect(dueLabel(in_(1), NOW)).toBe("morgen");
      expect(dueLabel(in_(23), NOW)).toBe("morgen");
      expect(dueLabel(in_(47), NOW)).toBe("morgen");
    });

    it("zählt ab 48 Stunden in Tagen", () => {
      expect(dueLabel(in_(48), NOW)).toBe("in 2 Tagen");
    });
  });

  describe("weiter weg", () => {
    it("rundet auf, damit ein angebrochener Tag nicht verschwindet", () => {
      expect(dueLabel(in_(49), NOW)).toBe("in 3 Tagen");
      expect(dueLabel(in_(72), NOW)).toBe("in 3 Tagen");
      expect(dueLabel(in_(73), NOW)).toBe("in 4 Tagen");
    });

    it("trägt auch den Deckel von 60 Tagen", () => {
      expect(dueLabel(in_(24 * 60), NOW)).toBe("in 60 Tagen");
    });
  });

  /**
   * Die Umkehrung der Messung, die den Fehler gefunden hat: Derselbe Termin
   * las sich unter `Europe/Berlin` als 19.10. und unter `UTC` als 18.10.
   */
  describe("hängt nicht an der Zeitzone", () => {
    // Der Wert aus der Messung: kurz vor Mitternacht UTC.
    const TERMIN = new Date("2026-10-18T22:01:13.241Z");
    const JETZT = new Date("2026-10-16T09:00:00.000Z");

    it("liefert unter Europe/Berlin und UTC dieselbe Ausgabe", () => {
      const berlin = unter("Europe/Berlin", () => dueLabel(TERMIN, JETZT));
      const utc = unter("UTC", () => dueLabel(TERMIN, JETZT));

      expect(berlin).toBe(utc);
      expect(berlin).toBe("in 3 Tagen");
    });

    it("Gegenprobe: ein Kalenderdatum täte es nicht", () => {
      // Ohne diese Zeile wäre der Test darüber wertlos — er würde auch dann
      // grün, wenn die Zeitzone hier gar nichts zu ändern hätte.
      const berlin = unter("Europe/Berlin", () => TERMIN.toLocaleDateString("de-DE"));
      const utc = unter("UTC", () => TERMIN.toLocaleDateString("de-DE"));

      expect(berlin).not.toBe(utc);
    });
  });
});
