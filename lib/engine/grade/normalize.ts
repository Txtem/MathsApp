import { ExpressionError } from "../errors";

/**
 * Schritt 1 der Bewertung: aus der Nutzereingabe einen Ausdruck machen, den der
 * Parser lesen kann. Hier wird nur geputzt, nicht gerechnet und nicht verglichen.
 */

/** Längenbremse: Alles darüber ist keine Antwort, sondern ein Angriff auf die Rechenzeit. */
export const MAX_INPUT_LENGTH = 200;

/** Unicode-Varianten, die Nutzer tatsächlich eintippen oder aus PDFs kopieren. */
const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\u2212\u2013\u2014\u2043]/g, "-"], // Minus, Halbgeviert-, Geviertstrich
  [/[\u00B7\u2219\u22C5\u00D7\u2715\u2716]/g, "*"], // Malpunkt, Kreuz
  [/[\u00F7\u2215\u2044]/g, "/"], // Divisionszeichen, Bruchstriche
  [/[\u2018\u2019\u02BC']/g, ""], // Schweizer Tausendertrennzeichen
  [/_/g, ""], // 1_000_000
  [/\s/g, ""], // inkl. geschütztem Leerzeichen
];

/** `1.000.000` und `1,000,000` → `1000000`. Greift nur bei vollständigen Dreiergruppen. */
const THOUSAND_GROUPS = /(?<![\d.,])\d{1,3}(?:([.,])\d{3})+(?![\d.,])/g;

/**
 * Normalisiert eine Eingabe für `answer_type: integer`.
 *
 * Das Komma bleibt hier Argumenttrenner, es wird *nicht* zum Dezimalpunkt:
 * `combinations(10,3)` ist eine gültige Antwort. SPEC Abschnitt 7 ordnet die
 * Regel `,` → `.` ausdrücklich `numeric` zu, nicht `integer`.
 *
 * `1,000` wird deshalb als Tausendertrennung gelesen (1000). Ein echtes
 * Dezimalkomma wie `2,5` ist für eine Ganzzahlantwort nicht lesbar — die UI
 * sagt dann "nicht verstanden" statt "falsch", was näher an der Wahrheit ist.
 */
export function normalizeInteger(input: string): string {
  if (input.length > MAX_INPUT_LENGTH) {
    throw new ExpressionError(`Eingabe länger als ${MAX_INPUT_LENGTH} Zeichen.`);
  }

  let text = input.trim();
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(THOUSAND_GROUPS, (match, separator: string) =>
    match.split(separator).join(""),
  );


  if (text === "") throw new ExpressionError("Leere Eingabe.");
  return text;
}
