import type { Template } from "@/lib/engine/types";

/**
 * Zwei handgeschriebene Templates für M0.
 *
 * Sie stehen bewusst als TypeScript im Code und nicht als YAML: Der Loader mit
 * Zod-Validierung kommt in M1 (`lib/content/schema.ts` + `load.ts`), und bis
 * dahin soll die Practice-Schleife trotzdem Ende zu Ende laufen können.
 *
 * Die Struktur ist schon die endgültige — dieselben Felder, dieselben Regeln wie
 * im YAML-Format aus SPEC.md Abschnitt 5. Beim Umzug nach `content/templates/`
 * ändert sich nur die Herkunft der Daten, nicht ihre Form.
 */

/** Addition zweier zweistelliger Zahlen. */
export const additionTemplate = {
  id: "aufg_00001",
  version: 1,
  topic: "arithmetik.addition",
  difficulty: 1,
  target_time_seconds: 30,
  compute_ref: "arithmetik.add",
  answer_type: "integer",
  param_spec: {
    a: { type: "int", min: 12, max: 89 },
    b: { type: "int", min: 12, max: 89 },
  },
  // Deckelt die Aufgabe auf Kopfrechenniveau. Wirft rund die Hälfte der
  // Parameterpaare weg — genau der Rejection-Sampling-Fall, für den es MAX_TRIES gibt.
  constraints: ["result <= 100"],
  question_text: "Berechne: {{a}} + {{b}}",
  solution_text: "{{a}} + {{b}} = {{result}}",
  tags: ["addition", "kopfrechnen"],
} satisfies Template;

/** Subtraktion ohne negatives Ergebnis. */
export const subtractionTemplate = {
  id: "aufg_00002",
  version: 1,
  topic: "arithmetik.subtraktion",
  difficulty: 1,
  target_time_seconds: 30,
  compute_ref: "arithmetik.subtract",
  answer_type: "integer",
  param_spec: {
    a: { type: "int", min: 20, max: 99 },
    b: { type: "int", min: 3, max: 89 },
  },
  // Erst nach der Berechnung entscheidbar: Das ist der zweite Constraint-Durchgang.
  constraints: ["result >= 0"],
  question_text: "Berechne: {{a}} - {{b}}",
  solution_text: "{{a}} - {{b}} = {{result}}",
  tags: ["subtraktion", "kopfrechnen"],
} satisfies Template;

export const devTemplates: readonly Template[] = [additionTemplate, subtractionTemplate];

export function getDevTemplate(id: string): Template | undefined {
  return devTemplates.find((template) => template.id === id);
}
