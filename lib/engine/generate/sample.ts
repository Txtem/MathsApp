import { TemplateConfigError } from "../errors";
import type { ParamSpec, ParamValue } from "../types";
import type { Rng } from "./rng";

/**
 * Würfelt konkrete Werte aus den Wertebereichen eines Templates.
 *
 * Die Schlüssel werden sortiert abgearbeitet, nicht in Objektreihenfolge: Sonst
 * würde das Umsortieren von Zeilen in der YAML-Datei bei gleichem Seed andere
 * Aufgaben erzeugen, ohne dass sich die Template-Version ändert.
 */
export function sampleParams(
  spec: Readonly<Record<string, ParamSpec>>,
  rng: Rng,
): Record<string, ParamValue> {
  const params: Record<string, ParamValue> = {};

  for (const key of Object.keys(spec).sort()) {
    const entry = spec[key];
    if (!entry) continue;
    params[key] = sampleOne(key, entry, rng);
  }

  return params;
}

function sampleOne(key: string, spec: ParamSpec, rng: Rng): ParamValue {
  switch (spec.type) {
    case "int":
      if (!Number.isInteger(spec.min) || !Number.isInteger(spec.max)) {
        throw new TemplateConfigError(`Parameter "${key}": min und max müssen ganzzahlig sein.`);
      }
      if (spec.min > spec.max) {
        throw new TemplateConfigError(`Parameter "${key}": min ${spec.min} > max ${spec.max}.`);
      }
      return rng.int(spec.min, spec.max);

    case "float": {
      if (spec.min > spec.max) {
        throw new TemplateConfigError(`Parameter "${key}": min ${spec.min} > max ${spec.max}.`);
      }
      const decimals = spec.decimals ?? 2;
      if (!Number.isInteger(decimals) || decimals < 0) {
        throw new TemplateConfigError(`Parameter "${key}": decimals muss >= 0 und ganzzahlig sein.`);
      }
      const raw = spec.min + rng.next() * (spec.max - spec.min);
      return Number(raw.toFixed(decimals));
    }

    case "choice": {
      if (spec.values.length === 0) {
        throw new TemplateConfigError(`Parameter "${key}": choice ohne Werte.`);
      }
      return rng.pick(spec.values);
    }

    case "const":
      return spec.value;
  }
}
