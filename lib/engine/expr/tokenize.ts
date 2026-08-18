import { ExpressionError } from "../errors";
import { floatNum, intNum, type Num } from "./numeric";

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
 * Zahlliteral → `Num`, exakt wo möglich. `2.5e3` ist 2500 und bleibt damit
 * ganzzahlig; `2.5` wird `float`.
 */
export function parseNumberLiteral(text: string): Num {
  const match = /^(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) throw new ExpressionError(`Ungültige Zahl: "${text}".`);

  const [, whole = "", fraction = "", exponentText] = match;
  const digits = `${whole}${fraction}`;
  if (digits === "") throw new ExpressionError(`Ungültige Zahl: "${text}".`);

  const exponent = BigInt(exponentText ?? "0") - BigInt(fraction.length);
  const mantissa = BigInt(digits);

  if (exponent >= 0n) {
    if (exponent > 4096n) throw new ExpressionError(`Zahl zu groß: "${text}".`);
    return intNum(mantissa * 10n ** exponent);
  }
  const divisor = 10n ** -exponent;
  if (mantissa % divisor === 0n) return intNum(mantissa / divisor);
  return floatNum(Number(text));
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
