import { TemplateRenderError } from "../errors";
import type { ParamValue } from "../types";

/**
 * Strikte Platzhalter-Ersetzung: `{{n}}` wird durch den Wert von `n` ersetzt.
 *
 * Doppelte Klammern, weil Aufgabentexte ab M1 LaTeX enthalten und LaTeX einfache
 * geschweifte Klammern als Argumentklammern benutzt (`\frac{1}{2}`). Einfache
 * Klammern werden hier deshalb nie angefasst — siehe DECISIONS.md, D-05.
 *
 * Ein Platzhalter ohne Wert ist ein Template-Bug und wirft. Eine Aufgabe mit
 * sichtbarem `{{n}}` darf niemandem angezeigt werden.
 */

const PLACEHOLDER = /\{\{([a-z][a-z0-9_]*)\}\}/g;

/** Alle Platzhalternamen eines Texts — Basis der statischen Template-Prüfungen. */
export function placeholders(text: string): ReadonlySet<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER)) {
    const name = match[1];
    if (name !== undefined) found.add(name);
  }
  return found;
}

export function interpolate(text: string, values: Readonly<Record<string, ParamValue>>): string {
  const rendered = text.replace(PLACEHOLDER, (_match, rawName: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, rawName)) {
      throw new TemplateRenderError(`Platzhalter "{{${rawName}}}" hat keinen Wert.`);
    }
    const value = values[rawName];
    if (value === undefined) {
      throw new TemplateRenderError(`Platzhalter "{{${rawName}}}" hat keinen Wert.`);
    }
    return String(value);
  });

  // Assertion, kein Vorschlag: Was hier noch `{{` enthält, ist ein Platzhalter,
  // den der Regex nicht erkannt hat — etwa `{{ n }}` oder `{{N}}`.
  if (rendered.includes("{{")) {
    throw new TemplateRenderError(
      `Nach der Interpolation blieb "{{" stehen — vermutlich ein Platzhalter mit ungültigem Namen: ${rendered}`,
    );
  }

  return rendered;
}
