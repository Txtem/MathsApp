import { ExpressionError } from "../errors";

/**
 * Schritt 1 der Bewertung: aus der Nutzereingabe einen Ausdruck machen, den der
 * Parser lesen kann. Hier wird nur geputzt, nicht gerechnet und nicht verglichen.
 */

/** Längenbremse: Alles darüber ist keine Antwort, sondern ein Angriff auf die Rechenzeit. */
export const MAX_INPUT_LENGTH = 200;

/** Unicode-Varianten, die Nutzer tatsächlich eintippen oder aus PDFs kopieren. */
const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[−–—⁃]/g, "-"], // Minus, Halbgeviert-, Geviertstrich
  [/[·∙⋅×✕✖]/g, "*"], // Malpunkt, Kreuz
  [/[÷∕⁄]/g, "/"], // Divisionszeichen, Bruchstriche
  [/[‘’ʼ']/g, ""], // Schweizer Tausendertrennzeichen
  [/_/g, ""], // 1_000_000
  [/\s/g, ""], // inkl. geschütztem Leerzeichen
];

/** `1.000.000` und `1,000,000` → `1000000`. Greift nur bei vollständigen Dreiergruppen. */
const THOUSAND_GROUPS = /(?<![\d.,])\d{1,3}(?:([.,])\d{3})+(?![\d.,])/g;

function clean(input: string): string {
  if (input.length > MAX_INPUT_LENGTH) {
    throw new ExpressionError(`Eingabe länger als ${MAX_INPUT_LENGTH} Zeichen.`);
  }
  let text = input.trim();
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  if (text === "") throw new ExpressionError("Leere Eingabe.");
  return text;
}

/**
 * Normalisiert eine Eingabe für `answer_type: integer`.
 *
 * Das Komma bleibt hier Argumenttrenner, es wird *nicht* zum Dezimalpunkt:
 * `combinations(10,3)` ist eine gültige Antwort. Siehe DECISIONS.md, D-03.
 *
 * `1,000` wird deshalb als Tausendertrennung gelesen (1000). Ein echtes
 * Dezimalkomma wie `2,5` ist für eine Ganzzahlantwort nicht lesbar — die UI
 * sagt dann "nicht verstanden" statt "falsch", was näher an der Wahrheit ist.
 */
export function normalizeInteger(input: string): string {
  const text = clean(input);
  return text.replace(THOUSAND_GROUPS, (match, separator: string) =>
    match.split(separator).join(""),
  );
}

/**
 * Normalisiert eine Eingabe für `numeric` und `fraction`.
 *
 * Das Komma ist hier doppeldeutig: In `0,25` ist es der Dezimaltrenner, in
 * `combinations(10,3)` der Argumenttrenner. Entschieden wird an einem
 * Merkmal, das der Nutzer selbst setzt — ob die Eingabe einen Funktionsnamen
 * enthält:
 *
 * - **Mit Buchstaben** (`combinations(49,6)/2`): Kommas trennen Argumente,
 *   Punkte sind Dezimalpunkte. Es wird nichts umgeschrieben.
 * - **Ohne Buchstaben** (`1.000,25`): reine Zahl. Kommt ein Trennzeichen
 *   mehrfach vor, ist es die Tausendertrennung; kommen beide je einmal vor,
 *   ist das hintere der Dezimaltrenner; sonst ist das einzige der Dezimaltrenner.
 *
 * Damit sind `0,25`, `0.25`, `1.000,25` und `1,000.25` alle lesbar, ohne dass
 * `combinations(10,3)` kaputtgeht.
 */
export function normalizeNumeric(input: string): string {
  const text = clean(input);
  if (/[A-Za-z]/.test(text)) return text;
  return text.replace(/[\d.,]+/g, normalizeNumberRun);
}

/** Ist die Gruppierung eine echte Tausendertrennung (`1.000.000`)? */
function isGrouped(run: string, separator: string): boolean {
  const escaped = separator === "." ? "\\." : ",";
  return new RegExp(`^\\d{1,3}(?:${escaped}\\d{3})+$`).test(run);
}

/**
 * Eine einzelne Zahl im Ausdruck. Getrennt behandelt, weil `0.5-0.125` zwei
 * Zahlen mit je einem Dezimalpunkt sind — und nicht eine Zahl mit zwei
 * Tausenderpunkten.
 */
function normalizeNumberRun(run: string): string {
  const dots = (run.match(/\./g) ?? []).length;
  const commas = (run.match(/,/g) ?? []).length;
  if (dots === 0 && commas === 0) return run;

  if (dots > 0 && commas > 0) {
    // Das hintere Trennzeichen ist der Dezimaltrenner, das vordere gruppiert.
    const decimalIsDot = run.lastIndexOf(".") > run.lastIndexOf(",");
    const thousands = decimalIsDot ? "," : ".";
    const [head = "", tail = ""] = run.split(decimalIsDot ? "." : ",");
    if (!isGrouped(head, thousands)) return run;
    return `${head.split(thousands).join("")}.${tail}`;
  }

  const separator = dots > 0 ? "." : ",";
  if (dots + commas === 1) return run.replace(",", ".");

  // Mehrfach derselbe Trenner ergibt nur als Tausendertrennung Sinn. Passt die
  // Gruppierung nicht, bleibt die Zahl stehen und scheitert am Parser — das ist
  // ehrlicher, als eine Bedeutung zu erfinden.
  return isGrouped(run, separator) ? run.split(separator).join("") : run;
}

/** `choice` wird nicht gerechnet, nur verglichen: Rand weg, Groß-/Kleinschreibung egal. */
export function normalizeChoice(input: string): string {
  if (input.length > MAX_INPUT_LENGTH) {
    throw new ExpressionError(`Eingabe länger als ${MAX_INPUT_LENGTH} Zeichen.`);
  }
  const text = input.trim().toLocaleLowerCase("de-DE");
  if (text === "") throw new ExpressionError("Leere Eingabe.");
  return text;
}
