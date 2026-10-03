import { describe, expect, it } from "vitest";

import { productionSources, readSource } from "@/lib/__testing__/sources";

/**
 * Die beiden Wege aus einer begonnenen Aufgabe (SPEC-M2f, Schritt 4b) sind in
 * `resume-attempt.ts` und `start-session.ts` gegen die Datenbank getestet. Die
 * Routen selbst lassen sich nicht importieren — hier wird am Quelltext
 * festgehalten, dass sie genau diese Funktionen aufrufen und nicht daneben
 * etwas Eigenes tun. Sonst prüften die Tests einen Pfad, den die Anwendung nie
 * nimmt (Konvention zu Extraktionen).
 */

const NEXT_ROUTE = "app/api/session/[id]/next/route.ts";
const SESSION_ROUTE = "app/api/session/route.ts";

describe("Neuladen und neue Sitzung laufen durch die getesteten Funktionen", () => {
  it("/next fragt erst nach einem offenen Attempt, bevor es einen neuen anlegt", () => {
    const source = readSource(NEXT_ROUTE);

    const resume = source.indexOf("await resumeOpenAttempt(");
    const create = source.indexOf("prisma.attempt.create(");
    expect(resume).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(resume);
    expect(source).toMatch(/if \(resumed\) return/);
  });

  it("/api/session legt die Sitzung über startSession an", () => {
    const source = readSource(SESSION_ROUTE);

    expect(source).toContain("await startSession(");
    expect(source).not.toContain("practiceSession.create(");
  });

  it("keine andere Stelle legt eine Sitzung an", () => {
    // Eine zweite Stelle umginge das Schließen verlassener Attempts.
    const creators = productionSources().filter((file) =>
      readSource(file).includes("practiceSession.create("),
    );
    expect(creators).toEqual(["lib/db/start-session.ts"]);
  });
});
