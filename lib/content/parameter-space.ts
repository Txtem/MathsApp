import { makeRng } from "@/lib/engine/generate/rng";
import { sampleParams } from "@/lib/engine/generate/sample";
import { makeDrawValidator } from "@/lib/engine/instantiate";
import type { ParamSpec, ParamValue, Template } from "@/lib/engine/types";

/**
 * Wie viele verschiedene Aufgaben kann ein Template überhaupt hervorbringen?
 *
 * Gezählt werden die **gültigen** Parameterkombinationen: das Produkt der
 * Wertebereiche, abzüglich dessen, was Constraints und das Eingabeschema der
 * Compute-Funktion verwerfen. Geprüft wird jede Kombination mit demselben
 * `makeDrawValidator`, den auch `instantiate` benutzt — sonst zählte diese
 * Datei etwas anderes, als der Generator später liefert.
 *
 * **Warum das die Zahl der verschiedenen Aufgaben ist:** Prüfung 4 des Loaders
 * verlangt, dass jeder nicht-`const`-Parameter im Fragetext vorkommt. Zwei
 * verschiedene Kombinationen unterscheiden sich also in mindestens einem Wert,
 * der im Text steht, und ergeben verschiedene Fragetexte. Dieselbe Invariante
 * trägt den Dedup-Schlüssel in D-25 — und fällt mit ihr: Sobald ein Template
 * einen Parameter zieht, der die Rechnung nicht berührt, misst diese Zahl
 * nicht mehr, was sie messen soll.
 */

/** Bis hierher wird exakt aufgezählt, darüber geschätzt. */
export const ENUMERATION_LIMIT = 500_000;

/** So viele Würfe gehen in eine Schätzung ein. */
export const ESTIMATION_SAMPLES = 20_000;

export interface ParameterSpace {
  /** Zahl der gültigen Kombinationen — bei `exact: false` deren Schätzung. */
  readonly size: number;
  /** Das Produkt der Wertebereiche, vor Constraints und Compute-Schema. */
  readonly raw: number;
  /** `false` heißt: über Stichproben geschätzt, nicht abgezählt. */
  readonly exact: boolean;
}

/**
 * Die Werte eines Parameters, sofern abzählbar. `undefined` bei `float`: Dort
 * liegen die Werte auf einem Raster aus Rundungen, und eine Aufzählung träfe
 * nicht zwingend dieselben Zahlen, die `sampleParams` würfelt.
 */
function valuesOf(spec: ParamSpec): readonly ParamValue[] | undefined {
  switch (spec.type) {
    case "const":
      return [spec.value];
    case "choice":
      return spec.values;
    case "int": {
      if (spec.min > spec.max) return [];
      const values: number[] = [];
      for (let value = spec.min; value <= spec.max; value++) values.push(value);
      return values;
    }
    case "float":
      return undefined;
  }
}

/** Größe des Rasters eines `float`-Parameters, für die Schätzung. */
function gridSize(spec: Extract<ParamSpec, { type: "float" }>): number {
  const decimals = spec.decimals ?? 2;
  return Math.max(1, Math.round((spec.max - spec.min) * 10 ** decimals) + 1);
}

function rawSize(spec: Readonly<Record<string, ParamSpec>>): number {
  let product = 1;
  for (const entry of Object.values(spec)) {
    const values = valuesOf(entry);
    product *= values === undefined ? gridSize(entry as Extract<ParamSpec, { type: "float" }>) : values.length;
  }
  return product;
}

export function parameterSpace(template: Template): ParameterSpace {
  const validate = makeDrawValidator(template);
  const keys = Object.keys(template.param_spec).sort();
  const columns = keys.map((key) => valuesOf(template.param_spec[key] as ParamSpec));
  const raw = rawSize(template.param_spec);

  const enumerable = columns.every((values) => values !== undefined);
  if (enumerable && raw <= ENUMERATION_LIMIT) {
    return { size: countValid(keys, columns as readonly (readonly ParamValue[])[], validate), raw, exact: true };
  }

  return { size: estimate(template, raw, validate), raw, exact: false };
}

/** Kartesisches Produkt, iterativ über einen Zählerstand — kein tiefer Stack. */
function countValid(
  keys: readonly string[],
  columns: readonly (readonly ParamValue[])[],
  validate: (params: Readonly<Record<string, ParamValue>>) => unknown,
): number {
  if (columns.some((values) => values.length === 0)) return 0;

  const index = new Array<number>(keys.length).fill(0);
  let valid = 0;

  for (;;) {
    const params: Record<string, ParamValue> = {};
    for (let i = 0; i < keys.length; i++) params[keys[i]] = columns[i][index[i]];
    if (validate(params) !== undefined) valid++;

    // Stellenweise weiterzählen, wie ein Kilometerzähler.
    let position = keys.length - 1;
    while (position >= 0) {
      index[position]++;
      if (index[position] < columns[position].length) break;
      index[position] = 0;
      position--;
    }
    if (position < 0) return valid;
  }
}

/**
 * Anteil gültiger Würfe aus einer Stichprobe, hochgerechnet auf den rohen Raum.
 * Der Zufall ist geseedet: dieselbe Zahl bei jedem Lauf.
 */
function estimate(
  template: Template,
  raw: number,
  validate: (params: Readonly<Record<string, ParamValue>>) => unknown,
): number {
  const rng = makeRng(`parameter-space-${template.id}`);
  let valid = 0;

  for (let i = 0; i < ESTIMATION_SAMPLES; i++) {
    if (validate(sampleParams(template.param_spec, rng)) !== undefined) valid++;
  }

  return Math.round((valid / ESTIMATION_SAMPLES) * raw);
}
