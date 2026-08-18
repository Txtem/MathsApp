import { TemplateConfigError } from "../errors";
import type { ParamValue } from "../types";

/**
 * Strikte Platzhalter-Ersetzung: `{n}` wird durch den Wert von `n` ersetzt.
 * Ein Platzhalter ohne passenden Wert ist ein Template-Bug und wirft — eine
 * Aufgabe mit sichtbarem `{n}` darf niemandem angezeigt werden.
 */

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Alle Platzhalternamen eines Texts — Basis der Template-Prüfungen beim Laden (M1). */
export function placeholders(text: string): ReadonlySet<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER)) {
    const name = match[1];
    if (name !== undefined) found.add(name);
  }
  return found;
}

export function interpolate(text: string, values: Readonly<Record<string, ParamValue>>): string {
  return text.replace(PLACEHOLDER, (_match, rawName: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, rawName)) {
      throw new TemplateConfigError(`Platzhalter "{${rawName}}" hat keinen Wert.`);
    }
    const value = values[rawName];
    if (value === undefined) {
      throw new TemplateConfigError(`Platzhalter "{${rawName}}" hat keinen Wert.`);
    }
    return String(value);
  });
}
