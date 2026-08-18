import { ExpressionError } from "../errors";
import type { Num } from "./numeric";
import { type BinaryOp, type CompareOp, type Token, tokenize } from "./tokenize";

/**
 * Rekursiver Abstiegsparser. Erzeugt einen Syntaxbaum aus einer festen Grammatik:
 *
 *   comparison := expr (compareOp expr)?
 *   expr       := term (('+' | '-') term)*
 *   term       := unary (('*' | '/') unary)*
 *   unary      := ('+' | '-') unary | power
 *   power      := postfix ('^' unary)?        // rechtsassoziativ
 *   postfix    := primary '!'*
 *   primary    := number | ident '(' args ')' | ident | '(' expr ')'
 *
 * Der Baum enthält keine ausführbaren Referenzen — nur Daten. Was der Evaluator
 * mit einem `call` macht, entscheidet dort eine Whitelist.
 */

export type Node =
  | { readonly kind: "number"; readonly value: Num }
  | { readonly kind: "variable"; readonly name: string }
  | { readonly kind: "negate"; readonly operand: Node }
  | { readonly kind: "factorial"; readonly operand: Node }
  | { readonly kind: "binary"; readonly op: BinaryOp; readonly left: Node; readonly right: Node }
  | { readonly kind: "call"; readonly name: string; readonly args: readonly Node[] };

export interface Comparison {
  readonly left: Node;
  readonly op: CompareOp;
  readonly right: Node;
}

class Parser {
  private position = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly source: string,
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private take(): Token {
    const token = this.tokens[this.position];
    if (!token) throw new ExpressionError(`Ausdruck endet unerwartet: "${this.source}".`);
    this.position += 1;
    return token;
  }

  atEnd(): boolean {
    return this.position >= this.tokens.length;
  }

  expectEnd(): void {
    if (!this.atEnd()) throw new ExpressionError(`Unerwarteter Rest in "${this.source}".`);
  }

  comparison(): Comparison {
    const left = this.expr();
    const token = this.peek();
    if (!token || token.kind !== "compare") {
      throw new ExpressionError(`Constraint ohne Vergleichsoperator: "${this.source}".`);
    }
    this.position += 1;
    const right = this.expr();
    return { left, op: token.op, right };
  }

  expr(): Node {
    let left = this.term();
    for (;;) {
      const token = this.peek();
      if (!token || token.kind !== "binary" || (token.op !== "+" && token.op !== "-")) return left;
      this.position += 1;
      left = { kind: "binary", op: token.op, left, right: this.term() };
    }
  }

  private term(): Node {
    let left = this.unary();
    for (;;) {
      const token = this.peek();
      if (!token || token.kind !== "binary" || (token.op !== "*" && token.op !== "/")) return left;
      this.position += 1;
      left = { kind: "binary", op: token.op, left, right: this.unary() };
    }
  }

  private unary(): Node {
    const token = this.peek();
    if (token && token.kind === "binary" && (token.op === "-" || token.op === "+")) {
      this.position += 1;
      const operand = this.unary();
      return token.op === "-" ? { kind: "negate", operand } : operand;
    }
    return this.power();
  }

  private power(): Node {
    const base = this.postfix();
    const token = this.peek();
    if (token && token.kind === "binary" && token.op === "^") {
      this.position += 1;
      return { kind: "binary", op: "^", left: base, right: this.unary() };
    }
    return base;
  }

  private postfix(): Node {
    let node = this.primary();
    for (;;) {
      const token = this.peek();
      if (!token || token.kind !== "bang") return node;
      this.position += 1;
      node = { kind: "factorial", operand: node };
    }
  }

  private primary(): Node {
    const token = this.take();

    if (token.kind === "number") return { kind: "number", value: token.value };

    if (token.kind === "ident") {
      if (this.peek()?.kind !== "lparen") return { kind: "variable", name: token.name };
      this.position += 1;
      const args: Node[] = [];
      if (this.peek()?.kind === "rparen") {
        this.position += 1;
        return { kind: "call", name: token.name, args };
      }
      for (;;) {
        args.push(this.expr());
        const next = this.take();
        if (next.kind === "rparen") return { kind: "call", name: token.name, args };
        if (next.kind !== "comma") {
          throw new ExpressionError(`Erwartet "," oder ")" in "${this.source}".`);
        }
      }
    }

    if (token.kind === "lparen") {
      const inner = this.expr();
      if (this.take().kind !== "rparen") {
        throw new ExpressionError(`Fehlende schließende Klammer in "${this.source}".`);
      }
      return inner;
    }

    throw new ExpressionError(`Unerwartetes Token in "${this.source}".`);
  }
}

export function parseExpression(input: string): Node {
  const parser = new Parser(tokenize(input), input);
  if (parser.atEnd()) throw new ExpressionError("Leerer Ausdruck.");
  const node = parser.expr();
  parser.expectEnd();
  return node;
}

export function parseComparison(input: string): Comparison {
  const parser = new Parser(tokenize(input), input);
  if (parser.atEnd()) throw new ExpressionError("Leeres Constraint.");
  const comparison = parser.comparison();
  parser.expectEnd();
  return comparison;
}

/** Alle im Baum referenzierten Variablennamen — für die Template-Prüfung. */
export function variablesOf(node: Node): ReadonlySet<string> {
  const found = new Set<string>();
  const walk = (current: Node): void => {
    switch (current.kind) {
      case "variable":
        found.add(current.name);
        return;
      case "number":
        return;
      case "negate":
      case "factorial":
        walk(current.operand);
        return;
      case "binary":
        walk(current.left);
        walk(current.right);
        return;
      case "call":
        for (const arg of current.args) walk(arg);
        return;
    }
  };
  walk(node);
  return found;
}
