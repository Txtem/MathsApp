import { isComputeRef, registry } from "./compute/registry";
import { TemplateUnsatisfiableError, UnknownComputeRefError } from "./errors";
import { checkConstraints, constraintVariables, RESULT_KEY } from "./generate/constraints";
import { makeRng } from "./generate/rng";
import { sampleParams } from "./generate/sample";
import { toStorageString } from "./expr/rational";
import { interpolate } from "./render/interpolate";
import { type Instance, type ParamValue, runCompute, type Template } from "./types";

/** Nach so vielen verworfenen Würfen gilt das Template als falsch konfiguriert. */
export const MAX_TRIES = 50;

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
  if (!isComputeRef(tpl.compute_ref)) {
    throw new UnknownComputeRefError(tpl.id, tpl.compute_ref);
  }
  const entry = registry[tpl.compute_ref];

  const beforeCompute = tpl.constraints.filter(
    (constraint) => !constraintVariables(constraint).has(RESULT_KEY),
  );

  const rng = makeRng(seed);

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const params = sampleParams(tpl.param_spec, rng);
    if (!checkConstraints(beforeCompute, params)) continue;

    const result = runCompute(entry, params);
    if (result === undefined) continue;

    if (!checkConstraints(tpl.constraints, { ...params, [RESULT_KEY]: result })) continue;

    return {
      templateId: tpl.id,
      templateVersion: tpl.version,
      seed,
      params,
      questionText: interpolate(tpl.question_text, params),
      expectedAnswer: toStorageString(result),
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
  return interpolate(tpl.solution_text, { ...params, [RESULT_KEY]: expectedAnswer });
}
