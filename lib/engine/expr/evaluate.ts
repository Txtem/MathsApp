import { ExpressionError } from "../errors";
import { binomial, permutations } from "./bigmath";
import {
  absNum,
  addNum,
  asExactInteger,
  compareNum,
  divNum,
  factorialNum,
  intNum,
  mulNum,
  negNum,
  type Num,
  powNum,
  sqrtNum,
  subNum,
} from "./numeric";
import type { Comparison, Node } from "./parse";

/**
 * Auswertung eines Syntaxbaums. Der Scope wird explizit übergeben; für
 * Nutzereingaben ist er leer, dann ist jeder Bezeichner ein Fehler.
 *
 * Funktionen kommen ausschließlich aus dieser Whitelist. Es gibt keinen Weg,
 * aus einem Ausdruck heraus etwas anderes aufzurufen.
 */

type Scope = Readonly<Record<string, Num>>;

interface FunctionEntry {
  readonly arity: number;
  readonly apply: (args: readonly Num[]) => Num;
}

function integerArg(name: string, value: Num | undefined): bigint {
  if (!value) throw new ExpressionError(`${name}: fehlendes Argument.`);
  const asInteger = asExactInteger(value);
  if (asInteger === undefined) throw new ExpressionError(`${name} erwartet Ganzzahlen.`);
  return asInteger;
}

function unaryArg(name: string, args: readonly Num[]): Num {
  const value = args[0];
  if (!value) throw new ExpressionError(`${name}: fehlendes Argument.`);
  return value;
}

const FUNCTIONS: Readonly<Record<string, FunctionEntry>> = {
  factorial: { arity: 1, apply: (args) => factorialNum(unaryArg("factorial", args)) },
  abs: { arity: 1, apply: (args) => absNum(unaryArg("abs", args)) },
  sqrt: { arity: 1, apply: (args) => sqrtNum(unaryArg("sqrt", args)) },
  combinations: {
    arity: 2,
    apply: (args) =>
      intNum(binomial(integerArg("combinations", args[0]), integerArg("combinations", args[1]))),
  },
  permutations: {
    arity: 2,
    apply: (args) =>
      intNum(permutations(integerArg("permutations", args[0]), integerArg("permutations", args[1]))),
  },
};

export const ALLOWED_FUNCTIONS: readonly string[] = Object.keys(FUNCTIONS);

export function evaluate(node: Node, scope: Scope = {}): Num {
  switch (node.kind) {
    case "number":
      return node.value;

    case "variable": {
      const value = Object.prototype.hasOwnProperty.call(scope, node.name)
        ? scope[node.name]
        : undefined;
      if (!value) throw new ExpressionError(`Unbekannter Name "${node.name}".`);
      return value;
    }

    case "negate":
      return negNum(evaluate(node.operand, scope));

    case "factorial":
      return factorialNum(evaluate(node.operand, scope));

    case "binary": {
      const left = evaluate(node.left, scope);
      const right = evaluate(node.right, scope);
      switch (node.op) {
        case "+":
          return addNum(left, right);
        case "-":
          return subNum(left, right);
        case "*":
          return mulNum(left, right);
        case "/":
          return divNum(left, right);
        case "^":
          return powNum(left, right);
      }
    }

    case "call": {
      const entry = Object.prototype.hasOwnProperty.call(FUNCTIONS, node.name)
        ? FUNCTIONS[node.name]
        : undefined;
      if (!entry) throw new ExpressionError(`Funktion "${node.name}" ist nicht erlaubt.`);
      if (node.args.length !== entry.arity) {
        throw new ExpressionError(
          `${node.name} erwartet ${entry.arity} Argument(e), bekam ${node.args.length}.`,
        );
      }
      return entry.apply(node.args.map((arg) => evaluate(arg, scope)));
    }
  }
}

export function evaluateComparison(comparison: Comparison, scope: Scope = {}): boolean {
  const order = compareNum(evaluate(comparison.left, scope), evaluate(comparison.right, scope));
  switch (comparison.op) {
    case "<":
      return order < 0;
    case "<=":
      return order <= 0;
    case ">":
      return order > 0;
    case ">=":
      return order >= 0;
    case "==":
      return order === 0;
    case "!=":
      return order !== 0;
  }
}
