import { describe, expect, it } from "vitest";

import { productionSources, readSource } from "@/lib/__testing__/sources";

/**
 * Eine Uhr pro Anfrage (D-20).
 *
 * Geprüft wird die Regel, nicht eine einzelne Funktion: Wer `new Date()` in
 * sich trägt, ist nicht testbar und liefert zwei Zeitstempel, wo einer gemeint
 * war — ein Statuswechsel und der Termin dazu lagen so Millisekunden
 * auseinander. Der Zeitpunkt entsteht deshalb einmal am Eingang der Anfrage und
 * wird von dort weitergereicht.
 *
 * Als Kriterium formuliert, nicht als Liste von Dateien: Einstiegspunkt ist,
 * was Next.js selbst aufruft — ein Route Handler oder eine Seite. Eine neue
 * Route braucht damit keinen Eintrag hier, und eine Funktion darunter bekommt
 * auch dann keinen, wenn sie neu ist. Dasselbe Muster wie bei der
 * `server-only`-Regel in CLAUDE.md.
 */

const EINSTIEGSPUNKT = /^app\/(.*\/)?(route\.ts|page\.tsx)$/;

/**
 * Die eine Ausnahme: Die Stoppuhr des Aufgaben-Loops läuft im Browser und misst
 * eine Dauer, keinen Zeitpunkt. Sie entscheidet nichts — die gemessene Zeit geht
 * als `durationMs` an den Server und wird dort bewertet.
 */
const STOPPUHR = "app/(app)/practice/[sessionId]/practice-loop.tsx";

/** `new Date()` und `Date.now()` ohne Argument — `new Date(now.getTime() + x)` bleibt erlaubt. */
const UHR = /new Date\(\s*\)|Date\.now\(\s*\)/;

describe("eine Uhr pro Anfrage", () => {
  const dateien = productionSources();

  it("findet überhaupt Dateien — sonst prüft der Test nichts", () => {
    expect(dateien.length).toBeGreaterThan(20);
  });

  it("liest die Uhr nur an den Einstiegspunkten", () => {
    const verstoesse = dateien
      .filter((datei) => !EINSTIEGSPUNKT.test(datei) && datei !== STOPPUHR)
      .filter((datei) => UHR.test(readSource(datei)));

    expect(verstoesse).toEqual([]);
  });

  it("hält die Ausnahme aktuell", () => {
    // Eine Ausnahme, die nichts mehr trifft, ist eine Ausnahme ohne Grund.
    expect(dateien).toContain(STOPPUHR);
    expect(UHR.test(readSource(STOPPUHR))).toBe(true);
  });
});
