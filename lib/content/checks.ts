import { isComputeRef, registry } from "@/lib/engine/compute/registry";
import { TemplateConfigError } from "@/lib/engine/errors";
import { constraintVariables, RESULT_KEY } from "@/lib/engine/generate/constraints";
import { makeRng } from "@/lib/engine/generate/rng";
import { sampleParams } from "@/lib/engine/generate/sample";
import { placeholders } from "@/lib/engine/render/interpolate";

import { parameterSpace } from "./parameter-space";
import { leafTopics, type Topics, type ValidatedTemplate } from "./schema";

/**
 * Die statischen Prüfungen aus SPEC.md, Abschnitt 5.
 *
 * Die meisten sind harte Fehler: Der Ladevorgang bricht ab,
 * `npm run content:check` schlägt fehl. Eine ist eine **Warnung** — ein zu
 * enger Parameterraum macht ein Template nicht ungültig, nur langweilig, und
 * soll den Build nicht anhalten.
 *
 * Die Prüfungen geben Befunde zurück, statt zu werfen — so sieht man beim
 * Aufräumen alle Probleme auf einmal statt eines nach dem anderen.
 */

export type CheckCode =
  | "unknown_compute_ref"
  | "unknown_question_placeholder"
  | "unknown_solution_placeholder"
  | "unused_param"
  | "compute_input_mismatch"
  | "duplicate_id"
  | "topic_not_leaf"
  | "round_to_without_numeric"
  | "unknown_constraint_name"
  | "invalid_constraint"
  | "small_parameter_space";

export type Severity = "error" | "warning";

export interface ContentIssue {
  readonly code: CheckCode;
  readonly severity: Severity;
  readonly templateId: string;
  readonly source: string;
  readonly message: string;
}

/**
 * Ab so vielen gültigen Parameterkombinationen gilt ein Template als tragfähig.
 *
 * Eine Sitzung umfasst zwanzig Aufgaben, und ein Template soll eine Sitzung
 * allein tragen können — daher zwanzig und nicht zehn. Die Zahl ist eine
 * **Untergrenze**, keine Zusage: Gezogen wird mit Zurücklegen, ein Template mit
 * genau zwanzig Kombinationen liefert in zwanzig Zügen also weniger als zwanzig
 * verschiedene Aufgaben.
 */
export const MIN_PARAMETER_SPACE = 20;

export interface LoadedTemplate {
  readonly template: ValidatedTemplate;
  /** Herkunft für die Fehlermeldung, üblicherweise der Dateipfad. */
  readonly source: string;
}

/** So viele Seeds werden probiert, um das Compute-Schema zu prüfen. */
const SCHEMA_PROBE_SEEDS = 20;

export function checkTemplate(entry: LoadedTemplate, topics: Topics): readonly ContentIssue[] {
  const { template, source } = entry;
  const issues: ContentIssue[] = [];
  const report = (code: CheckCode, message: string, severity: Severity = "error"): void => {
    issues.push({ code, severity, templateId: template.id, source, message });
  };

  const paramKeys = new Set(Object.keys(template.param_spec));
  const questionNames = placeholders(template.question_text);

  // 1. compute_ref existiert in der Registry.
  if (!isComputeRef(template.compute_ref)) {
    report("unknown_compute_ref", `compute_ref "${template.compute_ref}" steht nicht in der Registry.`);
  }

  // 2. Jeder Platzhalter im Aufgabentext ist ein Parameter.
  for (const name of questionNames) {
    if (!paramKeys.has(name)) {
      report("unknown_question_placeholder", `question_text nennt {{${name}}}, param_spec kennt es nicht.`);
    }
  }

  // 3. Im Lösungstext ist zusätzlich `result` erlaubt.
  if (template.solution_text !== undefined) {
    for (const name of placeholders(template.solution_text)) {
      if (!paramKeys.has(name) && name !== RESULT_KEY) {
        report("unknown_solution_placeholder", `solution_text nennt {{${name}}}, param_spec kennt es nicht.`);
      }
    }
  }

  // 4. Jeder gewürfelte Parameter wird im Aufgabentext verwendet. Ein
  //    ungenutzter Zufallsparameter ändert die Aufgabe unsichtbar.
  for (const [name, spec] of Object.entries(template.param_spec)) {
    if (spec.type !== "const" && !questionNames.has(name)) {
      report("unused_param", `Parameter "${name}" wird im question_text nicht verwendet.`);
    }
  }

  // 5. Das Input-Schema der Compute-Funktion akzeptiert genau diese Parameter.
  //    Die Registry-Schemata sind `strictObject`, deshalb fällt auch ein
  //    überzähliger Parameter auf, nicht nur ein fehlender.
  if (isComputeRef(template.compute_ref)) {
    const input = registry[template.compute_ref].input;
    for (let i = 0; i < SCHEMA_PROBE_SEEDS; i++) {
      const params = sampleParams(template.param_spec, makeRng(`check-${i}`));
      const parsed = input.safeParse(params);
      if (!parsed.success) {
        report(
          "compute_input_mismatch",
          `Das Input-Schema von "${template.compute_ref}" lehnt ${JSON.stringify(params)} ab: ${parsed.error.issues[0]?.message ?? "unbekannt"}.`,
        );
        break;
      }
    }
  }

  // 7. topic zeigt auf ein Blatt des Themenbaums.
  if (!leafTopics(topics).has(template.topic)) {
    report("topic_not_leaf", `topic "${template.topic}" ist kein Blatt aus content/topics.yaml.`);
  }

  // 8. round_to gibt es nur bei numeric.
  if (template.round_to !== undefined && template.answer_type !== "numeric") {
    report(
      "round_to_without_numeric",
      `round_to ist gesetzt, answer_type ist aber "${template.answer_type}".`,
    );
  }

  // 9. Constraints nennen nur Parameter und `result`.
  for (const constraint of template.constraints) {
    let names: ReadonlySet<string>;
    try {
      names = constraintVariables(constraint);
    } catch (error) {
      const detail = error instanceof TemplateConfigError ? error.message : String(error);
      report("invalid_constraint", detail);
      continue;
    }
    for (const name of names) {
      if (!paramKeys.has(name) && name !== RESULT_KEY) {
        report("unknown_constraint_name", `Constraint "${constraint}" nennt unbekannten Namen "${name}".`);
      }
    }
  }

  // 10. Der Parameterraum trägt eine Sitzung. Nur eine Warnung — und nur, wenn
  //     sonst nichts zu beanstanden war: Die Zählung braucht eine gültige
  //     `compute_ref` und lesbare Constraints, und ein Template mit Fehlern
  //     wird ohnehin nicht geladen.
  if (issues.length === 0) {
    const space = parameterSpace(template);
    if (space.size < MIN_PARAMETER_SPACE) {
      const wie = space.exact ? "" : " (geschätzt)";
      report(
        "small_parameter_space",
        `Nur ${space.size} gültige Parameterkombination(en)${wie}, empfohlen sind ${MIN_PARAMETER_SPACE}. Das Template liefert entsprechend wenige verschiedene Aufgaben.`,
        "warning",
      );
    }
  }

  return issues;
}

/** Prüft die Sammlung als Ganzes — dazu gehört Prüfung 6, die Eindeutigkeit der IDs. */
export function checkAll(
  entries: readonly LoadedTemplate[],
  topics: Topics,
): readonly ContentIssue[] {
  const issues: ContentIssue[] = entries.flatMap((entry) => [...checkTemplate(entry, topics)]);

  const seen = new Map<string, string>();
  for (const { template, source } of entries) {
    const first = seen.get(template.id);
    if (first !== undefined) {
      issues.push({
        code: "duplicate_id",
        severity: "error",
        templateId: template.id,
        source,
        message: `id "${template.id}" ist schon in ${first} vergeben.`,
      });
      continue;
    }
    seen.set(template.id, source);
  }

  return issues;
}

export function formatIssues(issues: readonly ContentIssue[]): string {
  return issues
    .map((issue) => `  [${issue.code}] ${issue.source} (${issue.templateId}): ${issue.message}`)
    .join("\n");
}

export function errorsOf(issues: readonly ContentIssue[]): readonly ContentIssue[] {
  return issues.filter((issue) => issue.severity === "error");
}

export function warningsOf(issues: readonly ContentIssue[]): readonly ContentIssue[] {
  return issues.filter((issue) => issue.severity === "warning");
}
