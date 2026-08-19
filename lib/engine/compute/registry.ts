import { z } from "zod";

import { binomial, factorial, permutations } from "../expr/bigmath";
import * as Q from "../expr/rational";
import { type AnyComputeEntry, defineCompute } from "../types";
import { add, subtract } from "./arithmetik";
import { combinationsWithRepetition, distributions, multisetPermutations } from "./kombinatorik";
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

const Multiset = z
  .strictObject({
    n: z.number().int().min(1).max(N_MAX),
    k1: z.number().int().min(1).max(N_MAX),
    k2: z.number().int().min(1).max(N_MAX),
    k3: z.number().int().min(0).max(N_MAX),
  })
  .refine((v) => v.k1 + v.k2 + v.k3 === v.n, {
    message: "Die Gruppengrößen müssen zusammen n ergeben",
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

  /** Permutationen mit Wiederholung: n! / (k1! · k2! · k3!) */
  "kombinatorik.permutation.multiset": defineCompute({
    input: Multiset,
    compute: ({ n, k1, k2, k3 }) =>
      Q.fromBigInt(multisetPermutations(big(n), [big(k1), big(k2), big(k3)])),
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
