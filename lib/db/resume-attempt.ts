import {
  AnswerTypeSchema,
  type NextQuestionResponse,
  ParamsSchema,
  toNextQuestionResponse,
} from "@/lib/api/contracts";
import { renderHint } from "@/lib/engine/instantiate";

import type { AnswerDeps } from "./answer-attempt";
import { voidAttempt } from "./attempts";
import { currentTemplate } from "./solution";

/**
 * Neuladen ist kein Ausweg (SPEC-M2f, Schritt 4b): `/next` liefert den offenen
 * Attempt der Sitzung erneut aus, statt einen neuen anzulegen — mit den schon
 * geöffneten Tipps und dem Hinweis, dass der erste Versuch falsch war.
 *
 * Sonst hieße der Weg aus einem Fehlversuch: Seite neu laden, neue Aufgabe,
 * und der halb beantwortete Attempt bliebe für immer offen und zählte nie.
 *
 * Der Vertrag von `/next` bleibt: keine Lösung in der Response. Geladen wird
 * deshalb die Zeile **ohne** `expectedAnswer`, und die Antwort baut
 * `toNextQuestionResponse` Feld für Feld. Tipps sind erlaubt — sie entstehen
 * nur aus den Parametern (Prüfung 11).
 */

export interface ResumeInput {
  readonly practiceSessionId: string;
  /** Die Uhr der Anfrage. Pflicht, nicht optional — siehe D-20. */
  readonly now: Date;
}

/** Die erneut ausgelieferte Aufgabe, oder `undefined`: Es gibt keine offene. */
export async function resumeOpenAttempt(
  deps: AnswerDeps,
  input: ResumeInput,
): Promise<NextQuestionResponse | undefined> {
  const attempt = await deps.prisma.attempt.findFirst({
    where: { practiceSessionId: input.practiceSessionId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      questionText: true,
      answerType: true,
      templateId: true,
      templateVersion: true,
      params: true,
      tries: true,
      hintsUsed: true,
    },
  });
  if (!attempt) return undefined;

  const template = currentTemplate(deps.findTemplate, attempt);
  if (!template) {
    // Das Template hat sich seit dem Stellen geändert — die Aufgabe lässt sich
    // nicht mehr mit Zielzeit und Tipps zeigen. Ein begonnener Attempt wird
    // verworfen, ohne Misserfolg: Den Versionswechsel haben Entwickler
    // ausgelöst, nicht der Übende. Ein unberührter bleibt liegen.
    await voidAttempt(deps.prisma, { attemptId: attempt.id, now: input.now });
    return undefined;
  }

  const params = ParamsSchema.parse(attempt.params);
  const openedHints = Array.from({ length: attempt.hintsUsed }, (_, i) =>
    renderHint(template, params, i),
  ).filter((hint): hint is string => hint !== undefined);

  return toNextQuestionResponse(
    { ...attempt, answerType: AnswerTypeSchema.parse(attempt.answerType) },
    template,
    { openedHints, firstTryWrong: attempt.tries >= 1 },
  );
}
