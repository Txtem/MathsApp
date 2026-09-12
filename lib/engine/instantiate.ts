import { isComputeRef, registry } from "./compute/registry";
import { TemplateUnsatisfiableError, UnknownComputeRefError } from "./errors";
import { checkConstraints, constraintVariables, RESULT_KEY } from "./generate/constraints";
import { makeRng } from "./generate/rng";
import { sampleParams } from "./generate/sample";
import { toStorageString } from "./expr/rational";
import { interpolate } from "./render/interpolate";
import type { ComputeOutput, Instance, ParamValue, Template } from "./types";

/** Nach so vielen verworfenen Würfen gilt das Template als falsch konfiguriert. */
export const MAX_TRIES = 50;

/**
 * Prüft einen einzelnen Wurf und rechnet ihn — `undefined` heißt: verworfen.
 *
 * Als Fabrik, nicht als einfache Funktion: Die Aufteilung der Constraints in
 * „vor" und „nach der Berechnung" parst jeden Constraint einmal und passiert
 * deshalb hier oben, nicht bei jedem Wurf.
 *
 * `instantiate` benutzt sie, und `lib/content/parameter-space.ts` zählt damit
 * ab, wie viele gültige Kombinationen ein Template überhaupt hat. Beide sehen
 * dieselben Würfe als gültig an, weil es dieselbe Funktion ist — eine zweite
 * Nachbildung der Regeln würde früher oder später abweichen.
 */
export function makeDrawValidator(
  tpl: Template,
): (params: Readonly<Record<string, ParamValue>>) => ComputeOutput | undefined {
  if (!isComputeRef(tpl.compute_ref)) {
    throw new UnknownComputeRefError(tpl.id, tpl.compute_ref);
  }
  const entry = registry[tpl.compute_ref];

  // Constraints, die `result` nennen, sind vor der Berechnung nicht
  // entscheidbar und werden im ersten Durchgang übersprungen.
  const beforeCompute = tpl.constraints.filter(
    (constraint) => !constraintVariables(constraint).has(RESULT_KEY),
  );

  return (params) => {
    if (!checkConstraints(beforeCompute, params)) return undefined;

    const computed = entry.run(params);
    if (computed === undefined) return undefined;

    if (!checkConstraints(tpl.constraints, { ...params, [RESULT_KEY]: computed.result })) {
      return undefined;
    }

    return computed;
  };
}

/**
 * Template + Seed → konkrete Aufgabe. Rejection Sampling gegen die Constraints.
 *
 * Die Constraints werden zweimal geprüft: einmal auf den gewürfelten Parametern,
 * danach noch einmal inklusive `result`. Constraints, die `result` nennen, sind
 * im ersten Durchgang naturgemäß nicht entscheidbar und werden dort übersprungen.
 *
 * Rein: kein I/O, kein Zugriff auf Uhr oder `Math.random`. Gleicher Seed und
 * gleiche Template-Version liefern dieselbe Instanz — auf jeder Maschine.
 */
export function instantiate(tpl: Template, seed: string): Instance {
  const validate = makeDrawValidator(tpl);
  const rng = makeRng(seed);

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const params = sampleParams(tpl.param_spec, rng);
    const computed = validate(params);
    if (computed === undefined) continue;

    return {
      templateId: tpl.id,
      templateVersion: tpl.version,
      seed,
      params,
      questionText: interpolate(tpl.question_text, params),
      expectedAnswer: toStorageString(computed.result),
      answerType: tpl.answer_type,
    };
  }

  throw new TemplateUnsatisfiableError(tpl.id, MAX_TRIES);
}

/**
 * Der Lösungstext, gerendert. Bewusst nicht Teil von `Instance`: Er darf erst
 * an den Client, wenn der Attempt beantwortet ist, und wird dort aus den
 * persistierten Parametern neu erzeugt.
 */
export function renderSolution(
  tpl: Template,
  params: Readonly<Record<string, ParamValue>>,
  expectedAnswer: string,
): string | undefined {
  if (tpl.solution_text === undefined) return undefined;

  // Die Anzeigewerte werden aus den persistierten Parametern neu gebildet, nicht
  // mitgespeichert: Sie sind eine reine Funktion der Parameter, und ein Feld
  // mehr am `Attempt` wäre eine Datenmodelländerung für etwas Ableitbares.
  const display = isComputeRef(tpl.compute_ref)
    ? (registry[tpl.compute_ref].run(params)?.display ?? {})
    : {};

  // Parameter gewinnen bei Namensgleichheit. Vorkommen darf sie ohnehin nicht —
  // ein `displayKey`, der wie ein Parameter heißt, ist ein harter Ladefehler.
  return interpolate(tpl.solution_text, {
    ...display,
    ...params,
    [RESULT_KEY]: expectedAnswer,
  });
}
