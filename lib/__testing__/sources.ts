import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Der ausgelieferte Quelltext, als Liste von Pfaden — für Tests, die eine Regel
 * am Quelltext prüfen statt am Verhalten. Zwei tun das: `current-user.test.ts`
 * (nur `getCurrentUserId` kennt den Nutzer) und `one-clock.test.ts` (nur die
 * Einstiegspunkte lesen die Uhr).
 *
 * Ein Import, der nur in einem toten Zweig steht, ist genauso ein Verstoß —
 * deshalb Quelltext statt Laufzeit.
 *
 * Test- und Testhilfsdateien bleiben außen vor: Sie werden nicht ausgeliefert,
 * und eine Regel, die auch im Test gälte, wäre eine andere Regel.
 */

export const ROOT = join(import.meta.dirname, "..", "..");

const DIRECTORIES = ["app", "lib", "components", "scripts"];
const EXTENSIONS = [".ts", ".tsx"];
const IS_TEST = /\.test\.tsx?$/;

function walk(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", "generated", "__testing__"].includes(entry.name)) continue;
      found.push(...walk(path));
    } else if (
      EXTENSIONS.some((extension) => entry.name.endsWith(extension)) &&
      !IS_TEST.test(entry.name)
    ) {
      found.push(path);
    }
  }

  return found;
}

/** Repo-relative Pfade mit "/" als Trenner, damit Vergleiche auf jedem System stimmen. */
export function productionSources(): string[] {
  return DIRECTORIES.flatMap((directory) => walk(join(ROOT, directory))).map((file) =>
    relative(ROOT, file).split(sep).join("/"),
  );
}

export function readSource(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}
