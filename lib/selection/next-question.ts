import { instantiate } from "@/lib/engine/instantiate";
import type { Instance, Template } from "@/lib/engine/types";

import { selectTemplate, type SelectionInput } from "./next-template";

/**
 * Von der Auswahl zur fertigen Aufgabe: Template ziehen, instanziieren, und
 * dabei verhindern, dass in derselben Sitzung zweimal dieselbe Aufgabe kommt.
 *
 * Die Sperre sitzt auf der **Instanz**, nicht auf dem Template (D-24). Der Sinn
 * des Generators ist ja gerade, dass ein Template viele Aufgaben hervorbringt —
 * „5 Personen" und „8 Personen" sind nicht dieselbe Aufgabe. Nur die Ziehung
 * weiß nichts von den Parametern, weil die erst beim Instanziieren entstehen:
 * Deshalb wird geprüft, nachdem gewürfelt wurde, und bei einer Kollision neu
 * gezogen.
 *
 * Verglichen wird der `questionText`. Das ist kein Näherungswert: Prüfung 4 der
 * Content-Pipeline verlangt, dass jeder gewürfelte Parameter im Fragetext
 * vorkommt — gleicher Text heißt damit gleiche Parameter. Siehe D-25.
 *
 * Rein: Zufall und Seed kommen als Funktionen herein, wie schon bei
 * `selectTemplate`. Damit ist der ganze Weg ohne laufenden Server prüfbar.
 */

/**
 * So oft wird bei einer Kollision neu gezogen. Danach wird die Wiederholung
 * angenommen — derselbe Gedanke wie `MAX_TRIES` in `instantiate`: Laut
 * scheitern gibt es hier nicht, weil eine wiederholte Aufgabe besser ist als
 * keine. Bei `aufg_00004` ist das der Normalfall: Das Template hat nur
 * `const`-Parameter und damit genau eine Instanz.
 */
export const MAX_DRAWS = 5;

export interface QuestionInput extends SelectionInput {
  /** Fragetexte, die in dieser `PracticeSession` schon gestellt wurden. */
  readonly askedQuestionTexts?: readonly string[];
}

export interface QuestionDraw {
  readonly template: Template;
  readonly instance: Instance;
  /** Wie viele Würfe nötig waren. `1` heißt: gleich getroffen. */
  readonly draws: number;
  /** `true`, wenn nach `MAX_DRAWS` Würfen eine Wiederholung angenommen wurde. */
  readonly repeated: boolean;
}

export function drawQuestion(
  templates: readonly Template[],
  input: QuestionInput,
  random: () => number,
  nextSeed: () => string,
): QuestionDraw | undefined {
  const asked = new Set(input.askedQuestionTexts ?? []);
  let last: QuestionDraw | undefined;

  for (let draws = 1; draws <= MAX_DRAWS; draws++) {
    const template = selectTemplate(templates, input, random);
    if (template === undefined) return undefined;

    const instance = instantiate(template, nextSeed());
    last = { template, instance, draws, repeated: asked.has(instance.questionText) };
    if (!last.repeated) return last;
  }

  return last;
}
