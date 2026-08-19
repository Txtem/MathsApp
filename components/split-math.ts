/**
 * Zerlegt einen Aufgabentext in Fließtext und Mathematik.
 *
 * Konvention aus SPEC.md, Abschnitt 7a: `$…$` ist Inline-Mathematik, `$$…$$`
 * abgesetzte. Zerlegt wird **nach** der Interpolation — die Platzhalter sind
 * hier also längst ersetzt.
 *
 * Die Funktion ist absichtlich von der Komponente getrennt: So lässt sich die
 * Zerlegung ohne DOM und ohne KaTeX testen.
 */

export type Segment =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "math"; readonly value: string; readonly display: boolean };

/** `$$…$$` zuerst, sonst würde `$…$` die äußeren Dollarzeichen einzeln greifen. */
const DELIMITED = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;

export function splitMath(text: string): readonly Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  // Bewusst kein `String.split` mit Capture-Gruppe: Dabei landen Text- und
  // Trefferteile im selben Array, und ein Textstück, das zufällig mit `$`
  // beginnt und endet, sähe aus wie eine Formel.
  for (const match of text.matchAll(DELIMITED)) {
    const found = match[0];
    const start = match.index;
    if (start === undefined) continue;

    if (start > cursor) segments.push({ kind: "text", value: text.slice(cursor, start) });

    const display = found.startsWith("$$");
    segments.push({
      kind: "math",
      value: found.slice(display ? 2 : 1, display ? -2 : -1).trim(),
      display,
    });
    cursor = start + found.length;
  }

  if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
  return segments;
}
