import { describe, expect, it } from "vitest";

import { productionSources, readSource } from "@/lib/__testing__/sources";

/**
 * Kein Test der Funktion selbst — die gibt in M2a eine Konstante zurück und
 * bräuchte dafür eine Datenbank. Geprüft wird die Regel, die sie trägt:
 *
 * `lib/db/dev-user.ts` hat genau einen Aufrufer, nämlich `getCurrentUserId`.
 * Sobald eine Route den Dev-User wieder direkt importiert, muss M2b diese
 * Stelle einzeln umbauen — und genau das soll auffallen, bevor es passiert.
 *
 * Der Test liest den Quelltext, statt Importe zur Laufzeit zu verfolgen: Ein
 * Import, der nur in einem ungenutzten Zweig steht, ist genauso ein Verstoß.
 * Die Dateiliste kommt aus `lib/__testing__/sources.ts` — dieselbe, gegen die
 * `one-clock.test.ts` seine Regel prüft.
 */

const ALLOWED = ["lib/auth/current-user.ts", "lib/db/dev-user.ts"];

describe("getCurrentUserId ist der einzige Weg zum Nutzer", () => {
  const files = productionSources();

  it("findet überhaupt Dateien — sonst prüft der Test nichts", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("niemand außer lib/auth/current-user.ts importiert den Dev-User", () => {
    const offenders = files
      .filter((file) => !ALLOWED.includes(file))
      .filter((file) => readSource(file).includes("db/dev-user"));

    expect(offenders).toEqual([]);
  });
});
