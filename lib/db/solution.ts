import { ParamsSchema } from "@/lib/api/contracts";
import type { ValidatedTemplate } from "@/lib/content/schema";
import { toDecimalString } from "@/lib/engine/expr/rational";
import { toExpectedRational } from "@/lib/engine/grade";
import { renderSolution } from "@/lib/engine/instantiate";

/**
 * Was zu einem **geschlossenen** Attempt an Lösung herausgegeben wird —
 * gemeinsam für Beantworten und Aufgeben. Wer diese Funktionen aufruft, muss
 * vorher den Attempt geschlossen haben (Invariante 2).
 */

/**
 * Das Template, das zum Attempt passt — oder `undefined`, wenn es fehlt oder
 * seither eine andere Version hat. Dann wird exakt bewertet, und es gibt weder
 * Lösungsweg noch Tipps: Ein Text zu einer anderen Version wäre schlechter als
 * gar keiner.
 */
export function currentTemplate(
  findTemplate: (id: string) => ValidatedTemplate | undefined,
  attempt: { readonly templateId: string; readonly templateVersion: number },
): ValidatedTemplate | undefined {
  const template = findTemplate(attempt.templateId);
  return template?.version === attempt.templateVersion ? template : undefined;
}

/**
 * Bei `round_to` zusätzlich die gerundete Dezimalzahl — das, wonach die Aufgabe
 * gefragt hat. Der exakte Wert bleibt daneben stehen; beide zusammen sind die
 * Antwort auf die Beobachtung, dass die Lösung einen Bruch zeigte, während der
 * Aufgabentext eine gerundete Dezimalzahl verlangte.
 *
 * Gerundet wird hier und nicht im Browser, damit es dieselbe Funktion tut, die
 * auch die Bewertung rundet — zwei Rundungen könnten auseinanderlaufen.
 */
export function roundedForm(
  template: ValidatedTemplate | undefined,
  expectedAnswer: string,
): { expectedRounded?: string } {
  if (template?.round_to === undefined) return {};
  return { expectedRounded: toDecimalString(toExpectedRational(expectedAnswer), template.round_to) };
}

/**
 * Der Lösungstext wird aus den persistierten Parametern neu gerendert. Wurde das
 * Template seit dem Stellen der Aufgabe geändert, bleibt er weg.
 */
export function buildSolution(
  template: ValidatedTemplate | undefined,
  params: unknown,
  expectedAnswer: string,
): { solutionText?: string } {
  if (!template) return {};

  const parsedParams = ParamsSchema.safeParse(params);
  if (!parsedParams.success) return {};

  const solutionText = renderSolution(template, parsedParams.data, expectedAnswer);
  return solutionText === undefined ? {} : { solutionText };
}
