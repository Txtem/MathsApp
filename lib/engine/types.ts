import type { ZodType, output } from "zod";

import type { Rational } from "./expr/rational";

/**
 * Ein Eintrag der Compute-Registry: ein Zod-Schema für die Parameter und eine
 * reine Funktion, die daraus das Ergebnis berechnet.
 *
 * Das Ergebnis ist bewusst ein `string`, kein `number`: Werte wie `21!` sind als
 * `number` still ungenau. Gerechnet wird mit `BigInt`, ausgegeben als Dezimalstring.
 */
/**
 * Benannte Zwischenwerte für den Lösungsweg — schon als Text, nicht als Zahl:
 * `{ n: "11", nenner: "1!\cdot 4!\cdot 4!\cdot 2!" }`.
 *
 * Warum es sie gibt: Seit D-26 leiten manche Funktionen ihre Zerlegung selbst
 * ab, statt sie sich als Parameter geben zu lassen. Damit kannte `solution_text`
 * die Zwischengrößen nicht mehr und zeigte die Formel ohne Zahlen — beim Üben
 * als erstes aufgefallen. Eine Funktion, die etwas ableitet, muss es auch für
 * die Anzeige hergeben.
 */
export type DisplayValues = Readonly<Record<string, string>>;

/** Was ein Registry-Eintrag liefert: das Ergebnis und die Werte für die Anzeige. */
export interface ComputeOutput {
  readonly result: Rational;
  readonly display: DisplayValues;
}

export interface ComputeEntry<TSchema extends ZodType> {
  readonly input: TSchema;
  readonly compute: (params: output<TSchema>) => Rational;
  /**
   * Die Schlüssel, die `display` liefert — **statisch** deklariert, damit die
   * Content-Prüfung sie kennt, ohne die Funktion auszuführen. Leer, wenn der
   * Eintrag keine Anzeigewerte hat.
   *
   * Dass die Liste zur Funktion passt, sichert ein Test in `registry.test.ts`.
   */
  readonly displayKeys: readonly string[];
  /**
   * Validieren, rechnen und die Anzeigewerte bilden — in einem Schritt.
   * `undefined` heißt: Die Parameter passen nicht zum Schema; für `instantiate`
   * kein Fehler, sondern ein verworfener Wurf.
   *
   * Diese Methode ist der einzige Weg, einen Eintrag aus der Registry
   * aufzurufen. Die Registry ist heterogen, ihre Einträge haben also
   * verschiedene Parametertypen; nur eine einheitliche Signatur
   * `(params: unknown)` lässt sich auf der Vereinigung aufrufen, ohne den
   * Typ mit einem `as` zu erschlagen.
   */
  readonly run: (params: unknown) => ComputeOutput | undefined;
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
  readonly displayKeys: readonly string[];
  readonly run: (params: unknown) => ComputeOutput | undefined;
}

/**
 * Hilfsfunktion, die das Schema an die `compute`-Signatur koppelt und `run`
 * daraus ableitet. Ohne sie müsste jeder Eintrag seine Parameter von Hand
 * annotieren.
 *
 * `displayKeys` und `display` gehören zusammen: Wer das eine angibt, gibt auch
 * das andere an. Ein Eintrag ohne Anzeigewerte lässt beide weg.
 */
export function defineCompute<TSchema extends ZodType>(entry: {
  readonly input: TSchema;
  readonly compute: (params: output<TSchema>) => Rational;
  readonly displayKeys?: readonly string[];
  readonly display?: (params: output<TSchema>) => DisplayValues;
}): ComputeEntry<TSchema> {
  return {
    input: entry.input,
    compute: entry.compute,
    displayKeys: entry.displayKeys ?? [],
    run: (params) => {
      const parsed = entry.input.safeParse(params);
      if (!parsed.success) return undefined;
      return {
        result: entry.compute(parsed.data),
        display: entry.display?.(parsed.data) ?? {},
      };
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
