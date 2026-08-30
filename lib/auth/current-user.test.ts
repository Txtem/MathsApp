import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

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
 * Testdateien bleiben außen vor — sie werden nicht ausgeliefert, und diese hier
 * nennt den Pfad selbst.
 */

const ROOT = join(import.meta.dirname, "..", "..");
const DIRECTORIES = ["app", "lib", "components", "scripts"];
const EXTENSIONS = [".ts", ".tsx"];
const ALLOWED = ["lib/auth/current-user.ts", "lib/db/dev-user.ts"];
const IS_TEST = /\.test\.tsx?$/;

function sourceFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "generated") continue;
      found.push(...sourceFiles(path));
    } else if (
      EXTENSIONS.some((extension) => entry.name.endsWith(extension)) &&
      !IS_TEST.test(entry.name)
    ) {
      found.push(path);
    }
  }

  return found;
}

describe("getCurrentUserId ist der einzige Weg zum Nutzer", () => {
  const files = DIRECTORIES.flatMap((directory) => sourceFiles(join(ROOT, directory)));

  it("findet überhaupt Dateien — sonst prüft der Test nichts", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("niemand außer lib/auth/current-user.ts importiert den Dev-User", () => {
    const offenders = files
      .map((file) => relative(ROOT, file).split(sep).join("/"))
      .filter((file) => !ALLOWED.includes(file))
      .filter((file) => readFileSync(join(ROOT, file), "utf8").includes("db/dev-user"));

    expect(offenders).toEqual([]);
  });
});
