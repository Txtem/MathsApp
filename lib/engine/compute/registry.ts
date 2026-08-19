import { z } from "zod";

import { fromBigInt } from "../expr/rational";
import { type AnyComputeEntry, defineCompute } from "../types";
import { add, subtract } from "./arithmetik";

/**
 * Whitelist: `compute_ref` aus einem Template ist ein Schlüssel dieser Registry,
 * nie ein Codepfad. Kein `eval`, kein dynamischer Import.
 */

const Operands = z.object({
  a: z.number().int(),
  b: z.number().int(),
});

export const registry = {
  "arithmetik.add": defineCompute({
    input: Operands,
    compute: ({ a, b }) => fromBigInt(add(BigInt(a), BigInt(b))),
  }),

  "arithmetik.subtract": defineCompute({
    input: Operands,
    compute: ({ a, b }) => fromBigInt(subtract(BigInt(a), BigInt(b))),
  }),
} as const satisfies Record<string, AnyComputeEntry>;

/** Alle gültigen `compute_ref`-Werte. */
export type ComputeRef = keyof typeof registry;

export function isComputeRef(ref: string): ref is ComputeRef {
  return Object.prototype.hasOwnProperty.call(registry, ref);
}
