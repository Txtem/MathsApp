import { ExpressionError } from "../errors";
import { exactNum, type Num } from "./numeric";
import { fromDecimalString } from "./rational";

/**
 * Tokenizer für die Ausdrucksgrammatik der Engine. Bewusst klein: Er kennt
 * Zahlen, Bezeichner, die Grundrechenarten, `^`, `!`, Klammern, Komma und die
 * sechs Vergleichsoperatoren. Mehr wird nicht gebraucht — und was er nicht
 * kennt, kann auch nicht ausgeführt werden. Das ersetzt `eval`.
 */

export type BinaryOp = "+" | "-" | "*" | "/" | "^";
export type CompareOp = "<" | "<=" | ">" | ">=" | "==" | "!=";

export type Token =
  | { readonly kind: "number"; readonly value: Num }
  | { readonly kind: "ident"; readonly name: string }
  | { readonly kind: "binary"; readonly op: BinaryOp }
  | { readonly kind: "compare"; readonly op: CompareOp }
  | { readonly kind: "bang" }
  | { readonly kind: "lparen" }
  | { readonly kind: "rparen" }
  | { readonly kind: "comma" };

const NUMBER = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|^\.\d+(?:[eE][+-]?\d+)?/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/;

/**
 * Zahlliteral → `Num`, verlustfrei. `2.5` wird der Bruch `5/2`, nicht 2.5 in
 * float64 — siehe DECISIONS.md, D-06.
 */
export function parseNumberLiteral(text: string): Num {
  return exactNum(fromDecimalString(text));
}

export function tokenize(input: string): readonly Token[] {
  const tokens: Token[] = [];
  let rest = input;

  while (rest.length > 0) {
    if (rest[0] === " ") {
      rest = rest.slice(1);
      continue;
    }

    const number = NUMBER.exec(rest);
    if (number) {
      tokens.push({ kind: "number", value: parseNumberLiteral(number[0]) });
      rest = rest.slice(number[0].length);
      continue;
    }

    const ident = IDENT.exec(rest);
    if (ident) {
      tokens.push({ kind: "ident", name: ident[0] });
      rest = rest.slice(ident[0].length);
      continue;
    }

    const two = rest.slice(0, 2);
    if (two === "<=" || two === ">=" || two === "==" || two === "!=") {
      tokens.push({ kind: "compare", op: two });
      rest = rest.slice(2);
      continue;
    }

    const one = rest[0];
    switch (one) {
      case "+":
      case "-":
      case "*":
      case "/":
      case "^":
        tokens.push({ kind: "binary", op: one });
        break;
      case "<":
      case ">":
        tokens.push({ kind: "compare", op: one });
        break;
      case "!":
        tokens.push({ kind: "bang" });
        break;
      case "(":
        tokens.push({ kind: "lparen" });
        break;
      case ")":
        tokens.push({ kind: "rparen" });
        break;
      case ",":
        tokens.push({ kind: "comma" });
        break;
      default:
        throw new ExpressionError(`Unerwartetes Zeichen "${one}" in "${input}".`);
    }
    rest = rest.slice(1);
  }

  return tokens;
}
