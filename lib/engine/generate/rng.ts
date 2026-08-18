/**
 * Seeded PRNG. Gleicher Seed ⇒ gleiche Folge, plattformunabhängig — das ist die
 * Grundlage der Reproduzierbarkeit: Aus `seed + templateId + templateVersion`
 * lässt sich jede Aufgabe exakt wiederherstellen.
 *
 * `Math.random()` kommt hier nicht vor. Wer einen Zufallswert braucht, würfelt
 * den Seed außerhalb der Engine und reicht ihn herein.
 */

export interface Rng {
  /** Gleichverteilt in [0, 1). */
  next(): number;
  /** Gleichverteilte Ganzzahl in [min, max], beide Grenzen eingeschlossen. */
  int(min: number, max: number): number;
  /** Ein Element aus der Liste. */
  pick<T>(values: readonly T[]): T;
}

/** FNV-1a über die UTF-16-Codeunits — verteilt auch ähnliche Seeds gut. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function makeRng(seed: string): Rng {
  let state = hashSeed(seed);

  // mulberry32
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max)) {
        throw new RangeError(`int erwartet ganzzahlige Grenzen, bekam [${min}, ${max}].`);
      }
      if (min > max) throw new RangeError(`Leerer Bereich: min ${min} > max ${max}.`);
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(values) {
      const value = values[Math.floor(next() * values.length)];
      if (value === undefined) throw new RangeError("pick auf einer leeren Liste.");
      return value;
    },
  };
}
