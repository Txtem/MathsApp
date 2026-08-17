import type { ZodType, output } from "zod";

/**
 * Ein Eintrag der Compute-Registry: ein Zod-Schema für die Parameter und eine
 * reine Funktion, die daraus das Ergebnis berechnet.
 *
 * Das Ergebnis ist bewusst ein `string`, kein `number`: Werte wie `21!` sind als
 * `number` still ungenau. Gerechnet wird mit `BigInt`, ausgegeben als Dezimalstring.
 */
export interface ComputeEntry<TSchema extends ZodType> {
  readonly input: TSchema;
  readonly compute: (params: output<TSchema>) => string;
}

/**
 * Obergrenze für die Registry als Ganzes. `never` als Parametertyp ist Absicht:
 * nur so ist jeder konkrete `ComputeEntry<S>` diesem Typ zuweisbar
 * (Funktionsparameter sind kontravariant). Zum Aufrufen wird ein Eintrag über
 * `registry[ref]` geholt, dort steht der genaue Typ noch zur Verfügung.
 */
export interface AnyComputeEntry {
  readonly input: ZodType;
  readonly compute: (params: never) => string;
}

/**
 * Hilfsfunktion, die das Schema an die `compute`-Signatur koppelt. Ohne sie
 * müsste jeder Eintrag seine Parameter von Hand annotieren.
 */
export function defineCompute<TSchema extends ZodType>(
  entry: ComputeEntry<TSchema>,
): ComputeEntry<TSchema> {
  return entry;
}
