import type { ZodType, output } from "zod";

import type { Rational } from "./expr/rational";

/**
 * Ein Eintrag der Compute-Registry: ein Zod-Schema für die Parameter und eine
 * reine Funktion, die daraus das Ergebnis berechnet.
 *
 * Das Ergebnis ist bewusst ein `string`, kein `number`: Werte wie `21!` sind als
 * `number` still ungenau. Gerechnet wird mit `BigInt`, ausgegeben als Dezimalstring.
 */
export interface ComputeEntry<TSchema extends ZodType> {
  readonly input: TSchema;
  readonly compute: (params: output<TSchema>) => Rational;
  /**
   * Validieren und rechnen in einem Schritt. `undefined` heißt: Die Parameter
   * passen nicht zum Schema — für `instantiate` kein Fehler, sondern ein
   * verworfener Wurf.
   *
   * Diese Methode ist der einzige Weg, einen Eintrag aus der Registry
   * aufzurufen. Die Registry ist heterogen, ihre Einträge haben also
   * verschiedene Parametertypen; nur eine einheitliche Signatur
   * `(params: unknown)` lässt sich auf der Vereinigung aufrufen, ohne den
   * Typ mit einem `as` zu erschlagen.
   */
  readonly run: (params: unknown) => Rational | undefined;
}

/**
 * Obergrenze für die Registry als Ganzes. `never` als Parametertyp von
 * `compute` ist Absicht: nur so ist jeder konkrete `ComputeEntry<S>` diesem
 * Typ zuweisbar (Funktionsparameter sind kontravariant). Gerechnet wird über
 * `run`, nicht über `compute`.
 */
export interface AnyComputeEntry {
  readonly input: ZodType;
  readonly compute: (params: never) => Rational;
  readonly run: (params: unknown) => Rational | undefined;
}

/**
 * Hilfsfunktion, die das Schema an die `compute`-Signatur koppelt und `run`
 * daraus ableitet. Ohne sie müsste jeder Eintrag seine Parameter von Hand
 * annotieren.
 */
export function defineCompute<TSchema extends ZodType>(entry: {
  readonly input: TSchema;
  readonly compute: (params: output<TSchema>) => Rational;
}): ComputeEntry<TSchema> {
  return {
    input: entry.input,
    compute: entry.compute,
    run: (params) => {
      const parsed = entry.input.safeParse(params);
      return parsed.success ? entry.compute(parsed.data) : undefined;
    },
  };
}

/** Konkreter Wert eines Parameters, wie er in `Attempt.params` persistiert wird. */
export type ParamValue = number | string | boolean;

/**
 * Wertebereich eines Parameters. Templates beschreiben Bereiche, keine Werte —
 * die konkreten Werte entstehen erst beim Instanziieren mit einem Seed.
 *
 * Spiegelt das Zod-Schema aus SPEC.md Abschnitt 5. Die Laufzeitvalidierung des
 * YAML-Contents kommt in M1 (`lib/content/schema.ts`); die Engine arbeitet auf
 * dem bereits validierten Typ.
 */
export type ParamSpec =
  | { readonly type: "int"; readonly min: number; readonly max: number }
  | { readonly type: "float"; readonly min: number; readonly max: number; readonly decimals?: number }
  | { readonly type: "choice"; readonly values: readonly ParamValue[] }
  | { readonly type: "const"; readonly value: ParamValue };

export type AnswerType =
  | "numeric"
  | "integer"
  | "fraction"
  | "set"
  | "tuple"
  | "text"
  | "choice";

/** Ein Aufgaben-Template. Feldnamen bewusst wie im YAML (snake_case). */
export interface Template {
  readonly id: string;
  readonly version: number;
  readonly topic: string;
  readonly difficulty: number;
  readonly target_time_seconds: number;
  readonly compute_ref: string;
  readonly answer_type: AnswerType;
  readonly param_spec: Readonly<Record<string, ParamSpec>>;
  readonly constraints: readonly string[];
  readonly question_text: string;
  readonly solution_text?: string;
  readonly tags?: readonly string[];
}

/**
 * Eine konkrete Aufgabe. `expectedAnswer` ist serverseitig — es verlässt den
 * Server erst, wenn der Attempt nicht mehr `OPEN` ist.
 */
export interface Instance {
  readonly templateId: string;
  readonly templateVersion: number;
  readonly seed: string;
  readonly params: Readonly<Record<string, ParamValue>>;
  readonly questionText: string;
  readonly expectedAnswer: string;
  readonly answerType: AnswerType;
}

/**
 * Ergebnis der Bewertung. `ok: false` heißt „nicht lesbar" und ist ausdrücklich
 * etwas anderes als „falsch": Die UI soll darauf anders reagieren.
 */
export type GradeResult =
  | { readonly ok: true; readonly isCorrect: boolean; readonly normalized: string }
  | { readonly ok: false; readonly reason: "unparseable" };
