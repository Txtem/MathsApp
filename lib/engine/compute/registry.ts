import { z } from "zod";

import { binomial, factorial, permutations } from "../expr/bigmath";
import * as Q from "../expr/rational";
import { type AnyComputeEntry, defineCompute } from "../types";
import { add, subtract } from "./arithmetik";
import {
  combinationsWithRepetition,
  distributions,
  letterPermutations,
  multisetPermutations,
} from "./kombinatorik";
import { hypergeometricAtLeastOne, hypergeometricExactly } from "./wahrscheinlichkeit";

/**
 * Whitelist: `compute_ref` aus einem Template ist ein Schlüssel dieser Registry,
 * nie ein Codepfad. Kein `eval`, kein dynamischer Import.
 *
 * Alle Eingabeschemata sind `strictObject`. Ein Template mit einem Parameter zu
 * viel fällt damit beim `content:check` auf, statt still ignoriert zu werden.
 * Die Beziehungen zwischen Parametern (`k <= n`) stehen als `refine` dabei —
 * `instantiate` verwirft solche Würfe und würfelt neu.
 */

/** Obergrenze für alles, was in eine Fakultät geht. */
const N_MAX = 500;

const Operands = z.strictObject({
  a: z.number().int(),
  b: z.number().int(),
});

const Single = z.strictObject({
  n: z.number().int().min(0).max(N_MAX),
});

const Pair = z.strictObject({
  n: z.number().int().min(0).max(N_MAX),
  k: z.number().int().min(0).max(N_MAX),
});

const PairOrdered = Pair.refine((v) => v.k <= v.n, {
  message: "k darf nicht größer als n sein",
});

/**
 * Bis zu vier Gruppen. `k3` und `k4` sind optional, damit ein Template genau so
 * viele Gruppen angeben kann, wie die Aufgabe hat — MISSISSIPPI braucht vier
 * (4×I, 4×S, 2×P, 1×M). Siehe DECISIONS.md, D-15.
 *
 * **Kein `n`.** Die Gesamtzahl ist die Summe der Gruppen und wird hier gebildet,
 * statt daneben verlangt zu werden. Ein Template, das `n` unabhängig würfelt und
 * über ein Constraint zur Summe passen lässt, verwirft fünf von sechs Würfen und
 * kippt irgendwann über `MAX_TRIES` — das war der Grund für das statische
 * `aufg_00004` in D-13. Ableiten statt abschreiben, siehe D-26.
 */
const Multiset = z
  .strictObject({
    k1: z.number().int().min(1).max(N_MAX),
    k2: z.number().int().min(1).max(N_MAX),
    k3: z.number().int().min(1).max(N_MAX).optional(),
    k4: z.number().int().min(1).max(N_MAX).optional(),
  })
  .refine((v) => v.k1 + v.k2 + (v.k3 ?? 0) + (v.k4 ?? 0) <= N_MAX, {
    message: `Die Gruppen ergeben zusammen mehr als ${N_MAX}`,
  });

/**
 * Ein Wort für die Buchstaben-Permutation: Großbuchstaben ohne Umlaute, damit
 * die Wortliste im Template und der gerenderte Fragetext dieselbe Schreibweise
 * haben. Mindestens zwei Buchstaben, sonst gibt es nichts zu vertauschen; die
 * Obergrenze hält die Fakultät klein.
 */
const Wort = z.strictObject({
  wort: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z]+$/, "Nur Großbuchstaben A-Z, keine Umlaute und kein ß"),
});

const Hypergeometric = z
  .strictObject({
    population: z.number().int().min(1).max(2000),
    successes: z.number().int().min(0).max(2000),
    draws: z.number().int().min(1).max(2000),
    hits: z.number().int().min(0).max(2000),
  })
  .refine((v) => v.successes <= v.population, { message: "successes <= population" })
  .refine((v) => v.draws <= v.population, { message: "draws <= population" })
  .refine((v) => v.hits <= v.successes, { message: "hits <= successes" })
  .refine((v) => v.draws - v.hits <= v.population - v.successes, {
    message: "draws - hits <= population - successes",
  });

const HypergeometricAtLeastOne = z
  .strictObject({
    population: z.number().int().min(1).max(2000),
    successes: z.number().int().min(0).max(2000),
    draws: z.number().int().min(1).max(2000),
  })
  .refine((v) => v.successes <= v.population, { message: "successes <= population" })
  .refine((v) => v.draws <= v.population, { message: "draws <= population" });

const big = (value: number): bigint => BigInt(value);

export const registry = {
  "arithmetik.add": defineCompute({
    input: Operands,
    compute: ({ a, b }) => Q.fromBigInt(add(big(a), big(b))),
  }),

  "arithmetik.subtract": defineCompute({
    input: Operands,
    compute: ({ a, b }) => Q.fromBigInt(subtract(big(a), big(b))),
  }),

  /** Permutationen ohne Wiederholung: n! */
  "kombinatorik.permutation.factorial": defineCompute({
    input: Single,
    compute: ({ n }) => Q.fromBigInt(factorial(big(n))),
  }),

  /** Permutationen mit Wiederholung: n! / (k1! · k2! · k3! · k4!), n = Summe der Gruppen. */
  "kombinatorik.permutation.multiset": defineCompute({
    input: Multiset,
    compute: ({ k1, k2, k3, k4 }) => {
      const groups = [k1, k2, k3, k4].flatMap((size) => (size === undefined ? [] : [big(size)]));
      const n = groups.reduce((sum, size) => sum + size, 0n);
      return Q.fromBigInt(multisetPermutations(n, groups));
    },
  }),

  /** Permutationen der Buchstaben eines Wortes — die Häufigkeiten zählt die Funktion. */
  "kombinatorik.permutation.wort": defineCompute({
    input: Wort,
    compute: ({ wort }) => Q.fromBigInt(letterPermutations(wort)),
  }),

  /** Variationen ohne Wiederholung: n! / (n-k)! */
  "kombinatorik.variation.ohne_wdh": defineCompute({
    input: PairOrdered,
    compute: ({ n, k }) => Q.fromBigInt(permutations(big(n), big(k))),
  }),

  /** Variationen mit Wiederholung: n^k */
  "kombinatorik.variation.mit_wdh": defineCompute({
    input: Pair,
    compute: ({ n, k }) => Q.pow(Q.fromBigInt(big(n)), big(k)),
  }),

  /** Kombinationen ohne Wiederholung: C(n, k) */
  "kombinatorik.kombination.ohne_wdh": defineCompute({
    input: PairOrdered,
    compute: ({ n, k }) => Q.fromBigInt(binomial(big(n), big(k))),
  }),

  /** Kombinationen mit Wiederholung: C(n+k-1, k) */
  "kombinatorik.kombination.mit_wdh": defineCompute({
    input: Pair,
    compute: ({ n, k }) => Q.fromBigInt(combinationsWithRepetition(big(n), big(k))),
  }),

  /** Verteilungen (Stars and Bars): C(n+k-1, k-1) */
  "kombinatorik.verteilung.nichtnegativ": defineCompute({
    input: z.strictObject({
      n: z.number().int().min(0).max(N_MAX),
      k: z.number().int().min(1).max(N_MAX),
    }),
    compute: ({ n, k }) => Q.fromBigInt(distributions(big(n), big(k))),
  }),

  /** Anzahl aller Teilmengen: 2^n */
  "kombinatorik.teilmengen.anzahl": defineCompute({
    input: Single,
    compute: ({ n }) => Q.pow(Q.fromBigInt(2n), big(n)),
  }),

  /** P(X = k) der hypergeometrischen Verteilung. */
  "wahrscheinlichkeit.hypergeometrisch.genau": defineCompute({
    input: Hypergeometric,
    compute: ({ population, successes, draws, hits }) =>
      hypergeometricExactly(big(population), big(successes), big(draws), big(hits)),
  }),

  /** P(X >= 1) der hypergeometrischen Verteilung. */
  "wahrscheinlichkeit.hypergeometrisch.mindestens_eins": defineCompute({
    input: HypergeometricAtLeastOne,
    compute: ({ population, successes, draws }) =>
      hypergeometricAtLeastOne(big(population), big(successes), big(draws)),
  }),
} as const satisfies Record<string, AnyComputeEntry>;

/** Alle gültigen `compute_ref`-Werte. */
export type ComputeRef = keyof typeof registry;

export function isComputeRef(ref: string): ref is ComputeRef {
  return Object.prototype.hasOwnProperty.call(registry, ref);
}
