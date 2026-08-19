import { ExpressionError, TemplateConfigError } from "../errors";
import { evaluateComparison } from "../expr/evaluate";
import { exactNum, fromNumber, negNum, type Num } from "../expr/numeric";
import type { Rational } from "../expr/rational";
import { parseComparison, variablesOf } from "../expr/parse";
import { parseNumberLiteral } from "../expr/tokenize";
import type { ParamValue } from "../types";

/**
 * Constraint-Auswertung ohne `eval`: Ein Constraint ist genau ein Vergleich
 * `<expr> <op> <expr>` über Zahlen und die Namen aus dem Scope.
 *
 * Ein Constraint, das sich nicht lesen lässt oder einen unbekannten Namen
 * nennt, ist ein Template-Bug und wirft. Es darf nicht still als „nicht erfüllt"
 * durchgehen — sonst läuft der Generator stumm in `TemplateUnsatisfiableError`.
 */

export type ConstraintScope = Readonly<Record<string, ParamValue | Rational>>;

/** Name, unter dem das Rechenergebnis im Scope der zweiten Prüfung steht. */
export const RESULT_KEY = "result";

function toNum(name: string, value: ParamValue | Rational): Num {
  // Das Rechenergebnis kommt als exakter Bruch herein, nicht als Zahl.
  if (typeof value === "object") return exactNum(value);
  if (typeof value === "number") return fromNumber(value);
  if (typeof value === "string") {
    // Ergebnisse der Compute-Registry sind Dezimalstrings und dürfen negativ sein;
    // der Zahltokenizer kennt kein Vorzeichen, das ist Sache des Parsers.
    const text = value.trim();
    const negative = text.startsWith("-");
    const digits = negative || text.startsWith("+") ? text.slice(1) : text;
    try {
      const parsed = parseNumberLiteral(digits);
      return negative ? negNum(parsed) : parsed;
    } catch {
      throw new TemplateConfigError(`Constraint-Scope: "${name}" ist keine Zahl ("${value}").`);
    }
  }
  throw new TemplateConfigError(`Constraint-Scope: "${name}" ist ein Boolean und nicht vergleichbar.`);
}

function numericScope(scope: ConstraintScope, needed: ReadonlySet<string>): Record<string, Num> {
  const result: Record<string, Num> = {};
  for (const name of needed) {
    if (!Object.prototype.hasOwnProperty.call(scope, name)) {
      throw new TemplateConfigError(`Constraint nennt unbekannten Namen "${name}".`);
    }
    const value = scope[name];
    if (value === undefined) {
      throw new TemplateConfigError(`Constraint nennt unbekannten Namen "${name}".`);
    }
    result[name] = toNum(name, value);
  }
  return result;
}

/** Die im Constraint referenzierten Namen — z.B. um `result`-Constraints herauszufiltern. */
export function constraintVariables(constraint: string): ReadonlySet<string> {
  const parsed = parse(constraint);
  return new Set([...variablesOf(parsed.left), ...variablesOf(parsed.right)]);
}

function parse(constraint: string) {
  try {
    return parseComparison(constraint);
  } catch (error) {
    const detail = error instanceof ExpressionError ? error.message : String(error);
    throw new TemplateConfigError(`Constraint "${constraint}" ist nicht lesbar: ${detail}`);
  }
}

/** True, wenn *alle* Constraints im gegebenen Scope erfüllt sind. */
export function checkConstraints(
  constraints: readonly string[],
  scope: ConstraintScope,
): boolean {
  for (const constraint of constraints) {
    const comparison = parse(constraint);
    const needed = new Set([
      ...variablesOf(comparison.left),
      ...variablesOf(comparison.right),
    ]);
    const values = numericScope(scope, needed);

    let satisfied: boolean;
    try {
      satisfied = evaluateComparison(comparison, values);
    } catch (error) {
      const detail = error instanceof ExpressionError ? error.message : String(error);
      throw new TemplateConfigError(`Constraint "${constraint}" scheiterte: ${detail}`);
    }

    if (!satisfied) return false;
  }
  return true;
}
